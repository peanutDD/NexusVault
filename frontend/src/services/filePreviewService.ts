import axios from 'axios';
import api from './api';
import { API_BASE_URL } from '../config/env';

const previewQueue = {
  running: 0,
  maxConcurrent: 6,
  queue: [] as Array<() => void>,

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running >= this.maxConcurrent) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }

    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      const next = this.queue.shift();
      if (next) next();
    }
  },
};

const previewBlobUrlCache = new Map<string, string>();

export const filePreviewService = {
  getPreviewUrl(fileId: string): string {
    return `${apiBase()}/api/files/${fileId}/preview`;
  },

  getGifVideoPreviewUrl(fileId: string): string {
    return `${apiBase()}/api/files/${fileId}/preview/video`;
  },

  async prepareVideoPreview(fileId: string): Promise<'ready' | 'processing'> {
    const { data } = await api.post<{ status: 'ready' | 'processing' }>(
      `/api/files/${fileId}/preview/video/prepare`,
    );
    return data.status;
  },

  async getVideoPreviewStatus(
    fileId: string,
  ): Promise<{ status: 'processing' | 'ready' | 'failed'; error?: string | null }> {
    const { data } = await api.get<{
      status: 'processing' | 'ready' | 'failed';
      error?: string | null;
    }>(`/api/files/${fileId}/preview/video/status`);
    return data;
  },

  getHlsUrl(fileId: string): string {
    return `${apiBase()}/api/files/${fileId}/hls`;
  },

  async prepareHlsPreview(fileId: string): Promise<'ready' | 'processing' | 'unsupported'> {
    const { data } = await api.post<{ status: 'ready' | 'processing' | 'unsupported' }>(
      `/api/files/${fileId}/hls/prepare`,
    );
    return data.status;
  },

  async getHlsPreviewStatus(fileId: string): Promise<'ready' | 'processing' | 'unsupported'> {
    const { data } = await api.get<{ status: 'ready' | 'processing' | 'unsupported' }>(
      `/api/files/${fileId}/hls/status`,
    );
    return data.status;
  },

  getThumbnailUrl(fileId: string, options?: { width?: number; token?: string | null }): string {
    const base = `${apiBase()}/api/files/${fileId}/thumbnail`;
    const params = new URLSearchParams();
    if (options?.width) params.set('w', String(options.width));
    if (options?.token) params.set('token', options.token);
    const query = params.toString();
    return query ? `${base}?${query}` : base;
  },

  async fetchThumbnailBlob(
    fileId: string,
    options?: { signal?: AbortSignal; width?: number },
  ): Promise<Blob | null> {
    return previewQueue.run(async () => {
      const width = options?.width ?? 400;
      const doFetch = async () => {
        const res = await api.get<Blob>(`/api/files/${fileId}/thumbnail?w=${width}`, {
          responseType: 'blob',
          signal: options?.signal,
          validateStatus: (status) => status < 400 || status === 404 || status === 415,
        });
        if (res.status === 404 || res.status === 415) return null;
        return res.data;
      };

      try {
        return await doFetch();
      } catch (err) {
        const status = axios.isAxiosError(err) ? err.response?.status : undefined;
        if (status === 404 || status === 415) return null;
        if (status === 429 && !options?.signal?.aborted) {
          await delay(2000);
          return await doFetch();
        }
        throw err;
      }
    });
  },

  async fetchPreviewBlob(fileId: string, options?: { signal?: AbortSignal }): Promise<Blob> {
    return previewQueue.run(async () => {
      const doFetch = () =>
        api.get<Blob>(`/api/files/${fileId}/preview`, {
          responseType: 'blob',
          signal: options?.signal,
        });

      try {
        const { data } = await doFetch();
        return data;
      } catch (err) {
        if (
          axios.isAxiosError(err) &&
          err.response?.status === 429 &&
          !options?.signal?.aborted
        ) {
          await delay(2000);
          const { data } = await doFetch();
          return data;
        }
        throw err;
      }
    });
  },

  cachePreviewBlobUrl(fileId: string, url: string): void {
    const existing = previewBlobUrlCache.get(fileId);
    if (existing && existing !== url && existing.startsWith('blob:')) {
      URL.revokeObjectURL(existing);
    }
    previewBlobUrlCache.set(fileId, url);
  },

  takeCachedPreviewBlobUrl(fileId: string): string | undefined {
    const url = previewBlobUrlCache.get(fileId);
    if (url) previewBlobUrlCache.delete(fileId);
    return url;
  },
};

function apiBase(): string {
  return API_BASE_URL.replace(/\/$/, '');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
