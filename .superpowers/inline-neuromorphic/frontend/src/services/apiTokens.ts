import api from './api';

export interface ApiToken {
  id: string;
  name: string;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  webdav_enabled: boolean;
  webdav_read_only: boolean;
  webdav_root_folder_id: string | null;
}

export interface UpdateApiTokenRequest {
  name?: string;
  webdav_enabled?: boolean;
  webdav_read_only?: boolean;
  webdav_root_folder_id?: string | null;
}

export interface CreateApiTokenRequest {
  name: string;
  expires_in_days?: number;
  webdav_enabled?: boolean;
  webdav_read_only?: boolean;
  webdav_root_folder_id?: string | null;
}

export interface CreateApiTokenResponse {
  token: {
    id: string;
    name: string;
    token: string; // Only shown once
    expires_at: string | null;
    created_at: string;
    webdav_enabled: boolean;
    webdav_read_only: boolean;
    webdav_root_folder_id: string | null;
  };
}

export interface ListApiTokensResponse {
  tokens: ApiToken[];
}

export interface WebDavAccessEvent {
  id: string;
  api_token_id: string | null;
  token_name: string | null;
  method: string;
  path: string;
  status_code: number;
  read_only: boolean;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface ListWebDavActivityResponse {
  events: WebDavAccessEvent[];
}

export interface WebDavStatusBuckets {
  "2xx": number;
  "3xx": number;
  "401": number;
  "403": number;
  "416": number;
  "423": number;
  "5xx": number;
  other: number;
}

export interface WebDavDiagnostic {
  token_id: string;
  token_name: string;
  webdav_enabled: boolean;
  webdav_read_only: boolean;
  webdav_root_folder_id: string | null;
  last_used_at: string | null;
  last_webdav_access_at: string | null;
  last_ip: string | null;
  last_user_agent: string | null;
  read_count: number;
  write_count: number;
  status_buckets: WebDavStatusBuckets;
}

export interface ListWebDavDiagnosticsResponse {
  diagnostics: WebDavDiagnostic[];
}

export interface CreateWebDavWizardTokenRequest {
  name?: string;
  webdav_read_only?: boolean;
  webdav_root_folder_id?: string | null;
}

export interface WebDavConnectionTestInput {
  serverUrl: string;
  username: string;
  token: string;
}

export const apiTokenService = {
  async listTokens(): Promise<ApiToken[]> {
    const response = await api.get<ListApiTokensResponse>('/api/tokens');
    return response.data.tokens;
  },

  async createToken(
    request: CreateApiTokenRequest
  ): Promise<CreateApiTokenResponse> {
    const response = await api.post<CreateApiTokenResponse>(
      '/api/tokens',
      request
    );
    return response.data;
  },

  async deleteToken(tokenId: string): Promise<void> {
    await api.delete(`/api/tokens/${tokenId}`);
  },

  async updateToken(
    tokenId: string,
    request: UpdateApiTokenRequest
  ): Promise<ApiToken> {
    const response = await api.patch<{ token: ApiToken }>(
      `/api/tokens/${tokenId}`,
      request
    );
    return response.data.token;
  },

  async createWebDavWizardToken(
    request?: CreateWebDavWizardTokenRequest
  ): Promise<CreateApiTokenResponse> {
    const response = await api.post<CreateApiTokenResponse>(
      '/api/tokens/webdav-wizard',
      request
    );
    return response.data;
  },

  async listWebDavActivity(): Promise<WebDavAccessEvent[]> {
    const response = await api.get<ListWebDavActivityResponse>(
      '/api/tokens/webdav-activity'
    );
    return response.data.events;
  },

  async listWebDavDiagnostics(): Promise<WebDavDiagnostic[]> {
    const response = await api.get<ListWebDavDiagnosticsResponse>(
      '/api/tokens/webdav-diagnostics'
    );
    return response.data.diagnostics;
  },

  async testWebDavConnection({
    serverUrl,
    username,
    token,
  }: WebDavConnectionTestInput): Promise<{ ok: boolean; status: number }> {
    const normalizedUrl = serverUrl.endsWith('/')
      ? serverUrl
      : `${serverUrl}/`;
    const response = await fetch(normalizedUrl, {
      method: 'PROPFIND',
      headers: {
        Authorization: `Basic ${window.btoa(`${username}:${token}`)}`,
        Depth: '0',
      },
    });
    return { ok: response.ok, status: response.status };
  },
};
