import api from './api';
import { CHUNKED_UPLOAD } from '../constants';
import { sha256FileHex } from '../utils/sha256';
import { trackError, trackEvent } from '../utils/telemetry';
import { getUploadMimeType } from '../utils/uploadValidation';
import type { FileMetadata } from '../types/files';

type UploadResult = { file: FileMetadata };
type UploadProgress = (percent: number, message?: string) => void;
interface UploadOptions {
  signal?: AbortSignal;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw new DOMException('Upload cancelled', 'AbortError');
}

function isAbortLikeError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  if (!(err instanceof Error)) return false;
  const maybeCode = (err as Error & { code?: unknown }).code;
  return err.name === 'AbortError' || maybeCode === 'ERR_CANCELED';
}

function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Upload cancelled', 'AbortError'));
      return;
    }
    function abort() {
      window.clearTimeout(timeoutId);
      signal?.removeEventListener('abort', abort);
      reject(new DOMException('Upload cancelled', 'AbortError'));
    }
    const timeoutId = window.setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

export const fileUploadService = {
  async uploadInstant(params: {
    content_sha256: string;
    filename: string;
    file_size: number;
    mime_type: string;
    folder_id?: string | null;
  }, options: UploadOptions = {}): Promise<UploadResult | null> {
    const res = await api.post<{ file?: FileMetadata; instant?: boolean }>(
      '/api/files/upload/instant',
      {
        content_sha256: params.content_sha256,
        filename: params.filename,
        file_size: params.file_size,
        mime_type: params.mime_type,
        folder_id: params.folder_id ?? null,
      },
      {
        signal: options.signal,
        validateStatus: (status) => status === 200 || status === 201,
      },
    );

    if (res.status === 200 && res.data?.instant === false) return null;
    if (res.data?.file) return { file: res.data.file };
    return null;
  },

  async uploadFileWithInstant(
    file: globalThis.File,
    onProgress?: UploadProgress,
    folderId?: string | null,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    const startedAt = performance.now();
    const mime = getUploadMimeType(file);
    const useChunked = mime.startsWith('video/') || file.size >= this.CHUNK_THRESHOLD;

    trackEvent({
      eventType: 'upload',
      action: 'upload_with_instant',
      status: 'start',
      fileSize: file.size,
    });

    try {
      throwIfAborted(options.signal);
      onProgress?.(0, '计算指纹…');
      const content_sha256 = await sha256FileHex(file, options.signal);
      let result: UploadResult | null = null;

      try {
        throwIfAborted(options.signal);
        onProgress?.(0, '检查秒传…');
        result = await this.uploadInstant({
          content_sha256,
          filename: file.name,
          file_size: file.size,
          mime_type: mime,
          folder_id: folderId ?? null,
        }, options);
      } catch (instantErr) {
        if (isAbortLikeError(instantErr)) throw instantErr;
        trackError(instantErr, { action: 'upload_instant_failed', fileSize: file.size });
      }

      if (result === null) {
        onProgress?.(0, '秒传未命中，正在上传…');
        const progressOnly: UploadProgress = (p, message) => onProgress?.(p, message);
        const uploaded = await (useChunked
          ? this.uploadFileChunked(file, progressOnly, folderId, options)
          : this.uploadFile(file, progressOnly, folderId, options));

        trackUploadSuccess('upload_with_instant', uploaded.file.id, file.size, startedAt);
        return uploaded;
      }

      onProgress?.(100);
      trackUploadSuccess('upload_with_instant', result.file.id, file.size, startedAt, {
        mode: 'instant',
      });
      return result;
    } catch (err) {
      if (isAbortLikeError(err)) {
        trackEvent({
          eventType: 'upload',
          action: 'upload_with_instant',
          status: 'failure',
          fileSize: file.size,
          extra: { cancelled: true },
        });
      } else {
        trackError(err, { action: 'upload_with_instant', fileSize: file.size });
      }
      throw err;
    }
  },

  async uploadFile(
    file: globalThis.File,
    onProgress?: UploadProgress,
    folderId?: string | null,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    if (folderId) formData.append('folder_id', folderId);

    const response = await api.post<UploadResult>('/api/files/upload', formData, {
      signal: options.signal,
      onUploadProgress:
        onProgress &&
        ((e) => {
          if (e.total != null && e.total > 0) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        }),
    });
    return response.data;
  },

  CHUNK_SIZE: CHUNKED_UPLOAD.CHUNK_SIZE,
  CHUNK_THRESHOLD: CHUNKED_UPLOAD.THRESHOLD,

  async chunkedUploadInit(
    filename: string,
    mimeType: string,
    totalSize: number,
    options: UploadOptions = {},
  ): Promise<{ upload_id: string; chunk_size: number; total_parts: number }> {
    const { data } = await api.post<{
      upload_id: string;
      chunk_size: number;
      total_parts: number;
    }>('/api/files/upload/chunked/init', {
      filename,
      mime_type: mimeType,
      total_size: totalSize,
    }, {
      signal: options.signal,
    });
    return data;
  },

  async chunkedUploadChunk(
    uploadId: string,
    part: number,
    blob: Blob,
    options: UploadOptions = {},
  ): Promise<void> {
    await api.put(`/api/files/upload/chunked/${uploadId}/chunk?part=${part}`, blob, {
      signal: options.signal,
      headers: { 'Content-Type': 'application/octet-stream' },
    });
  },

  async chunkedUploadStatus(
    uploadId: string,
    options: UploadOptions = {},
  ): Promise<{ uploaded_parts: number[]; total_parts: number }> {
    const { data } = await api.get<{
      uploaded_parts: number[];
      total_parts: number;
    }>(`/api/files/upload/chunked/${uploadId}/status`, { signal: options.signal });
    return data;
  },

  async chunkedUploadComplete(
    uploadId: string,
    filename: string,
    mimeType: string,
    folderId?: string | null,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    const { data } = await api.post<UploadResult>(
      `/api/files/upload/chunked/${uploadId}/complete`,
      { filename, mime_type: mimeType, folder_id: folderId ?? null },
      { signal: options.signal },
    );
    return data;
  },

  async chunkedUploadAbort(uploadId: string): Promise<void> {
    await api.delete(`/api/files/upload/chunked/${uploadId}/abort`);
  },

  async uploadFileChunked(
    file: globalThis.File,
    onProgress?: UploadProgress,
    folderId?: string | null,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    const mimeType = getUploadMimeType(file);
    throwIfAborted(options.signal);
    let uploadId: string | null = null;
    const { upload_id, chunk_size, total_parts } = await this.chunkedUploadInit(
      file.name,
      mimeType,
      file.size,
      options,
    );
    uploadId = upload_id;

    const refreshUploaded = async (): Promise<Set<number>> => {
      try {
        const status = await this.chunkedUploadStatus(upload_id, options);
        return new Set(status.uploaded_parts);
      } catch {
        return new Set();
      }
    };

    const uploaded = await refreshUploaded();
    let completedChunks = uploaded.size;
    const report = () => onProgress?.(Math.round((completedChunks / total_parts) * 100));
    report();

    const uploadChunk = async (part: number): Promise<void> => {
      throwIfAborted(options.signal);
      const start = (part - 1) * chunk_size;
      const blob = file.slice(start, Math.min(part * chunk_size, file.size));

      for (let attempt = 0; attempt < CHUNKED_UPLOAD.MAX_RETRIES; attempt++) {
        try {
          throwIfAborted(options.signal);
          await this.chunkedUploadChunk(upload_id, part, blob, options);
          completedChunks++;
          report();
          return;
        } catch (e) {
          if (isAbortLikeError(e) || options.signal?.aborted) throw e;
          const currentUploaded = await refreshUploaded();
          if (currentUploaded.has(part)) {
            completedChunks++;
            report();
            return;
          }
          if (attempt === CHUNKED_UPLOAD.MAX_RETRIES - 1) throw e;
          const delay = CHUNKED_UPLOAD.RETRY_DELAY_BASE * Math.pow(2, attempt);
          onProgress?.(Math.round((completedChunks / total_parts) * 100), `分片 ${part} 重试中…`);
          await abortableDelay(delay, options.signal);
        }
      }
    };

    try {
      const pendingParts = Array.from({ length: total_parts }, (_, i) => i + 1).filter(
        (part) => !uploaded.has(part),
      );
      const chunks = [...pendingParts];

      while (chunks.length > 0) {
        throwIfAborted(options.signal);
        const batch = chunks.splice(0, CHUNKED_UPLOAD.PARALLEL_CHUNKS);
        const results = await Promise.allSettled(batch.map(uploadChunk));
        const firstFailure = results.find(
          (result): result is PromiseRejectedResult => result.status === 'rejected',
        );
        if (firstFailure) throw firstFailure.reason;
      }

      const finalStatus = await refreshUploaded();
      const missingParts = Array.from({ length: total_parts }, (_, i) => i + 1).filter(
        (part) => !finalStatus.has(part),
      );

      for (const part of missingParts) {
        await uploadChunk(part);
      }

      throwIfAborted(options.signal);
      return this.chunkedUploadComplete(upload_id, file.name, mimeType, folderId, options);
    } catch (err) {
      if (uploadId !== null) {
        await this.chunkedUploadAbort(uploadId).catch((abortErr) => {
          trackError(abortErr, { action: 'chunked_upload_abort_failed', fileSize: file.size });
        });
      }
      throw err;
    }
  },
};

function trackUploadSuccess(
  action: string,
  fileId: string,
  fileSize: number,
  startedAt: number,
  extra?: Record<string, unknown>,
): void {
  trackEvent({
    eventType: 'upload',
    action,
    status: 'success',
    fileId,
    fileSize,
    durationMs: Math.round(performance.now() - startedAt),
    extra,
  });
}
