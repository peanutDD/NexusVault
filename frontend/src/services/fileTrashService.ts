import api from './api';
import type { FileMetadata, TrashListResponse } from '../types/files';

export const fileTrashService = {
  async listTrash(): Promise<TrashListResponse> {
    const response = await api.get<TrashListResponse>('/api/files/trash');
    return response.data;
  },

  async restoreFile(fileId: string): Promise<FileMetadata> {
    const response = await api.post<{ file: FileMetadata }>(`/api/files/${fileId}/restore`);
    return response.data.file;
  },

  async permanentlyDeleteFile(fileId: string): Promise<void> {
    await api.delete(`/api/files/${fileId}/permanent`);
  },

  async emptyTrash(): Promise<{ deleted: number }> {
    const response = await api.delete<{ deleted: number; message: string }>('/api/files/trash');
    return { deleted: response.data.deleted };
  },
};
