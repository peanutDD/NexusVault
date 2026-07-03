import api, { limitedApi } from './api';
import { REQUEST } from '../constants';
import { BatchRequestManager } from '../utils/batchRequest';
import { buildQueryParams } from '../utils/queryParams';
import type {
  FileListQuery,
  FileListResponse,
  FileCollectionCounts,
  FileCollectionCountsQuery,
  FileMetadata,
  FulltextSearchMetadata,
  StorageUsage,
} from '../types/files';

interface FulltextSearchHit {
  file: FileMetadata;
  score: number;
  snippet: string;
  match_source: 'filename' | 'content' | 'ocr' | 'category';
}

interface FulltextSearchResponse {
  files: FulltextSearchHit[];
  query: string;
  count: number;
  index_status?: 'ready' | 'fallback';
  search?: FulltextSearchMetadata;
}

export const FILE_COLLECTION_COUNTS_QUERY_KEY = ["file-collection-counts"] as const;

async function fetchFilesByIds(ids: string[]): Promise<(FileMetadata | null)[]> {
  if (ids.length === 0) return [];

  const { data } = await api.post<{ files: (FileMetadata | null)[] }>('/api/files/batch', {
    ids,
  });
  return data.files;
}

const fileMetadataBatch = new BatchRequestManager<FileMetadata | null, 'metadata'>(
  REQUEST.BATCH_DELAY_MS,
  fetchFilesByIds,
);

const LIST_QUERY_TIMEOUT_CONFIG = { timeout: REQUEST.LIST_QUERY_TIMEOUT_MS } as const;

function encodeFolderScope(folderId: FileListQuery['folder_id'] | undefined) {
  if (folderId === undefined) return undefined;
  return folderId === null ? 'root' : folderId;
}

export const fileListService = {
  async getFilesByIds(ids: string[]): Promise<(FileMetadata | null)[]> {
    return fetchFilesByIds(ids);
  },

  getFileMetadata(id: string): Promise<FileMetadata | null> {
    return fileMetadataBatch.request('metadata', id);
  },

  async listFiles(query?: FileListQuery): Promise<FileListResponse> {
    const fulltextQuery = query?.search?.trim();
    if (fulltextQuery) {
      const params = buildQueryParams({
        q: fulltextQuery,
        limit: query?.limit,
        page: query?.page,
        folder_id: encodeFolderScope(query?.folder_id),
        mime_type: query?.mime_type,
        tag_id: query?.tag_id,
        collection: query?.collection,
        sort_by: query?.sort_by,
        sort_order: query?.sort_order,
      });
      const response = await limitedApi.get<FulltextSearchResponse>(
        `/api/files/search/fulltext?${params.toString()}`,
        LIST_QUERY_TIMEOUT_CONFIG,
      );
      return {
        files: response.data.files.map((hit) => ({
          ...hit.file,
          search_snippet: hit.snippet,
          match_source: hit.match_source,
          search_score: hit.score,
        })),
        total: response.data.count,
        page: query?.page ?? 1,
        limit: query?.limit,
        search:
          response.data.search ??
          ({
            index_status: response.data.index_status ?? 'ready',
            count: response.data.count,
            ocr: {
              enabled: false,
              pdf_max_pages: 0,
              tesseract_available: false,
              poppler_available: false,
            },
          } satisfies FulltextSearchMetadata),
      };
    }

    const q: Record<string, string | number | undefined | null> = {};

    if (query) {
      const specialKeys = new Set(['folder_id', 'category']);

      Object.entries(query).forEach(([key, value]) => {
        if (key === 'folder_id' && value !== undefined) {
          q[key] = value === null ? 'null' : value;
        } else if (key === 'category' && value !== undefined) {
          q[key] = value;
        } else if (!specialKeys.has(key) && value != null) {
          q[key] = value;
        }
      });
    }

    const params = buildQueryParams(q);
    const response = await limitedApi.get<FileListResponse>(
      `/api/files?${params.toString()}`,
      LIST_QUERY_TIMEOUT_CONFIG,
    );
    return response.data;
  },

  async getCollectionCounts(query?: FileCollectionCountsQuery): Promise<FileCollectionCounts> {
    const params = buildQueryParams({
      folder_id: encodeFolderScope(query?.folder_id),
      search: query?.search?.trim() || undefined,
      mime_type: query?.mime_type,
    });
    const suffix = params.toString();
    const response = await api.get<FileCollectionCounts>(
      `/api/files/collection-counts${suffix ? `?${suffix}` : ''}`,
      LIST_QUERY_TIMEOUT_CONFIG,
    );
    return response.data;
  },

  async deleteFile(fileId: string): Promise<void> {
    await api.delete(`/api/files/${fileId}`);
  },

  async renameFile(fileId: string, name: string): Promise<FileMetadata> {
    const response = await api.put<{ file: FileMetadata }>(`/api/files/${fileId}`, { name });
    return response.data.file;
  },

  async batchDelete(ids: string[]): Promise<{ deleted: number }> {
    const response = await api.post<{ deleted: number; message: string }>(
      '/api/files/batch-delete',
      { ids },
    );
    return { deleted: response.data.deleted };
  },

  async getStorageUsage(): Promise<StorageUsage> {
    const response = await api.get<StorageUsage>('/api/files/storage-usage');
    return response.data;
  },
};
