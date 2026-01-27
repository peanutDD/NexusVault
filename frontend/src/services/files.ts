import api from './api';
import { buildQueryParams } from '../utils/queryParams';
import { downloadBlob } from '../utils/downloadBlob';
import { API_BASE_URL } from '../config/env';
import { CHUNKED_UPLOAD } from '../constants';

export interface FileMetadata {
  id: string;
  filename: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  category: string | null;
  folder_id: string | null;
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
  folder_id?: string | null;
  date_from?: string;
  date_to?: string;
  size_min?: number;
  size_max?: number;
}

export const fileService = {
  async listFiles(query?: FileListQuery): Promise<FileListResponse> {
    const q: Record<string, string | number | undefined | null> = {};
    
    if (query) {
      // 使用 Object.entries 替代多个 if 语句
      // 特殊处理 folder_id（null 表示根目录）
      const specialKeys = new Set(['folder_id', 'category']);
      
      Object.entries(query).forEach(([key, value]) => {
        // folder_id 特殊处理：null 需要转为 "null" 字符串
        if (key === 'folder_id' && value !== undefined) {
          q[key] = value === null ? 'null' : value;
        }
        // category 允许空字符串
        else if (key === 'category' && value !== undefined) {
          q[key] = value;
        }
        // 其他字段：只添加非 null/undefined 的值
        else if (!specialKeys.has(key) && value != null) {
          q[key] = value;
        }
      });
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

  /**
   * 分块上传（支持大文件）
   * 特性：
   * - 并行上传多个块（提高速度）
   * - 断点续传（已上传的块不会重复上传）
   * - 指数退避重试
   * - 实时进度回调
   */
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

    // 获取已上传的块（支持断点续传）
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
    let completedChunks = uploaded.size;

    const report = () => {
      if (onProgress) {
        onProgress(Math.round((completedChunks / total_parts) * 100));
      }
    };

    // 初始报告（断点续传时显示已有进度）
    report();

    // 生成待上传的块列表（使用 filter 替代 for + if）
    const pendingParts = Array.from(
      { length: total_parts },
      (_, i) => i + 1
    ).filter((part) => !uploaded.has(part));

    // 上传单个块（带重试）
    const uploadChunk = async (part: number): Promise<void> => {
      const start = (part - 1) * chunk_size;
      const end = Math.min(part * chunk_size, file.size);
      const blob = file.slice(start, end);

      for (let attempt = 0; attempt < CHUNKED_UPLOAD.MAX_RETRIES; attempt++) {
        try {
          await this.chunkedUploadChunk(upload_id, part, blob);
          completedChunks++;
          report();
          return;
        } catch (e) {
          // 检查是否已经上传成功（可能是网络问题导致响应丢失）
          const currentUploaded = await refreshUploaded();
          if (currentUploaded.has(part)) {
            completedChunks++;
            report();
            return;
          }
          // 最后一次重试失败则抛出错误
          if (attempt === CHUNKED_UPLOAD.MAX_RETRIES - 1) throw e;
          // 指数退避延迟
          const delay = CHUNKED_UPLOAD.RETRY_DELAY_BASE * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    };

    // 并行上传块（使用 Promise.allSettled 确保所有块都尝试上传）
    const parallelLimit = CHUNKED_UPLOAD.PARALLEL_CHUNKS;
    const chunks = [...pendingParts];
    
    while (chunks.length > 0) {
      const batch = chunks.splice(0, parallelLimit);
      const results = await Promise.allSettled(batch.map(uploadChunk));
      
      // 检查是否有失败的块（使用类型守卫替代类型断言）
      const firstFailure = results.find(
        (r): r is PromiseRejectedResult => r.status === 'rejected'
      );
      if (firstFailure) {
        throw firstFailure.reason;
      }
    }

    // 完成前验证所有块都已上传（使用 filter 替代 for + if）
    const finalStatus = await refreshUploaded();
    const missingParts = Array.from(
      { length: total_parts },
      (_, i) => i + 1
    ).filter((part) => !finalStatus.has(part));

    // 使用 for...of 上传缺失的块（需要顺序执行）
    for (const part of missingParts) {
      await uploadChunk(part);
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
    return `${API_BASE_URL.replace(/\/$/, '')}/api/files/${fileId}/preview`;
  },

  /** 带鉴权的预览 blob，供缩略图/预览用（img/iframe 无法带 Authorization） */
  async fetchPreviewBlob(fileId: string): Promise<Blob> {
    const { data } = await api.get<Blob>(`/api/files/${fileId}/preview`, {
      responseType: 'blob',
    });
    return data;
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
