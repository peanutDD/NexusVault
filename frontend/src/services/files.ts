/**
 * 文件服务
 * 提供文件上传、下载、列表查询、预览等功能
 */
import api, { limitedApi } from './api';
import { buildQueryParams } from '../utils/queryParams';
import { downloadBlob } from '../utils/downloadBlob';
import { API_BASE_URL } from '../config/env';
import { CHUNKED_UPLOAD, REQUEST } from '../constants';
import { BatchRequestManager } from '../utils/batchRequest';
import { useAuthStore } from '../store/authStore';
import type { FileMetadata, FileListResponse, FileListQuery } from '../types';

/**
 * 预览请求并发限制器
 * 最多允许 6 个并发预览请求，防止浏览器连接数耗尽
 */
const previewQueue = {
  running: 0,
  maxConcurrent: 6,
  queue: [] as Array<() => void>,
  
  /**
   * 运行带并发限制的异步函数
   * @param fn 要执行的异步函数
   * @returns 函数执行结果
   */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    // 等待有空位
    if (this.running >= this.maxConcurrent) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    
    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      // 释放下一个等待者
      const next = this.queue.shift();
      if (next) next();
    }
  }
};



/**
 * 批量按 ID 查询文件详情
 * 一次请求获取多个文件详情，顺序与 ids 一致，未找到的文件为 null
 * @param ids 文件 ID 列表
 * @returns 文件详情列表
 */
async function fetchFilesByIds(ids: string[]): Promise<(FileMetadata | null)[]> {
  if (ids.length === 0) return [];
  const { data } = await api.post<{ files: (FileMetadata | null)[] }>('/api/files/batch', {
    ids,
  });
  return data.files;
}

// 文件详情批量请求管理器
const fileMetadataBatch = new BatchRequestManager<FileMetadata | null, 'metadata'>(
  REQUEST.BATCH_DELAY_MS,
  fetchFilesByIds
);

/**
 * 文件服务对象
 * 提供文件相关的所有 API 操作
 */
export const fileService = {
  /**
   * 按 ID 列表批量查询文件详情
   * 直接调用，适合已有多个 id 的场景
   * @param ids 文件 ID 列表
   * @returns 文件详情列表，顺序与 ids 一致，未找到的文件为 null
   */
  async getFilesByIds(ids: string[]): Promise<(FileMetadata | null)[]> {
    return fetchFilesByIds(ids);
  },

  /**
   * 按单 ID 查询文件详情
   * 经 BatchRequestManager 合并，与 getFilesByIds 共用批量接口
   * @param id 文件 ID
   * @returns 文件详情或 null（未找到）
   */
  getFileMetadata(id: string): Promise<FileMetadata | null> {
    return fileMetadataBatch.request('metadata', id);
  },

  /**
   * 查询文件列表
   * @param query 查询参数
   * @returns 文件列表响应
   */
  async listFiles(query?: FileListQuery): Promise<FileListResponse> {
    const q: Record<string, string | number | undefined | null> = {};
    
    if (query) {
      // 特殊处理的字段
      const specialKeys = new Set(['folder_id', 'category']);
      
      // 处理查询参数
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
    
    // 构建查询参数
    const params = buildQueryParams(q);
    
    // 使用 limitedApi 限制并发，降低后端压力
    const response = await limitedApi.get<FileListResponse>(
      `/api/files?${params.toString()}`
    );
    
    return response.data;
  },

  /**
   * 上传文件
   * 适用于小文件上传
   * @param file 要上传的文件
   * @param onProgress 上传进度回调
   * @returns 上传结果，包含文件元数据
   */
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

  // 分块上传相关常量
  CHUNK_SIZE: CHUNKED_UPLOAD.CHUNK_SIZE,
  CHUNK_THRESHOLD: CHUNKED_UPLOAD.THRESHOLD,

  /**
   * 初始化分块上传
   * @param filename 文件名
   * @param mimeType 文件 MIME 类型
   * @param totalSize 文件总大小
   * @returns 初始化结果，包含上传 ID、块大小和总块数
   */
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

  /**
   * 上传单个文件块
   * @param uploadId 上传 ID
   * @param part 块序号
   * @param blob 文件块数据
   */
  async chunkedUploadChunk(
    uploadId: string,
    part: number,
    blob: Blob
  ): Promise<void> {
    await api.put(`/api/files/upload/chunked/${uploadId}/chunk?part=${part}`, blob, {
      headers: { 'Content-Type': 'application/octet-stream' },
    });
  },

  /**
   * 获取分块上传状态
   * @param uploadId 上传 ID
   * @returns 上传状态，包含已上传的块和总块数
   */
  async chunkedUploadStatus(
    uploadId: string
  ): Promise<{ uploaded_parts: number[]; total_parts: number }> {
    const { data } = await api.get<{
      uploaded_parts: number[];
      total_parts: number;
    }>(`/api/files/upload/chunked/${uploadId}/status`);
    return data;
  },

  /**
   * 完成分块上传
   * @param uploadId 上传 ID
   * @param filename 文件名
   * @param mimeType 文件 MIME 类型
   * @returns 上传结果，包含文件元数据
   */
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

  /**
   * 中止分块上传
   * @param uploadId 上传 ID
   */
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
   * @param file 要上传的文件
   * @param onProgress 上传进度回调
   * @returns 上传结果，包含文件元数据
   */
  async uploadFileChunked(
    file: globalThis.File,
    onProgress?: (percent: number) => void
  ): Promise<{ file: FileMetadata }> {
    const mimeType = file.type || 'application/octet-stream';
    
    // 初始化分块上传
    const { upload_id, chunk_size, total_parts } = await this.chunkedUploadInit(
      file.name,
      mimeType,
      file.size
    );

    /**
     * 刷新已上传的块信息
     * @returns 已上传块的集合
     */
    const refreshUploaded = async (): Promise<Set<number>> => {
      const s = new Set<number>();
      try {
        const status = await this.chunkedUploadStatus(upload_id);
        status.uploaded_parts.forEach((p) => s.add(p));
      } catch {
        /* 忽略错误，返回空集合 */
      }
      return s;
    };

    // 获取已上传的块（支持断点续传）
    const uploaded = await refreshUploaded();
    let completedChunks = uploaded.size;

    /**
     * 报告上传进度
     */
    const report = () => {
      if (onProgress) {
        onProgress(Math.round((completedChunks / total_parts) * 100));
      }
    };

    // 初始报告（断点续传时显示已有进度）
    report();

    // 生成待上传的块列表
    const pendingParts = Array.from(
      { length: total_parts },
      (_, i) => i + 1
    ).filter((part) => !uploaded.has(part));

    /**
     * 上传单个文件块（带重试逻辑）
     * @param part 块序号
     */
    const uploadChunk = async (part: number): Promise<void> => {
      const start = (part - 1) * chunk_size;
      const end = Math.min(part * chunk_size, file.size);
      const blob = file.slice(start, end);

      // 带指数退避的重试逻辑
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
          if (attempt === CHUNKED_UPLOAD.MAX_RETRIES - 1) {
            throw e;
          }
          
          // 指数退避延迟
          const delay = CHUNKED_UPLOAD.RETRY_DELAY_BASE * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    };

    // 并行上传块（限制并发数）
    const parallelLimit = CHUNKED_UPLOAD.PARALLEL_CHUNKS;
    const chunks = [...pendingParts];
    
    while (chunks.length > 0) {
      // 每次处理一批块
      const batch = chunks.splice(0, parallelLimit);
      const results = await Promise.allSettled(batch.map(uploadChunk));
      
      // 检查是否有失败的块
      const firstFailure = results.find(
        (r): r is PromiseRejectedResult => r.status === 'rejected'
      );
      
      if (firstFailure) {
        throw firstFailure.reason;
      }
    }

    // 完成前验证所有块都已上传
    const finalStatus = await refreshUploaded();
    const missingParts = Array.from(
      { length: total_parts },
      (_, i) => i + 1
    ).filter((part) => !finalStatus.has(part));

    // 上传缺失的块（顺序执行）
    for (const part of missingParts) {
      await uploadChunk(part);
    }

    // 完成分块上传
    return this.chunkedUploadComplete(upload_id, file.name, mimeType);
  },

  /**
   * 下载文件
   * @param fileId 文件 ID
   * @param filename 文件名
   */
  async downloadFile(fileId: string, filename: string): Promise<void> {
    const response = await api.get<Blob>(`/api/files/${fileId}/download`, {
      responseType: 'blob',
    });
    downloadBlob(response.data, filename);
  },

  /**
   * 删除单个文件
   * @param fileId 文件 ID
   */
  async deleteFile(fileId: string): Promise<void> {
    await api.delete(`/api/files/${fileId}`);
  },

  /**
   * 批量删除文件
   * @param ids 文件 ID 列表
   * @returns 删除结果，包含删除的文件数
   */
  async batchDelete(ids: string[]): Promise<{ deleted: number }> {
    const response = await api.post<{ deleted: number; message: string }>(
      '/api/files/batch-delete',
      { ids }
    );
    return { deleted: response.data.deleted };
  },

  /**
   * 批量下载文件为 ZIP 包
   * 优先使用 File System Access API 进行流式下载，支持大文件
   * 降级方案使用传统的 Blob 下载方式
   * @param ids 文件 ID 列表
   */
  async downloadZip(ids: string[]): Promise<void> {
    const url = `${API_BASE_URL.replace(/\/$/, '')}/api/files/download-zip`;
    const token = useAuthStore.getState().token ?? localStorage.getItem('token');

    // 优先用 File System Access API：先弹保存对话框，再流式写入，保存框立即出现
    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      try {
        const handle = await (window as Window & { showSaveFilePicker: (opts?: { suggestedName?: string }) => Promise<FileSystemFileHandle> })
          .showSaveFilePicker({ suggestedName: 'files.zip' });
        
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ ids }),
        });
        
        if (!res.ok || !res.body) {
          throw new Error(res.statusText || 'Download failed');
        }
        
        const writable = await handle.createWritable();
        const reader = res.body.getReader();
        let streamError: unknown;
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            await writable.write(value);
          }
        } catch (e) {
          streamError = e;
          // 必须正确 close 才能让 Chrome 把临时文件 .crswap 替换成 files.zip
          // 出错时 abort 丢弃不完整文件
          try {
            if (streamError != null && typeof (writable as FileSystemWritableFileStream & { abort?: () => Promise<void> }).abort === 'function') {
              await (writable as FileSystemWritableFileStream & { abort: () => Promise<void> }).abort();
            } else {
              await writable.close();
            }
          } catch (closeErr) {
            // 避免 close/abort 的异常覆盖 streamError
            if (streamError == null) throw closeErr;
          }
          throw e;
        }
        
        return;
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') {
          return; // 用户取消选择
        }
        // 降级到 blob 方式
      }
    }

    // 传统 Blob 下载方式
    const response = await api.post<Blob>('/api/files/download-zip', { ids }, { responseType: 'blob' });
    downloadBlob(response.data, 'files.zip');
  },

  /**
   * 获取文件预览 URL
   * @param fileId 文件 ID
   * @returns 预览 URL
   */
  getPreviewUrl(fileId: string): string {
    return `${API_BASE_URL.replace(/\/$/, '')}/api/files/${fileId}/preview`;
  },

  /**
   * 带鉴权的预览 blob，供缩略图/预览用（img/iframe 无法带 Authorization）
   * @param fileId 文件 ID
   * @returns 预览 Blob 数据
   */
  async fetchPreviewBlob(fileId: string): Promise<Blob> {
    return previewQueue.run(async () => {
      const { data } = await api.get<Blob>(`/api/files/${fileId}/preview`, {
        responseType: 'blob',
      });
      return data;
    });
  },

  /**
   * 获取文件分类列表
   * @returns 分类列表
   */
  async getCategories(): Promise<string[]> {
    const response = await api.get<{ categories: string[] }>('/api/files/categories');
    return response.data.categories;
  },

  /**
   * 批量移动文件到指定分类
   * @param ids 文件 ID 列表
   * @param category 目标分类（null 表示无分类）
   * @returns 移动结果，包含移动的文件数
   */
  async batchMove(ids: string[], category: string | null): Promise<{ moved: number }> {
    const response = await api.post<{ moved: number; message: string }>(
      '/api/files/batch-move',
      { ids, category: category ?? '' }
    );
    return { moved: response.data.moved };
  },

  /**
   * 获取存储使用情况
   * @returns 存储使用情况信息
   */
  async getStorageUsage(): Promise<{
    total_size: number;          // 总文件大小（字节）
    file_count: number;          // 文件数量
    total_size_mb: number;       // 总文件大小（MB）
    quota: number | null;        // 存储配额（字节）
    quota_mb: number | null;     // 存储配额（MB）
    usage_percent: number | null; // 使用百分比
    is_unlimited: boolean;       // 是否无限制
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
