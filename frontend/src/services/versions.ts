import api from "./api";
import { apiPath } from "../config/env";
import type { FileVersionsResponse } from "../types/files";

export const fileVersionService = {
  async list(fileId: string): Promise<FileVersionsResponse> {
    const response = await api.get<FileVersionsResponse>(`/api/files/${fileId}/versions`);
    return response.data;
  },

  downloadUrl(versionId: string): string {
    return apiPath(`/files/versions/${encodeURIComponent(versionId)}/download`);
  },

  previewUrl(versionId: string): string {
    return apiPath(`/files/versions/${encodeURIComponent(versionId)}/preview`);
  },

  async diff(fileId: string, versionId: string): Promise<string> {
    const response = await api.get<{ diff: string }>(
      `/api/files/${fileId}/versions/${versionId}/diff?against=current`,
    );
    return response.data.diff;
  },

  async updateLabel(versionId: string, label: string): Promise<void> {
    await api.put(`/api/files/versions/${versionId}/label`, { label: label.trim() || null });
  },

  async restore(fileId: string, versionId: string): Promise<void> {
    await api.post(`/api/files/${fileId}/versions/${versionId}/restore`, {
      keep_current: true,
    });
  },

  async remove(versionId: string): Promise<void> {
    await api.delete(`/api/files/versions/${versionId}`);
  },
};
