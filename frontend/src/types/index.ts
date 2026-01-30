/**
 * 集中式类型定义文件
 * 包含应用中所有共享的类型定义
 */

/**
 * 文件元数据类型
 */
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

/**
 * 文件夹类型
 */
export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 文件列表响应类型
 */
export interface FileListResponse {
  files: FileMetadata[];
  total: number;
}

/**
 * 文件列表查询参数类型
 */
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
  sort_by?: 'created_at' | 'filename' | 'file_size';
  sort_order?: 'asc' | 'desc';
}

/**
 * 用户类型
 */
export interface User {
  id: string;
  username: string;
  email: string;
  created_at: string;
}

/**
 * 错误详情类型
 */
export interface ErrorDetails {
  message: string;
  code?: string;
  field?: string;
  details?: Record<string, unknown>;
}

/**
 * 浏览器信息类型
 */
export interface BrowserInfo {
  name: string;
  version: number;
  isSupported: boolean;
}

/**
 * 上传队列项类型
 */
export interface QueueItem<T = unknown> {
  id: string;
  task: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
  priority: number;
  cost: number;
}

/**
 * 缓存的文件列表类型
 */
export interface CachedFileList {
  version: number;
  files: FileMetadata[];
  total: number;
  timestamp: number;
  queryKey: string;
}

/**
 * 分块上传初始化响应类型
 */
export interface ChunkedUploadInitResponse {
  upload_id: string;
  chunk_size: number;
  total_parts: number;
}

/**
 * 分块上传状态响应类型
 */
export interface ChunkedUploadStatusResponse {
  uploaded_parts: number[];
  total_parts: number;
}

/**
 * 批量操作响应类型
 */
export interface BatchOperationResponse {
  deleted?: number;
  moved?: number;
  message?: string;
}

/**
 * 存储使用情况类型
 */
export interface StorageUsage {
  total_size: number;
  file_count: number;
  total_size_mb: number;
  quota: number | null;
  quota_mb: number | null;
  usage_percent: number | null;
  is_unlimited: boolean;
}

/**
 * 分类类型
 */
export interface Category {
  id: string;
  name: string;
  created_at: string;
}

/**
 * API 响应基础类型
 */
export interface ApiResponse<T = unknown> {
  data: T;
  message?: string;
  success: boolean;
}

/**
 * 分页参数类型
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * 排序参数类型
 */
export interface SortParams {
  sort_by: string;
  sort_order: 'asc' | 'desc';
}

/**
 * 过滤参数类型
 */
export interface FilterParams {
  search?: string;
  mime_type?: string;
  category?: string;
  folder_id?: string | null;
  date_from?: string;
  date_to?: string;
  size_min?: number;
  size_max?: number;
}
