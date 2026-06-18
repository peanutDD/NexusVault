import api from "./api";
import type { FileTag } from "../types/files";

export const tagsService = {
  async list(): Promise<FileTag[]> {
    const response = await api.get<{ tags: FileTag[] }>("/api/tags");
    return response.data.tags;
  },

  async create(input: { name: string; color?: string }): Promise<FileTag> {
    const response = await api.post<{ tag: FileTag }>("/api/tags", input);
    return response.data.tag;
  },

  async update(tagId: string, input: { name?: string; color?: string }): Promise<FileTag> {
    const response = await api.patch<{ tag: FileTag }>(`/api/tags/${tagId}`, input);
    return response.data.tag;
  },

  async remove(tagId: string): Promise<void> {
    await api.delete(`/api/tags/${tagId}`);
  },

  async setFileTags(fileId: string, tagIds: string[]): Promise<void> {
    await api.put(`/api/files/${fileId}/tags`, { tag_ids: tagIds });
  },

  async batchSetFileTags(fileIds: string[], tagIds: string[]): Promise<void> {
    await api.post("/api/files/batch-tags", { file_ids: fileIds, tag_ids: tagIds });
  },

  async updateFlags(
    fileId: string,
    flags: { is_favorite?: boolean; is_pinned?: boolean },
  ): Promise<void> {
    await api.patch(`/api/files/${fileId}/flags`, flags);
  },
};
