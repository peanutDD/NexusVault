import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * 内存缓存配置
 */
const MAX_CACHE_SIZE = 100;
const DEFAULT_TTL = 5 * 60 * 1000; // 5 分钟
const CLEANUP_INTERVAL = 60 * 1000; // 1 分钟清理一次

interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  lastAccessed: number;
}

/**
 * 内存缓存 Map，带 LRU 淘汰和定时清理
 */
const memoryCache = new Map<string, CacheEntry>();

// 缓存键访问顺序（用于 LRU）
const accessOrder: string[] = [];

/**
 * 更新访问顺序（LRU）
 */
function touchAccessOrder(key: string): void {
  const index = accessOrder.indexOf(key);
  if (index !== -1) {
    accessOrder.splice(index, 1);
  }
  accessOrder.push(key);
}

/**
 * 淘汰最久未访问的条目（LRU）
 */
function evictIfNeeded(): void {
  while (memoryCache.size > MAX_CACHE_SIZE && accessOrder.length > 0) {
    const oldestKey = accessOrder.shift();
    if (oldestKey) {
      memoryCache.delete(oldestKey);
    }
  }
}

/**
 * 清理过期条目
 */
function cleanupExpired(ttl: number = DEFAULT_TTL): void {
  const now = Date.now();
  const keysToDelete: string[] = [];

  for (const [key, entry] of memoryCache) {
    if (now - entry.timestamp > ttl) {
      keysToDelete.push(key);
    }
  }

  for (const key of keysToDelete) {
    memoryCache.delete(key);
    const index = accessOrder.indexOf(key);
    if (index !== -1) {
      accessOrder.splice(index, 1);
    }
  }
}

// 启动定时清理（仅在浏览器环境）
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanupTimer(): void {
  if (cleanupTimer !== null || typeof window === 'undefined') return;
  cleanupTimer = setInterval(() => cleanupExpired(), CLEANUP_INTERVAL);
}

// 初始化定时清理
if (typeof window !== 'undefined') {
  startCleanupTimer();
}

/**
 * 获取缓存条目
 */
function getCached<T>(key: string, ttl: number): { data: T; timestamp: number } | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;

  const now = Date.now();

  // 检查是否过期
  if (now - entry.timestamp > ttl) {
    memoryCache.delete(key);
    const index = accessOrder.indexOf(key);
    if (index !== -1) {
      accessOrder.splice(index, 1);
    }
    return null;
  }

  // 更新访问时间和顺序
  entry.lastAccessed = now;
  touchAccessOrder(key);

  return { data: entry.data as T, timestamp: entry.timestamp };
}

/**
 * 设置缓存条目
 */
function setCached<T>(key: string, data: T): void {
  const now = Date.now();
  memoryCache.set(key, { data, timestamp: now, lastAccessed: now });
  touchAccessOrder(key);
  evictIfNeeded();
}

/**
 * 删除指定缓存
 */
export function invalidateCache(key: string): void {
  memoryCache.delete(key);
  const index = accessOrder.indexOf(key);
  if (index !== -1) {
    accessOrder.splice(index, 1);
  }
}

/**
 * 清空所有缓存
 */
export function clearAllCache(): void {
  memoryCache.clear();
  accessOrder.length = 0;
}

/**
 * 获取当前缓存大小（用于调试/监控）
 */
export function getCacheSize(): number {
  return memoryCache.size;
}

/**
 * Stale-while-revalidate：先展示缓存（若有），同时在后台请求并更新。
 * 用于列表、元数据等可接受短暂陈旧的场景，降低首屏请求与感知延迟。
 *
 * 修复：
 * - 添加 LRU 淘汰策略，限制最大缓存条目数
 * - 添加定时清理过期条目
 * - 提供缓存失效和清空 API
 */
export function useStaleWhileRevalidate<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options?: { ttl?: number }
): { data: T | null; isValidating: boolean; mutate: () => Promise<void> } {
  const ttl = options?.ttl ?? DEFAULT_TTL;
  const [data, setData] = useState<T | null>(() => {
    if (!key) return null;
    const cached = getCached<T>(key, ttl);
    return cached ? cached.data : null;
  });
  const [isValidating, setIsValidating] = useState(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // 用于取消过期的请求
  const keyRef = useRef(key);
  keyRef.current = key;

  const mutate = useCallback(async () => {
    if (!key) return;
    const currentKey = key;
    setIsValidating(true);
    try {
      const fresh = await fetcherRef.current();
      // 检查 key 是否仍然匹配（防止竞态）
      if (keyRef.current === currentKey) {
        setData(fresh);
        setCached(currentKey, fresh);
      }
    } finally {
      if (keyRef.current === currentKey) {
        setIsValidating(false);
      }
    }
  }, [key]);

  useEffect(() => {
    if (!key) {
      setData(null);
      return;
    }

    const cached = getCached<T>(key, ttl);
    if (cached) {
      setData(cached.data);
    }

    mutate();
  }, [key, ttl, mutate]);

  return { data, isValidating, mutate };
}
