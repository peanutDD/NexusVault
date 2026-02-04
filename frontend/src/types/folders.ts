/**
 * 文件夹相关类型定义
 */

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
 * 文件夹路径响应
 */
export interface FolderPathResponse {
  path: Folder[];
}

/**
 * 文件夹内容响应（用于导航）
 */
export interface FolderContentsResponse {
  current: Folder | null;
  path: Folder[];
  folders: Folder[];
}

/**
 * 创建文件夹请求
 */
export interface CreateFolderRequest {
  name: string;
  parent_id?: string | null;
}

/**
 * 移动文件到文件夹请求
 */
export interface MoveFilesToFolderRequest {
  file_ids: string[];
  folder_id: string | null;
}
