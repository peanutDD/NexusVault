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

export interface ManagedShare {
  id: string;
  file_id: string;
  filename: string;
  share_token: string;
  url?: string;
  expires_at: string | null;
  max_downloads: number | null;
  download_count: number;
  access_count: number;
  has_password: boolean;
  status: 'active' | 'expired' | 'limited';
  created_at: string;
  updated_at: string;
}

export interface ShareAccessEvent {
  id: string;
  share_id: string;
  event_type: 'access' | 'download';
  status: string;
  created_at: string;
}

export interface UpdateShareRequest {
  expires_at?: string | null;
  max_downloads?: number | null;
  password?: string | null;
  clear_password?: boolean;
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

  async listManagedShares(): Promise<ManagedShare[]> {
    const response = await api.get<{ shares: ManagedShare[] }>('/api/shares');
    return response.data.shares;
  },

  async updateShare(shareId: string, data: UpdateShareRequest): Promise<ManagedShare> {
    const response = await api.patch<{ share: ManagedShare }>(`/api/shares/${shareId}`, data);
    return response.data.share;
  },

  async listShareEvents(shareId: string): Promise<ShareAccessEvent[]> {
    const response = await api.get<{ events: ShareAccessEvent[] }>(`/api/shares/${shareId}/events`);
    return response.data.events;
  },
};
