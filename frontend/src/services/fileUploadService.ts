import api from './api';
import { CHUNKED_UPLOAD } from '../constants';
import { sha256FileHex } from '../utils/sha256';
import { trackError, trackEvent } from '../utils/telemetry';
import type { FileMetadata } from '../types/files';

type UploadResult = { file: FileMetadata };

export const fileUploadService = {
  async uploadInstant(params: {
    content_sha256: string;
    filename: string;
    file_size: number;
    mime_type: string;
    folder_id?: string | null;
  }): Promise<UploadResult | null> {
    const res = await api.post<{ file?: FileMetadata; instant?: boolean }>(
      '/api/files/upload/instant',
      {
        content_sha256: params.content_sha256,
        filename: params.filename,
        file_size: params.file_size,
        mime_type: params.mime_type,
        folder_id: params.folder_id ?? null,
      },
      { validateStatus: (status) => status === 200 || status === 201 },
    );

    if (res.status === 200 && res.data?.instant === false) return null;
    if (res.data?.file) return { file: res.data.file };
    return null;
  },

  async uploadFileWithInstant(
    file: globalThis.File,
    onProgress?: (percent: number, message?: string) => void,
    folderId?: string | null,
  ): Promise<UploadResult> {
    const startedAt = performance.now();
    const useChunked = file.type.startsWith('video/') || file.size >= this.CHUNK_THRESHOLD;

    trackEvent({
      eventType: 'upload',
      action: 'upload_with_instant',
      status: 'start',
      fileSize: file.size,
    });

    try {
      onProgress?.(0, '计算指纹…');
      const content_sha256 = await sha256FileHex(file);
      const mime = file.type || 'application/octet-stream';
      let result: UploadResult | null = null;

      try {
        result = await this.uploadInstant({
          content_sha256,
          filename: file.name,
          file_size: file.size,
          mime_type: mime,
          folder_id: folderId ?? null,
        });
      } catch (instantErr) {
        trackError(instantErr, { action: 'upload_instant_failed', fileSize: file.size });
      }

      if (result === null) {
        onProgress?.(0, '秒传未命中，正在上传…');
        const progressOnly = (p: number) => onProgress?.(p);
        const uploaded = await (useChunked
          ? this.uploadFileChunked(file, progressOnly, folderId)
          : this.uploadFile(file, progressOnly, folderId));

        trackUploadSuccess('upload_with_instant', uploaded.file.id, file.size, startedAt);
        return uploaded;
      }

      onProgress?.(100);
      trackUploadSuccess('upload_with_instant', result.file.id, file.size, startedAt, {
        mode: 'instant',
      });
      return result;
    } catch (err) {
      trackError(err, { action: 'upload_with_instant', fileSize: file.size });
      throw err;
    }
  },

  async uploadFile(
    file: globalThis.File,
    onProgress?: (percent: number) => void,
    folderId?: string | null,
  ): Promise<UploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    if (folderId) formData.append('folder_id', folderId);

    const response = await api.post<UploadResult>('/api/files/upload', formData, {
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
  ): Promise<{ upload_id: string; chunk_size: number; total_parts: number }> {
    const { data } = await api.post<{
      upload_id: string;
      chunk_size: number;
      total_parts: number;
    }>('/api/files/upload/chunked/init', {
      filename,
      mime_type: mimeType,
      total_size: totalSize,
    });
    return data;
  },

  async chunkedUploadChunk(uploadId: string, part: number, blob: Blob): Promise<void> {
    await api.put(`/api/files/upload/chunked/${uploadId}/chunk?part=${part}`, blob, {
      headers: { 'Content-Type': 'application/octet-stream' },
    });
  },

  async chunkedUploadStatus(
    uploadId: string,
  ): Promise<{ uploaded_parts: number[]; total_parts: number }> {
    const { data } = await api.get<{
      uploaded_parts: number[];
      total_parts: number;
    }>(`/api/files/upload/chunked/${uploadId}/status`);
    return data;
  },

  async chunkedUploadComplete(
    uploadId: string,
    filename: string,
    mimeType: string,
    folderId?: string | null,
  ): Promise<UploadResult> {
    const { data } = await api.post<UploadResult>(
      `/api/files/upload/chunked/${uploadId}/complete`,
      { filename, mime_type: mimeType, folder_id: folderId ?? null },
    );
    return data;
  },

  async chunkedUploadAbort(uploadId: string): Promise<void> {
    await api.delete(`/api/files/upload/chunked/${uploadId}/abort`);
  },

  async uploadFileChunked(
    file: globalThis.File,
    onProgress?: (percent: number) => void,
    folderId?: string | null,
  ): Promise<UploadResult> {
    const mimeType = file.type || 'application/octet-stream';
    const { upload_id, chunk_size, total_parts } = await this.chunkedUploadInit(
      file.name,
      mimeType,
      file.size,
    );

    const refreshUploaded = async (): Promise<Set<number>> => {
      try {
        const status = await this.chunkedUploadStatus(upload_id);
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
      const start = (part - 1) * chunk_size;
      const blob = file.slice(start, Math.min(part * chunk_size, file.size));

      for (let attempt = 0; attempt < CHUNKED_UPLOAD.MAX_RETRIES; attempt++) {
        try {
          await this.chunkedUploadChunk(upload_id, part, blob);
          completedChunks++;
          report();
          return;
        } catch (e) {
          const currentUploaded = await refreshUploaded();
          if (currentUploaded.has(part)) {
            completedChunks++;
            report();
            return;
          }
          if (attempt === CHUNKED_UPLOAD.MAX_RETRIES - 1) throw e;
          const delay = CHUNKED_UPLOAD.RETRY_DELAY_BASE * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    };

    const pendingParts = Array.from({ length: total_parts }, (_, i) => i + 1).filter(
      (part) => !uploaded.has(part),
    );
    const chunks = [...pendingParts];

    while (chunks.length > 0) {
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

    return this.chunkedUploadComplete(upload_id, file.name, mimeType, folderId);
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
