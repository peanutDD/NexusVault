/**
 * API 通用类型定义
 */

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

/**
 * 错误详情类型
 */
export interface ErrorDetails {
  message: string;
  code?: string;
  field?: string;
  details?: Record<string, unknown>;
}
