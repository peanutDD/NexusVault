import api from './api';
import type {
  Folder,
  FolderPathResponse,
  FolderContentsResponse,
} from '../types';

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

  /**
   * 获取文件夹内所有文件 ID（递归）
   * @param folderIds 文件夹 ID 列表
   * @returns 所有文件 ID 列表
   */
  async getFilesInFolders(folderIds: string[]): Promise<string[]> {
    if (folderIds.length === 0) return [];
    const response = await api.post<{ file_ids: string[] }>(
      '/api/folders/files-in-folders',
      { folder_ids: folderIds }
    );
    return response.data.file_ids;
  },

  /**
   * 批量移动文件夹
   * @param folderIds 文件夹 ID 列表
   * @param targetFolderId 目标文件夹 ID（null 表示根目录）
   * @returns 移动成功的数量
   */
  async moveFolders(
    folderIds: string[],
    targetFolderId: string | null
  ): Promise<number> {
    let moved = 0;
    for (const folderId of folderIds) {
      try {
        await this.move(folderId, targetFolderId);
        moved++;
      } catch {
        // 忽略单个失败，继续处理其他文件夹
      }
    }
    return moved;
  },
};
