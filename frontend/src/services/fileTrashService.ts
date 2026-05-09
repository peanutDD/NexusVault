import api from './api';
import type { FileMetadata, TrashListResponse } from '../types/files';

export type BatchTrashFailure = {
  id: string;
  message: string;
};

export type BatchRestoreResponse = {
  restored: number;
  failed: BatchTrashFailure[];
};

export type BatchPermanentDeleteResponse = {
  deleted: number;
  failed: BatchTrashFailure[];
};

export const fileTrashService = {
  async listTrash(): Promise<TrashListResponse> {
    const response = await api.get<TrashListResponse>('/api/files/trash');
    return response.data;
  },

  async restoreFile(fileId: string): Promise<FileMetadata> {
    const response = await api.post<{ file: FileMetadata }>(`/api/files/${fileId}/restore`);
    return response.data.file;
  },

  async batchRestoreFiles(fileIds: string[]): Promise<BatchRestoreResponse> {
    const response = await api.post<BatchRestoreResponse>('/api/files/trash/batch-restore', {
      ids: fileIds,
    });
    return response.data;
  },

  async permanentlyDeleteFile(fileId: string): Promise<void> {
    await api.delete(`/api/files/${fileId}/permanent`);
  },

  async batchPermanentlyDeleteFiles(
    fileIds: string[],
  ): Promise<BatchPermanentDeleteResponse> {
    const response = await api.post<BatchPermanentDeleteResponse>(
      '/api/files/trash/batch-permanent',
      { ids: fileIds },
    );
    return response.data;
  },

  async emptyTrash(): Promise<{ deleted: number }> {
    const response = await api.delete<{ deleted: number; message: string }>('/api/files/trash');
    return { deleted: response.data.deleted };
  },
};
