/**
 * 文件服务
 * 提供文件上传、下载、列表查询、预览等功能
 */
import axios from 'axios';
import api, { limitedApi } from './api';
import { buildQueryParams } from '../utils/queryParams';
import { downloadBlob } from '../utils/downloadBlob';
import { API_BASE_URL } from '../config/env';
import { CHUNKED_UPLOAD, REQUEST } from '../constants';
import { BatchRequestManager } from '../utils/batchRequest';
import { sha256FileHex } from '../utils/sha256';
import { useAuthStore } from '../store/authStore';
import type { FileMetadata, FileListResponse, FileListQuery } from '../types/files';
import { trackEvent, trackError } from '../utils/telemetry';

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

const previewBlobUrlCache = new Map<string, string>();

function cachePreviewBlobUrlInternal(fileId: string, url: string): void {
  const existing = previewBlobUrlCache.get(fileId);
  if (existing && existing !== url && existing.startsWith('blob:')) {
    URL.revokeObjectURL(existing);
  }
  previewBlobUrlCache.set(fileId, url);
}

function takePreviewBlobUrlInternal(fileId: string): string | undefined {
  const url = previewBlobUrlCache.get(fileId);
  if (url) previewBlobUrlCache.delete(fileId);
  return url;
}

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
   * 秒传：服务器已有相同内容（同 SHA-256 + 同大小）则直接创建记录，不传文件内容。
   * 未命中时后端返回 200 + { instant: false }（不再用 404），避免浏览器 console 标红。
   * @returns 201 时返回 { file }；200 + instant: false 时返回 null（需走普通/分片上传）
   */
  async uploadInstant(params: {
    content_sha256: string;
    filename: string;
    file_size: number;
    mime_type: string;
    folder_id?: string | null;
  }): Promise<{ file: FileMetadata } | null> {
    const res = await api.post<{ file?: FileMetadata; instant?: boolean }>(
      '/api/files/upload/instant',
      {
        content_sha256: params.content_sha256,
        filename: params.filename,
        file_size: params.file_size,
        mime_type: params.mime_type,
        folder_id: params.folder_id ?? null,
      },
      { validateStatus: (status) => status === 200 || status === 201 }
    );
    if (res.status === 200 && res.data?.instant === false) return null;
    if (res.data?.file) return { file: res.data.file };
    return null;
  },

  /**
   * 先秒传再普通/分片：计算文件 SHA-256，调秒传接口；404 时走普通或分片上传。
   * @param file 要上传的文件
   * @param onProgress 上传进度回调，可传 (percent, message?) 用于展示「秒传未命中，正在上传…」等提示
   */
  async uploadFileWithInstant(
    file: globalThis.File,
    onProgress?: (percent: number, message?: string) => void,
    folderId?: string | null
  ): Promise<{ file: FileMetadata }> {
    const startedAt = performance.now();
    const useChunked =
      file.type.startsWith('video/') || file.size >= this.CHUNK_THRESHOLD;

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
      let result: { file: FileMetadata } | null = null;
      try {
        result = await this.uploadInstant({
          content_sha256,
          filename: file.name,
          file_size: file.size,
          mime_type: mime,
          folder_id: folderId ?? null,
        });
      } catch (instantErr) {
        trackError(instantErr, {
          action: 'upload_instant_failed',
          fileSize: file.size,
        });
      }
      if (result === null) {
        console.info('[秒传] 服务器暂无相同文件，将走普通/分片上传');
        onProgress?.(0, '秒传未命中，正在上传…');
        const progressOnly = (p: number) => onProgress?.(p);
        const uploaded = await (useChunked
          ? this.uploadFileChunked(file, progressOnly, folderId)
          : this.uploadFile(file, progressOnly, folderId));

        trackEvent({
          eventType: 'upload',
          action: 'upload_with_instant',
          status: 'success',
          fileId: uploaded.file.id,
          fileSize: file.size,
          durationMs: Math.round(performance.now() - startedAt),
        });
        return uploaded;
      }

      onProgress?.(100);
      trackEvent({
        eventType: 'upload',
        action: 'upload_with_instant',
        status: 'success',
        fileId: result.file.id,
        fileSize: file.size,
        durationMs: Math.round(performance.now() - startedAt),
        extra: { mode: 'instant' },
      });
      return result;
    } catch (err) {
      trackError(err, {
        action: 'upload_with_instant',
        fileSize: file.size,
      });
      throw err;
    }
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
    onProgress?: (percent: number) => void,
    folderId?: string | null
  ): Promise<{ file: FileMetadata }> {
    const formData = new FormData();
    formData.append('file', file);
    if (folderId) {
      formData.append('folder_id', folderId);
    }

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
    mimeType: string,
    folderId?: string | null
  ): Promise<{ file: FileMetadata }> {
    const { data } = await api.post<{ file: FileMetadata }>(
      `/api/files/upload/chunked/${uploadId}/complete`,
      { filename, mime_type: mimeType, folder_id: folderId ?? null }
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
    onProgress?: (percent: number) => void,
    folderId?: string | null
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
    return this.chunkedUploadComplete(upload_id, file.name, mimeType, folderId);
  },

  /**
   * 下载文件
   * @param fileId 文件 ID
   * @param filename 文件名
   */
  async downloadFile(fileId: string, filename: string): Promise<void> {
    const startedAt = performance.now();
    trackEvent({
      eventType: 'download',
      action: 'download_file',
      status: 'start',
      fileId,
    });

    try {
      const response = await api.get<Blob>(`/api/files/${fileId}/download`, {
        responseType: 'blob',
      });
      downloadBlob(response.data, filename);

      trackEvent({
        eventType: 'download',
        action: 'download_file',
        status: 'success',
        fileId,
        durationMs: Math.round(performance.now() - startedAt),
      });
    } catch (err) {
      trackError(err, {
        action: 'download_file',
        fileId,
      });
      throw err;
    }
  },

  /**
   * 获取文件完整内容为 Blob（用于客户端侧自行解析 ZIP 等场景）
   */
  async getFileAsBlob(
    fileId: string,
    options?: { signal?: AbortSignal }
  ): Promise<Blob> {
    const { data } = await api.get<Blob>(`/api/files/${fileId}/download`, {
      responseType: 'blob',
      signal: options?.signal,
    });
    return data;
  },

  /**
   * 使用 Range 请求获取文件指定字节范围。
   * @param fileId 文件 ID
   * @param start 起始字节位置（包含）
   * @param end 结束字节位置（包含）
   * @param options 可选配置
   * @returns 指定范围的 Blob
   */
  async getFileRange(
    fileId: string,
    start: number,
    end: number,
    options?: { signal?: AbortSignal }
  ): Promise<Blob> {
    const { data } = await api.get<Blob>(`/api/files/${fileId}/download`, {
      responseType: 'blob',
      headers: {
        Range: `bytes=${start}-${end}`,
      },
      signal: options?.signal,
    });
    return data;
  },

  /**
   * 获取文件大小（通过 HEAD 请求）
   */
  async getFileSize(fileId: string): Promise<number> {
    const response = await api.head(`/api/files/${fileId}/download`);
    const contentLength = response.headers['content-length'];
    if (!contentLength) {
      throw new Error('无法获取文件大小');
    }
    return parseInt(contentLength, 10);
  },

  /**
   * 删除单个文件
   * @param fileId 文件 ID
   */
  async deleteFile(fileId: string): Promise<void> {
    await api.delete(`/api/files/${fileId}`);
  },

  /**
   * 重命名文件
   * @param fileId 文件 ID
   * @param name 新名称
   */
  async renameFile(fileId: string, name: string): Promise<FileMetadata> {
    const response = await api.put<{ file: FileMetadata }>(`/api/files/${fileId}`, {
      name,
    });
    return response.data.file;
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
   *
   * 修复：
   * - 成功路径必须调用 writable.close()，否则 Chrome 不会把临时文件替换成 files.zip
   * - 使用 finally 确保正确关闭/中止
   *
   * @param ids 文件 ID 列表
   */
  async downloadZip(ids: string[]): Promise<void> {
    const url = `${API_BASE_URL.replace(/\/$/, '')}/api/files/download-zip`;
    const token = useAuthStore.getState().token ?? localStorage.getItem('token');

    // 优先用 File System Access API：先弹保存对话框，再流式写入，保存框立即出现
    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      let writable: FileSystemWritableFileStream | null = null;
      let hasError = false;

      try {
        // 1. 立即弹出保存对话框（用户选择保存位置）
        const handle = await (
          window as Window & {
            showSaveFilePicker: (opts?: {
              suggestedName?: string;
              types?: Array<{ description?: string; accept?: Record<string, string[]> }>;
            }) => Promise<FileSystemFileHandle>;
          }
        ).showSaveFilePicker({
          suggestedName: 'files.zip',
          types: [
            {
              description: 'ZIP Archive',
              accept: { 'application/zip': ['.zip'] },
            },
          ],
        });

        // 2. 用户选择保存位置后，开始请求后端
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ ids }),
        });

        if (!res.ok) {
          // 尝试读取错误信息
          let errorMessage = res.statusText || 'Download failed';
          try {
            const errorData = await res.json();
            if (errorData.error) errorMessage = errorData.error;
          } catch {
            // 忽略 JSON 解析错误
          }
          throw new Error(errorMessage);
        }

        if (!res.body) {
          throw new Error('Response body is empty');
        }

        // 3. 创建可写流
        writable = await handle.createWritable();
        const reader = res.body.getReader();

        // 4. 流式写入
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await writable.write(value);
        }

        // 5. 成功完成，关闭流（这会把临时文件替换成 files.zip）
        await writable.close();
        writable = null; // 标记已关闭，防止 finally 重复关闭
        return;
      } catch (e) {
        hasError = true;

        if (e instanceof Error && e.name === 'AbortError') {
          return; // 用户取消选择保存位置
        }

        // 如果已经创建了 writable，需要中止
        if (writable) {
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
            // 忽略关闭错误
          }
          writable = null;
        }

        // 如果是网络错误或服务器错误，降级到 blob 方式
        console.warn('File System Access API failed, falling back to blob download:', e);
      } finally {
        // 确保 writable 被关闭（防止遗漏）
        if (writable && !hasError) {
          try {
            await writable.close();
          } catch {
            // 忽略关闭错误
          }
        }
      }
    }

    // 降级：传统 Blob 下载方式（Firefox/Safari 或 File System Access API 失败时）
    // 注意：这种方式需要等待整个文件下载完成后才会弹出保存框
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
   * 获取 GIF 视频预览 URL（后端按需将 GIF 转码为 mp4）
   */
  getGifVideoPreviewUrl(fileId: string): string {
    return `${API_BASE_URL.replace(/\/$/, '')}/api/files/${fileId}/preview/video`;
  },

  /**
   * 触发 GIF/Ugoira 视频预览转码（不阻塞，后端可能启动后台任务）
   */
  async prepareVideoPreview(fileId: string): Promise<'ready' | 'processing'> {
    const { data } = await api.post<{ status: 'ready' | 'processing' }>(
      `/api/files/${fileId}/preview/video/prepare`
    );
    return data.status;
  },

  /**
   * 查询 GIF/Ugoira 视频预览转码状态（前端轮询使用）
   */
  async getVideoPreviewStatus(fileId: string): Promise<'processing' | 'ready'> {
    const { data } = await api.get<{ status: 'processing' | 'ready' }>(
      `/api/files/${fileId}/preview/video/status`
    );
    return data.status;
  },

  /** 超大视频 HLS 列表 URL（>100MB 时后端转码为 .m3u8 + ts，供 hls.js 播放） */
  getHlsUrl(fileId: string): string {
    return `${API_BASE_URL.replace(/\/$/, '')}/api/files/${fileId}/hls`;
  },

  async prepareHlsPreview(
    fileId: string
  ): Promise<'ready' | 'processing' | 'unsupported'> {
    const { data } = await api.post<{ status: 'ready' | 'processing' | 'unsupported' }>(
      `/api/files/${fileId}/hls/prepare`
    );
    return data.status;
  },

  async getHlsPreviewStatus(
    fileId: string
  ): Promise<'ready' | 'processing' | 'unsupported'> {
    const { data } = await api.get<{ status: 'ready' | 'processing' | 'unsupported' }>(
      `/api/files/${fileId}/hls/status`
    );
    return data.status;
  },

  getThumbnailUrl(
    fileId: string,
    options?: { width?: number; token?: string | null }
  ): string {
    const base = `${API_BASE_URL.replace(/\/$/, '')}/api/files/${fileId}/thumbnail`;
    const params = new URLSearchParams();
    if (options?.width) params.set('w', String(options.width));
    if (options?.token) params.set('token', options.token);
    const query = params.toString();
    return query ? `${base}?${query}` : base;
  },

  /**
   * 获取图片缩略图 Blob（仅 image/*，列表卡片用，压缩后体积小）
   * @param fileId 文件 ID
   * @param options 可选配置（支持 AbortSignal、width 最长边像素，默认 400）
   * @returns 缩略图 Blob（JPEG），404/415 时返回 null（无缩略图，前端显示占位）
   */
  async fetchThumbnailBlob(
    fileId: string,
    options?: { signal?: AbortSignal; width?: number }
  ): Promise<Blob | null> {
    return previewQueue.run(async () => {
      const w = options?.width ?? 400;
      const doFetch = async () => {
        const res = await api.get<Blob>(`/api/files/${fileId}/thumbnail?w=${w}`, {
          responseType: 'blob',
          signal: options?.signal,
          validateStatus: (s) => s < 400 || s === 404 || s === 415,
        });
        if (res.status === 404 || res.status === 415) return null;
        return res.data;
      };
      try {
        return await doFetch();
      } catch (err) {
        const status = axios.isAxiosError(err) ? err.response?.status : undefined;
        if (status === 404 || status === 415) return null;
        if (
          axios.isAxiosError(err) &&
          err.response?.status === 429 &&
          !options?.signal?.aborted
        ) {
          await new Promise((r) => setTimeout(r, 2000));
          return await doFetch();
        }
        throw err;
      }
    });
  },

  /**
   * 获取文件预览 Blob
   * @param fileId 文件 ID
   * @param options 可选配置（支持 AbortSignal 用于取消）
   * @returns 预览 Blob
   */
  async fetchPreviewBlob(
    fileId: string,
    options?: { signal?: AbortSignal }
  ): Promise<Blob> {
    return previewQueue.run(async () => {
      const doFetch = () =>
        api.get<Blob>(`/api/files/${fileId}/preview`, {
          responseType: 'blob',
          signal: options?.signal,
        });
      try {
        const { data } = await doFetch();
        return data;
      } catch (err) {
        // 429 时重试一次（延迟 2s），避免缩略图/预加载集中请求被限流后直接失败
        if (
          axios.isAxiosError(err) &&
          err.response?.status === 429 &&
          !options?.signal?.aborted
        ) {
          await new Promise((r) => setTimeout(r, 2000));
          const { data } = await doFetch();
          return data;
        }
        throw err;
      }
    });
  },

  cachePreviewBlobUrl(fileId: string, url: string): void {
    cachePreviewBlobUrlInternal(fileId, url);
  },

  takeCachedPreviewBlobUrl(fileId: string): string | undefined {
    return takePreviewBlobUrlInternal(fileId);
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
