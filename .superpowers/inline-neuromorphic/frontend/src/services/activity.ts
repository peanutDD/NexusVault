import api from "./api";

export interface ActivityEvent {
  id: string;
  user_id: string;
  actor_type: string;
  actor_user_id: string | null;
  source: string;
  event_type: string;
  target_type: string;
  file_id: string | null;
  folder_id: string | null;
  share_id: string | null;
  file_request_id: string | null;
  api_token_id: string | null;
  status: number | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ActivityListParams {
  cursor?: string | null;
  limit?: number;
  source?: string;
  event_type?: string;
  target_type?: string;
  file_id?: string;
  folder_id?: string;
  share_id?: string;
  file_request_id?: string;
  api_token_id?: string;
  date_from?: string;
  date_to?: string;
}

export interface ActivityListResponse {
  events: ActivityEvent[];
  next_cursor: string | null;
}

function compactParams(params: ActivityListParams = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    ),
  );
}

export const activityService = {
  async list(params: ActivityListParams = {}): Promise<ActivityListResponse> {
    const response = await api.get<ActivityListResponse>("/api/activity", {
      params: compactParams(params),
    });
    return response.data;
  },

  async listFile(
    fileId: string,
    params: Omit<ActivityListParams, "file_id"> = {},
  ): Promise<ActivityListResponse> {
    const response = await api.get<ActivityListResponse>(
      `/api/files/${fileId}/activity`,
      { params: compactParams(params) },
    );
    return response.data;
  },
};
