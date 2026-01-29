import type { InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { REQUEST } from '../constants';

const TTL_MS = REQUEST.DEDUP_TTL_MS;
const MAX_CACHE_SIZE = REQUEST.DEDUP_MAX_CACHE_SIZE;

/** 生成请求去重 key：method + url + params + body（FormData/Blob 不参与，避免误合并） */
function getDedupKey(config: InternalAxiosRequestConfig): string {
  const method = (config.method ?? 'get').toLowerCase();
  const url = config.url ?? '';
  let query = '';
  const params = config.params;
  if (params != null) {
    if (params instanceof URLSearchParams) {
      query = params.toString();
    } else if (typeof params === 'object' && !Array.isArray(params)) {
      const entries = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)] as [string, string]);
      query = new URLSearchParams(entries).toString();
    } else {
      query = String(params);
    }
  }
  const fullUrl = query ? `${url}?${query}` : url;
  const data = config.data;
  let dataPart = '';
  if (data !== undefined && data !== null) {
    if (data instanceof FormData || data instanceof Blob) {
      dataPart = ''; // 不参与 key，同一 URL 的 FormData/Blob 请求不去重
    } else if (typeof data === 'object') {
      try {
        dataPart = JSON.stringify(data);
      } catch {
        dataPart = String(data);
      }
    } else {
      dataPart = String(data);
    }
  }
  return `${method}_${fullUrl}_${dataPart}`;
}

interface CacheEntry {
  response: AxiosResponse;
  expiresAt: number;
}

const inFlight = new Map<string, Promise<AxiosResponse>>();
const responseCache = new Map<string, CacheEntry>();

function evictCacheIfNeeded(): void {
  const now = Date.now();
  for (const [key, entry] of responseCache) {
    if (entry.expiresAt <= now) responseCache.delete(key);
  }
  while (responseCache.size > MAX_CACHE_SIZE) {
    const firstKey = responseCache.keys().next().value;
    if (firstKey === undefined) break;
    responseCache.delete(firstKey);
  }
}

/** 是否应缓存该响应（仅缓存 JSON/文本等可复用的，不缓存 blob/arraybuffer） */
function shouldCacheResponse(response: AxiosResponse): boolean {
  if (response.status < 200 || response.status >= 300) return false;
  const responseType = response.config?.responseType;
  if (responseType === 'blob' || responseType === 'arraybuffer' || responseType === 'stream')
    return false;
  return true;
}

export type AxiosAdapter = (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>;

/**
 * 包装 axios adapter：全局请求去重 + TTL 内复用结果。
 * - 相同 key 的请求在 TTL 内若已有缓存，直接返回缓存响应，不发请求。
 * - 相同 key 的请求若已在飞行中，复用同一 Promise。
 */
export function createDedupAdapter(defaultAdapter: AxiosAdapter): AxiosAdapter {
  return function dedupAdapter(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
    const key = getDedupKey(config);
    const now = Date.now();

    const cached = responseCache.get(key);
    if (cached && cached.expiresAt > now) {
      return Promise.resolve(cached.response);
    }
    if (cached) responseCache.delete(key);

    const existing = inFlight.get(key);
    if (existing) return existing;

    const promise = defaultAdapter(config)
      .then((response) => {
        inFlight.delete(key);
        if (shouldCacheResponse(response)) {
          responseCache.set(key, { response, expiresAt: now + TTL_MS });
          evictCacheIfNeeded();
        }
        return response;
      })
      .catch((err) => {
        inFlight.delete(key);
        throw err;
      });

    inFlight.set(key, promise);
    return promise;
  };
}
