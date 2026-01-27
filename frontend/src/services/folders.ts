import api from './api';

/**
 * 文件夹数据结构
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

/**
 * 文件夹服务
 */
export const folderService = {
  /**
   * 列出文件夹
   * @param parentId 父文件夹 ID（不传表示根目录）
   */
  async list(parentId?: string | null): Promise<Folder[]> {
    const params = new URLSearchParams();
    if (parentId) {
      params.set('parent_id', parentId);
    }
    const url = params.toString()
      ? `/api/folders?${params.toString()}`
      : '/api/folders';
    const response = await api.get<{ folders: Folder[] }>(url);
    return response.data.folders;
  },

  /**
   * 获取文件夹内容（子文件夹 + 路径）
   * @param folderId 文件夹 ID（不传表示根目录）
   */
  async getContents(folderId?: string | null): Promise<FolderContentsResponse> {
    const params = new URLSearchParams();
    if (folderId) {
      params.set('parent_id', folderId);
    }
    const url = params.toString()
      ? `/api/folders/contents?${params.toString()}`
      : '/api/folders/contents';
    const response = await api.get<FolderContentsResponse>(url);
    return response.data;
  },

  /**
   * 创建文件夹
   * @param name 文件夹名称
   * @param parentId 父文件夹 ID（不传表示根目录）
   */
  async create(name: string, parentId?: string | null): Promise<Folder> {
    const response = await api.post<{ folder: Folder }>('/api/folders', {
      name,
      parent_id: parentId || null,
    });
    return response.data.folder;
  },

  /**
   * 获取文件夹详情
   * @param id 文件夹 ID
   */
  async get(id: string): Promise<Folder> {
    const response = await api.get<{ folder: Folder }>(`/api/folders/${id}`);
    return response.data.folder;
  },

  /**
   * 获取文件夹路径（面包屑导航）
   * @param id 文件夹 ID
   */
  async getPath(id: string): Promise<Folder[]> {
    const response = await api.get<FolderPathResponse>(
      `/api/folders/${id}/path`
    );
    return response.data.path;
  },

  /**
   * 重命名文件夹
   * @param id 文件夹 ID
   * @param name 新名称
   */
  async rename(id: string, name: string): Promise<Folder> {
    const response = await api.put<{ folder: Folder }>(`/api/folders/${id}`, {
      name,
    });
    return response.data.folder;
  },

  /**
   * 删除文件夹
   * @param id 文件夹 ID
   * @returns 受影响的文件数量
   */
  async delete(id: string): Promise<number> {
    const response = await api.delete<{ affected_files: number }>(
      `/api/folders/${id}`
    );
    return response.data.affected_files;
  },

  /**
   * 移动文件夹
   * @param id 文件夹 ID
   * @param newParentId 新的父文件夹 ID（null 表示根目录）
   */
  async move(id: string, newParentId: string | null): Promise<Folder> {
    const response = await api.post<{ folder: Folder }>(
      `/api/folders/${id}/move`,
      { parent_id: newParentId }
    );
    return response.data.folder;
  },

  /**
   * 批量移动文件到文件夹
   * @param fileIds 文件 ID 列表
   * @param folderId 目标文件夹 ID（null 表示根目录）
   * @returns 移动的文件数量
   */
  async moveFilesToFolder(
    fileIds: string[],
    folderId: string | null
  ): Promise<number> {
    const response = await api.post<{ moved: number }>(
      '/api/folders/move-files',
      {
        file_ids: fileIds,
        folder_id: folderId,
      }
    );
    return response.data.moved;
  },
};
