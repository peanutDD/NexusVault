import api from "./api";
import { useAuthStore } from "../store/authStore";

export interface FileRequestLink {
  id: string;
  folder_id: string | null;
  folder_name?: string | null;
  title: string;
  description: string | null;
  allowed_mime_prefixes: string[];
  max_file_size: number | null;
  max_uploads: number | null;
  upload_count: number;
  expires_at: string | null;
  revoked_at: string | null;
  token_prefix: string;
  public_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FileRequestUpload {
  id: string;
  request_id: string;
  submission_id?: string | null;
  file_id: string;
  filename: string;
  file_size: number;
  mime_type: string;
  status: string;
  reviewed_at?: string | null;
  reviewer_user_id?: string | null;
  review_note?: string | null;
  scan_status?: string;
  scan_message?: string | null;
  folder_id?: string | null;
  folder_name?: string | null;
  created_at: string;
}

export interface FileRequestSubmission {
  id: string;
  request_id: string;
  request_title?: string;
  request_folder_id?: string | null;
  request_folder_name?: string | null;
  submitter_email: string | null;
  submitter_note: string | null;
  file_count: number;
  created_at: string;
  uploads: FileRequestUpload[];
}

export interface PublicFileRequest {
  title: string;
  description: string | null;
  allowed_mime_prefixes: string[];
  max_file_size: number | null;
  max_uploads: number | null;
  upload_count: number;
  expires_at: string | null;
}

export interface CreateFileRequestLinkInput {
  folder_id?: string | null;
  title: string;
  description?: string | null;
  allowed_mime_prefixes?: string[];
  max_file_size?: number | null;
  max_uploads?: number | null;
  expires_in_days?: number | null;
}

export interface PublicFileRequestUploadResult {
  submission: {
    id: string;
    request_id: string;
    submitter_email: string | null;
    submitter_note: string | null;
    file_count: number;
  };
  message?: string;
}

export interface ReviewFileRequestUploadInput {
  action: "approve" | "reject";
  filename?: string;
  folder_id?: string | null;
  review_note?: string;
}

function unwrapRequest<T>(data: { request?: T; file_request?: T }): T {
  const request = data.request ?? data.file_request;
  if (!request) {
    throw new Error("File Request payload is missing request data");
  }
  return request;
}

function rebasePublicRequestUrl(publicUrl: string | null | undefined): string | null | undefined {
  if (!publicUrl || typeof window === "undefined") {
    return publicUrl;
  }
  try {
    const resolved = new URL(publicUrl, window.location.origin);
    if (!resolved.pathname.startsWith("/request/")) {
      return publicUrl;
    }
    return `${window.location.origin}${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return publicUrl;
  }
}

function normalizeFileRequestLink(link: FileRequestLink): FileRequestLink {
  return {
    ...link,
    public_url: rebasePublicRequestUrl(link.public_url),
  };
}

function getAuthToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return useAuthStore.getState().token ?? localStorage.getItem("token");
}

function withQueryToken(url: string): string {
  const token = getAuthToken();
  if (!token) {
    return url;
  }
  const joiner = url.includes("?") ? "&" : "?";
  return `${url}${joiner}token=${encodeURIComponent(token)}`;
}

export const fileRequestService = {
  async create(data: CreateFileRequestLinkInput): Promise<FileRequestLink> {
    const response = await api.post<{ request?: FileRequestLink; file_request?: FileRequestLink }>(
      "/api/file-requests",
      data,
    );
    return normalizeFileRequestLink(unwrapRequest(response.data));
  },

  async list(): Promise<FileRequestLink[]> {
    const response = await api.get<{
      requests?: FileRequestLink[];
      file_requests?: FileRequestLink[];
    }>("/api/file-requests");
    return (response.data.requests ?? response.data.file_requests ?? []).map(normalizeFileRequestLink);
  },

  async update(id: string, data: Partial<CreateFileRequestLinkInput> & { revoked?: boolean }): Promise<FileRequestLink> {
    const response = await api.patch<{ request?: FileRequestLink; file_request?: FileRequestLink }>(
      `/api/file-requests/${id}`,
      data,
    );
    return normalizeFileRequestLink(unwrapRequest(response.data));
  },

  async uploads(id: string): Promise<FileRequestUpload[]> {
    const response = await api.get<{ uploads: FileRequestUpload[] }>(`/api/file-requests/${id}/uploads`);
    return response.data.uploads;
  },

  async inbox(params: {
    status?: string;
    request_id?: string;
    cursor?: string;
    limit?: number;
  } = {}): Promise<{ submissions: FileRequestSubmission[]; next_cursor: string | null }> {
    const response = await api.get<{
      submissions: FileRequestSubmission[];
      next_cursor: string | null;
    }>("/api/file-requests/inbox", { params });
    return response.data;
  },

  async reviewUpload(id: string, data: ReviewFileRequestUploadInput): Promise<FileRequestUpload> {
    const response = await api.patch<{ upload: FileRequestUpload }>(
      `/api/file-requests/uploads/${encodeURIComponent(id)}/review`,
      data,
    );
    return response.data.upload;
  },

  previewUploadUrl(id: string): string {
    return withQueryToken(`/api/file-requests/uploads/${encodeURIComponent(id)}/preview`);
  },

  previewApprovedFileUrl(id: string): string {
    return withQueryToken(`/api/files/${encodeURIComponent(id)}/preview`);
  },

  downloadUploadUrl(id: string): string {
    return withQueryToken(`/api/file-requests/uploads/${encodeURIComponent(id)}/download`);
  },

  async getPublic(token: string): Promise<PublicFileRequest> {
    const response = await api.get<{ request?: PublicFileRequest; file_request?: PublicFileRequest }>(
      `/api/file-requests/public/${encodeURIComponent(token)}`,
    );
    return unwrapRequest(response.data);
  },

  async uploadPublic(
    token: string,
    files: File | File[],
    metadata: { submitter_email?: string; submitter_note?: string } = {},
  ): Promise<PublicFileRequestUploadResult> {
    const form = new FormData();
    if (metadata.submitter_email) form.append("submitter_email", metadata.submitter_email);
    if (metadata.submitter_note) form.append("submitter_note", metadata.submitter_note);
    for (const file of Array.isArray(files) ? files : [files]) {
      form.append("file", file);
    }
    const response = await api.post<PublicFileRequestUploadResult>(
      `/api/file-requests/public/${encodeURIComponent(token)}/upload`,
      form,
    );
    return response.data;
  },
};
