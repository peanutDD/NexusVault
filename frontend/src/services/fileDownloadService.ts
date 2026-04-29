import api from './api';
import { API_BASE_URL } from '../config/env';
import { useAuthStore } from '../store/authStore';
import { downloadBlob } from '../utils/downloadBlob';
import { trackError, trackEvent } from '../utils/telemetry';

type FilePickerWindow = Window & {
  showSaveFilePicker: (opts?: {
    suggestedName?: string;
    types?: Array<{ description?: string; accept?: Record<string, string[]> }>;
  }) => Promise<FileSystemFileHandle>;
};

type StreamSaveResult = 'saved' | 'cancelled' | 'fallback';

export const fileDownloadService = {
  async downloadFile(fileId: string, filename: string): Promise<void> {
    const startedAt = performance.now();
    trackEvent({ eventType: 'download', action: 'download_file', status: 'start', fileId });

    try {
      const url = `${apiBase()}/api/files/${fileId}/download`;
      const token = getAuthToken();
      const saved = await saveWithFilePicker({
        suggestedName: filename,
        request: (offset) =>
          fetch(url, {
            method: 'GET',
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
              ...(offset > 0 ? { Range: `bytes=${offset}-` } : {}),
            },
          }),
      });

      if (saved === 'saved') {
        trackDownloadSuccess('download_file', fileId, startedAt);
        return;
      }
      if (saved === 'cancelled') return;

      if (token) {
        const joiner = url.includes('?') ? '&' : '?';
        const a = document.createElement('a');
        a.href = `${url}${joiner}token=${encodeURIComponent(token)}`;
        a.download = filename;
        a.rel = 'noopener';
        a.referrerPolicy = 'no-referrer';
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        const response = await api.get<Blob>(`/api/files/${fileId}/download`, {
          responseType: 'blob',
        });
        downloadBlob(response.data, filename);
      }

      trackDownloadSuccess('download_file', fileId, startedAt);
    } catch (err) {
      trackError(err, { action: 'download_file', fileId });
      throw err;
    }
  },

  async getFileAsBlob(fileId: string, options?: { signal?: AbortSignal }): Promise<Blob> {
    const { data } = await api.get<Blob>(`/api/files/${fileId}/download`, {
      responseType: 'blob',
      signal: options?.signal,
    });
    return data;
  },

  async getFileRange(
    fileId: string,
    start: number,
    end: number,
    options?: { signal?: AbortSignal },
  ): Promise<Blob> {
    const { data } = await api.get<Blob>(`/api/files/${fileId}/download`, {
      responseType: 'blob',
      headers: { Range: `bytes=${start}-${end}` },
      signal: options?.signal,
    });
    return data;
  },

  async getFileSize(fileId: string): Promise<number> {
    const response = await api.head(`/api/files/${fileId}/download`);
    const contentLength = response.headers['content-length'];
    if (!contentLength) throw new Error('无法获取文件大小');
    return parseInt(contentLength, 10);
  },

  async downloadZip(ids: string[]): Promise<void> {
    const url = `${apiBase()}/api/files/download-zip`;
    const token = getAuthToken();
    const saved = await saveWithFilePicker({
      suggestedName: 'files.zip',
      types: [{ description: 'ZIP Archive', accept: { 'application/zip': ['.zip'] } }],
      request: (offset) =>
        fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(offset > 0 ? { Range: `bytes=${offset}-` } : {}),
          },
          body: JSON.stringify({ ids }),
        }),
    });

    if (saved === 'saved' || saved === 'cancelled') return;

    const response = await api.post<Blob>(
      '/api/files/download-zip',
      { ids },
      { responseType: 'blob' },
    );
    downloadBlob(response.data, 'files.zip');
  },
};

function apiBase(): string {
  return API_BASE_URL.replace(/\/$/, '');
}

function getAuthToken(): string | null {
  return useAuthStore.getState().token ?? localStorage.getItem('token');
}

async function saveWithFilePicker(options: {
  suggestedName: string;
  types?: Array<{ description?: string; accept?: Record<string, string[]> }>;
  request: (offset: number) => Promise<Response>;
}): Promise<StreamSaveResult> {
  if (typeof window === 'undefined' || !('showSaveFilePicker' in window)) {
    return 'fallback';
  }

  let writable: FileSystemWritableFileStream | null = null;

  try {
    const handle = await (window as FilePickerWindow).showSaveFilePicker({
      suggestedName: options.suggestedName,
      types: options.types,
    });
    const getLocalSize = async () => {
      try {
        const file = await handle.getFile();
        return file.size;
      } catch {
        return 0;
      }
    };

    let offset = await getLocalSize();
    let tries = 0;

    while (true) {
      const res = await options.request(offset);
      await assertStreamResponse(res);
      if (offset > 0 && res.status !== 206) offset = 0;

      await abortWritable(writable);
      writable = await handle.createWritable({ keepExistingData: offset > 0 });
      if (offset > 0) await writable.seek(offset);

      try {
        await writeBodyToDisk(res, writable, (bytes) => {
          offset += bytes;
        });
        writable = null;
        return 'saved';
      } catch (e) {
        tries++;
        if (tries >= 3) throw e;
        offset = await getLocalSize();
      }
    }
  } catch (e) {
    await abortWritable(writable);
    if (e instanceof Error && e.name === 'AbortError') return 'cancelled';
    console.warn('File System Access API failed, falling back to blob download:', e);
    return 'fallback';
  }
}

async function assertStreamResponse(res: Response): Promise<void> {
  if (!res.ok) {
    let errorMessage = res.statusText || 'Download failed';
    try {
      const errorData = (await res.json()) as { error?: string };
      if (errorData.error) errorMessage = errorData.error;
    } catch {
      // keep status text
    }
    throw new Error(errorMessage);
  }
  if (!res.body) throw new Error('Response body is empty');
}

async function writeBodyToDisk(
  res: Response,
  writable: FileSystemWritableFileStream,
  onBytes: (bytes: number) => void,
): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error('Response body is empty');

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    await writable.write(value);
    onBytes(value.byteLength);
  }
  await writable.close();
}

async function abortWritable(writable: FileSystemWritableFileStream | null): Promise<void> {
  if (!writable) return;

  try {
    const writableWithAbort = writable as FileSystemWritableFileStream & {
      abort?: () => Promise<void>;
    };
    if (typeof writableWithAbort.abort === 'function') {
      await writableWithAbort.abort();
    } else {
      await writable.close();
    }
  } catch {
    // ignore cleanup errors
  }
}

function trackDownloadSuccess(action: string, fileId: string, startedAt: number): void {
  trackEvent({
    eventType: 'download',
    action,
    status: 'success',
    fileId,
    durationMs: Math.round(performance.now() - startedAt),
  });
}
