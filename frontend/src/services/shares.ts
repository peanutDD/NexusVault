import api from './api';

export interface CreateShareRequest {
  file_id: string;
  password?: string;
  expires_in_days?: number;
  max_downloads?: number;
}

export interface ShareResponse {
  share: {
    id: string;
    url: string;
    token: string;
    expires_at: string | null;
    max_downloads: number | null;
  };
}

export interface BatchShareRequest {
  file_ids: string[];
  password?: string;
  expires_in_days?: number;
  max_downloads?: number;
}

export interface BatchShareResponse {
  shares: Array<{
    id: string;
    url: string;
    token: string;
    expires_at: string | null;
    max_downloads: number | null;
  }>;
  failed: string[];
  message: string;
}

export const shareService = {
  async createShare(data: CreateShareRequest): Promise<ShareResponse> {
    const response = await api.post<ShareResponse>('/api/shares', data);
    return response.data;
  },

  async batchCreateShare(data: BatchShareRequest): Promise<BatchShareResponse> {
    const response = await api.post<BatchShareResponse>('/api/shares/batch', data);
    return response.data;
  },

  async deleteShare(shareId: string): Promise<void> {
    await api.delete(`/api/shares/${shareId}`);
  },
};
