import type { InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { REQUEST } from '../constants';

const TTL_MS = REQUEST.DEDUP_TTL_MS;
const MAX_CACHE_SIZE = REQUEST.DEDUP_MAX_CACHE_SIZE;
const CLEANUP_INTERVAL_MS = 5000; // 5 秒清理一次
const INFLIGHT_TIMEOUT_MS = 30000; // 飞行中请求超时 30 秒

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

interface InFlightEntry {
  promise: Promise<AxiosResponse>;
  startedAt: number;
}

const inFlight = new Map<string, InFlightEntry>();
const responseCache = new Map<string, CacheEntry>();

// 插入顺序记录（用于 LRU 淘汰，避免遍历）
const insertOrder: string[] = [];

/**
 * 定时批量清理过期条目
 * 修复：避免每次请求都遍历全部缓存
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();

  // 清理过期的响应缓存
  const expiredKeys: string[] = [];
  for (const [key, entry] of responseCache) {
    if (entry.expiresAt <= now) {
      expiredKeys.push(key);
    }
  }
  for (const key of expiredKeys) {
    responseCache.delete(key);
    const idx = insertOrder.indexOf(key);
    if (idx !== -1) insertOrder.splice(idx, 1);
  }

  // 清理超时的飞行中请求（防止 Promise 永不 resolve 导致泄漏）
  const staleInFlightKeys: string[] = [];
  for (const [key, entry] of inFlight) {
    if (now - entry.startedAt > INFLIGHT_TIMEOUT_MS) {
      staleInFlightKeys.push(key);
    }
  }
  for (const key of staleInFlightKeys) {
    inFlight.delete(key);
  }
}

/**
 * 容量限制淘汰（LRU）
 * 仅在新增缓存时调用，不遍历全部
 */
function evictIfOverCapacity(): void {
  while (responseCache.size > MAX_CACHE_SIZE && insertOrder.length > 0) {
    const oldestKey = insertOrder.shift();
    if (oldestKey) {
      responseCache.delete(oldestKey);
    }
  }
}

/**
 * 添加缓存条目
 */
function addToCache(key: string, response: AxiosResponse, expiresAt: number): void {
  // 如果已存在，先移除旧的顺序记录
  const existingIdx = insertOrder.indexOf(key);
  if (existingIdx !== -1) {
    insertOrder.splice(existingIdx, 1);
  }

  responseCache.set(key, { response, expiresAt });
  insertOrder.push(key);
  evictIfOverCapacity();
}

// 启动定时清理（仅在浏览器环境）
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanupTimer(): void {
  if (cleanupTimer !== null || typeof window === 'undefined') return;
  cleanupTimer = setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL_MS);
}

if (typeof window !== 'undefined') {
  startCleanupTimer();
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
 * 判断请求是否应该跳过去重/缓存
 * - POST/PUT/DELETE 等写操作不应被去重
 * - FormData/Blob 请求不应被去重（如文件上传）
 */
function shouldSkipDedup(config: InternalAxiosRequestConfig): boolean {
  const method = (config.method ?? 'get').toLowerCase();
  // 只对 GET 请求进行去重
  if (method !== 'get') return true;
  // FormData/Blob 请求不去重
  const data = config.data;
  if (data instanceof FormData || data instanceof Blob) return true;
  return false;
}

/**
 * 包装 axios adapter：全局请求去重 + TTL 内复用结果。
 * - 相同 key 的请求在 TTL 内若已有缓存，直接返回缓存响应，不发请求。
 * - 相同 key 的请求若已在飞行中，复用同一 Promise。
 * - POST/PUT/DELETE 等写操作不进行去重。
 *
 * 修复：
 * - 使用定时器批量清理过期条目，避免每次请求都遍历
 * - 添加飞行中请求超时清理，防止 Promise 永不 resolve 导致泄漏
 * - 改进 LRU 淘汰策略
 */
export function createDedupAdapter(defaultAdapter: AxiosAdapter): AxiosAdapter {
  return function dedupAdapter(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
    // 写操作和文件上传不去重，直接发送
    if (shouldSkipDedup(config)) {
      return defaultAdapter(config);
    }

    const key = getDedupKey(config);
    const now = Date.now();

    // 检查缓存（不在这里清理过期条目，由定时器负责）
    const cached = responseCache.get(key);
    if (cached && cached.expiresAt > now) {
      return Promise.resolve(cached.response);
    }
    // 缓存过期，删除
    if (cached) {
      responseCache.delete(key);
      const idx = insertOrder.indexOf(key);
      if (idx !== -1) insertOrder.splice(idx, 1);
    }

    // 检查飞行中请求
    const existing = inFlight.get(key);
    if (existing && now - existing.startedAt < INFLIGHT_TIMEOUT_MS) {
      return existing.promise;
    }
    // 飞行中请求超时，删除
    if (existing) {
      inFlight.delete(key);
    }

    const promise = defaultAdapter(config)
      .then((response) => {
        inFlight.delete(key);
        if (shouldCacheResponse(response)) {
          addToCache(key, response, now + TTL_MS);
        }
        return response;
      })
      .catch((err) => {
        inFlight.delete(key);
        throw err;
      });

    inFlight.set(key, { promise, startedAt: now });
    return promise;
  };
}

/**
 * 清空所有缓存（用于登出等场景）
 */
export function clearDedupCache(): void {
  responseCache.clear();
  inFlight.clear();
  insertOrder.length = 0;
}

/**
 * 获取缓存统计（用于调试/监控）
 */
export function getDedupStats(): { cacheSize: number; inFlightSize: number } {
  return {
    cacheSize: responseCache.size,
    inFlightSize: inFlight.size,
  };
}
