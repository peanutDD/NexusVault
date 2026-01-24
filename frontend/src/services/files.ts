import api from './api';
import { buildQueryParams } from '../utils/queryParams';
import { downloadBlob } from '../utils/downloadBlob';
import { ORIGIN } from '../config/env';
import { CHUNKED_UPLOAD } from '../constants';

export interface FileMetadata {
  id: string;
  filename: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  category: string | null;
  created_at: string;
}

export interface FileListResponse {
  files: FileMetadata[];
  total: number;
}

export interface FileListQuery {
  page?: number;
  limit?: number;
  search?: string;
  mime_type?: string;
  category?: string;
  date_from?: string;
  date_to?: string;
  size_min?: number;
  size_max?: number;
}

export const fileService = {
  async listFiles(query?: FileListQuery): Promise<FileListResponse> {
    const q: Record<string, string | number | undefined | null> = {};
    if (query) {
      if (query.page != null) q.page = query.page;
      if (query.limit != null) q.limit = query.limit;
      if (query.search != null) q.search = query.search;
      if (query.mime_type != null) q.mime_type = query.mime_type;
      if (query.category !== undefined) q.category = query.category;
      if (query.date_from != null) q.date_from = query.date_from;
      if (query.date_to != null) q.date_to = query.date_to;
      if (query.size_min != null) q.size_min = query.size_min;
      if (query.size_max != null) q.size_max = query.size_max;
    }
    const params = buildQueryParams(q);
    const response = await api.get<FileListResponse>(
      `/api/files?${params.toString()}`
    );
    return response.data;
  },

  async uploadFile(
    file: globalThis.File,
    onProgress?: (percent: number) => void
  ): Promise<{ file: FileMetadata }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<{ file: FileMetadata }>(
      '/api/files/upload',
      formData,
      {
        onUploadProgress:
          onProgress &&
          ((e) => {
            if (e.total != null && e.total > 0) {
              onProgress(Math.round((e.loaded / e.total) * 100));
            }
          }),
      }
    );
    return response.data;
  },

  CHUNK_SIZE: CHUNKED_UPLOAD.CHUNK_SIZE,
  CHUNK_THRESHOLD: CHUNKED_UPLOAD.THRESHOLD,

  async chunkedUploadInit(
    filename: string,
    mimeType: string,
    totalSize: number
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

  async chunkedUploadChunk(
    uploadId: string,
    part: number,
    blob: Blob
  ): Promise<void> {
    await api.put(`/api/files/upload/chunked/${uploadId}/chunk?part=${part}`, blob, {
      headers: { 'Content-Type': 'application/octet-stream' },
    });
  },

  async chunkedUploadStatus(
    uploadId: string
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
    mimeType: string
  ): Promise<{ file: FileMetadata }> {
    const { data } = await api.post<{ file: FileMetadata }>(
      `/api/files/upload/chunked/${uploadId}/complete`,
      { filename, mime_type: mimeType }
    );
    return data;
  },

  async chunkedUploadAbort(uploadId: string): Promise<void> {
    await api.delete(`/api/files/upload/chunked/${uploadId}/abort`);
  },

  async uploadFileChunked(
    file: globalThis.File,
    onProgress?: (percent: number) => void
  ): Promise<{ file: FileMetadata }> {
    const mimeType = file.type || 'application/octet-stream';
    const { upload_id, chunk_size, total_parts } = await this.chunkedUploadInit(
      file.name,
      mimeType,
      file.size
    );

    const refreshUploaded = async (): Promise<Set<number>> => {
      const s = new Set<number>();
      try {
        const status = await this.chunkedUploadStatus(upload_id);
        status.uploaded_parts.forEach((p) => s.add(p));
      } catch {
        /* ignore */
      }
      return s;
    };

    let uploaded = await refreshUploaded();

    const report = () => {
      if (onProgress) {
        onProgress(Math.round((uploaded.size / total_parts) * 100));
      }
    };

    for (let part = 1; part <= total_parts; part++) {
      if (uploaded.has(part)) {
        report();
        continue;
      }
      const start = (part - 1) * chunk_size;
      const end = Math.min(part * chunk_size, file.size);
      const blob = file.slice(start, end);
      for (let attempt = 0; attempt < CHUNKED_UPLOAD.MAX_RETRIES; attempt++) {
        try {
          await this.chunkedUploadChunk(upload_id, part, blob);
          uploaded.add(part);
          report();
          break;
        } catch (e) {
          uploaded = await refreshUploaded();
          if (uploaded.has(part)) {
            report();
            break;
          }
          if (attempt === 2) throw e;
        }
      }
    }

    return this.chunkedUploadComplete(upload_id, file.name, mimeType);
  },

  async downloadFile(fileId: string, filename: string): Promise<void> {
    const response = await api.get<Blob>(`/api/files/${fileId}/download`, {
      responseType: 'blob',
    });
    downloadBlob(new Blob([response.data]), filename);
  },

  async deleteFile(fileId: string): Promise<void> {
    await api.delete(`/api/files/${fileId}`);
  },

  async batchDelete(ids: string[]): Promise<{ deleted: number }> {
    const response = await api.post<{ deleted: number; message: string }>(
      '/api/files/batch-delete',
      { ids }
    );
    return { deleted: response.data.deleted };
  },

  async downloadZip(ids: string[]): Promise<void> {
    const idsParam = ids.join(',');
    const response = await api.get<Blob>(
      `/api/files/download-zip?ids=${idsParam}`,
      { responseType: 'blob' }
    );
    downloadBlob(new Blob([response.data]), 'files.zip');
  },

  getPreviewUrl(fileId: string): string {
    return `${ORIGIN.replace(/\/$/, '')}/api/files/${fileId}/preview`;
  },

  async getCategories(): Promise<string[]> {
    const response = await api.get<{ categories: string[] }>('/api/files/categories');
    return response.data.categories;
  },

  async batchMove(ids: string[], category: string | null): Promise<{ moved: number }> {
    const response = await api.post<{ moved: number; message: string }>(
      '/api/files/batch-move',
      { ids, category: category ?? '' }
    );
    return { moved: response.data.moved };
  },

  async getStorageUsage(): Promise<{
    total_size: number;
    file_count: number;
    total_size_mb: number;
    quota: number | null;
    quota_mb: number | null;
    usage_percent: number | null;
    is_unlimited: boolean;
  }> {
    const response = await api.get<{
      total_size: number;
      file_count: number;
      total_size_mb: number;
      quota: number | null;
      quota_mb: number | null;
      usage_percent: number | null;
      is_unlimited: boolean;
    }>('/api/files/storage-usage');
    return response.data;
  },
};
