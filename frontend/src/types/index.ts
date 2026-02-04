/**
 * 集中式类型定义文件
 * 统一导出所有类型定义
 */

// API 通用类型
export type {
  ApiResponse,
  PaginationParams,
  SortParams,
  FilterParams,
  ErrorDetails,
} from './api';

// 认证相关类型
export type {
  User,
  RegisterRequest,
  LoginRequest,
  AuthResponse,
} from './auth';

// 文件相关类型
export type {
  FileMetadata,
  FileListResponse,
  FileListQuery,
  QueueItem,
  CachedFileList,
  ChunkedUploadInitResponse,
  ChunkedUploadStatusResponse,
  BatchOperationResponse,
  StorageUsage,
  Category,
} from './files';

// 文件夹相关类型
export type {
  Folder,
  FolderPathResponse,
  FolderContentsResponse,
  CreateFolderRequest,
  MoveFilesToFolderRequest,
} from './folders';

// 浏览器相关类型
export type { BrowserInfo } from './browser';
