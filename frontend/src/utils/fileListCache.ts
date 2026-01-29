import type { FileMetadata } from '../services/files';
import { FILE_LIST } from '../constants';

const CACHE_VERSION = FILE_LIST.CACHE_VERSION;
const CACHE_DURATION = FILE_LIST.CACHE_MINUTES * 60 * 1000;
const CACHE_MAX_ENTRIES = FILE_LIST.CACHE_MAX_ENTRIES;
const CACHE_KEY_PREFIX = 'file_list_cache_';
const LRU_KEY = 'file_list_cache::lru';

interface CachedFileList {
  version: number;
  files: FileMetadata[];
  total: number;
  timestamp: number;
  queryKey: string;
}

function getLruKeys(): string[] {
  try {
    const raw = localStorage.getItem(LRU_KEY);
    if (!raw) return [];
    const keys = JSON.parse(raw) as unknown;
    return Array.isArray(keys) && keys.every((k) => typeof k === 'string') ? keys : [];
  } catch {
    return [];
  }
}

function setLruKeys(keys: string[]): void {
  try {
    localStorage.setItem(LRU_KEY, JSON.stringify(keys));
  } catch {
    // ignore
  }
}

/** 将 key 移到 LRU 末尾（最近使用） */
function touchLru(key: string): void {
  const keys = getLruKeys().filter((k) => k !== key);
  keys.push(key);
  setLruKeys(keys);
}

/** 淘汰最久未使用的条目直到不超过 CACHE_MAX_ENTRIES */
function evictLru(): void {
  const keys = getLruKeys();
  if (keys.length <= CACHE_MAX_ENTRIES) return;
  const toRemove = keys.length - CACHE_MAX_ENTRIES;
  const nextKeys = keys.slice(toRemove);
  for (let i = 0; i < toRemove; i++) {
    try {
      localStorage.removeItem(keys[i]);
    } catch {
      // ignore
    }
  }
  setLruKeys(nextKeys);
}

export function getCacheKey(query: Record<string, unknown>): string {
  const sorted = Object.keys(query)
    .sort()
    .map((k) => `${k}=${query[k]}`)
    .join('&');
  return `${CACHE_KEY_PREFIX}${sorted}`;
}

export function getCachedFileList(
  queryKey: string
): { files: FileMetadata[]; total: number } | null {
  try {
    const cached = localStorage.getItem(queryKey);
    if (!cached) return null;

    const data = JSON.parse(cached) as CachedFileList;
    const now = Date.now();

    if (data.version !== CACHE_VERSION) {
      localStorage.removeItem(queryKey);
      setLruKeys(getLruKeys().filter((k) => k !== queryKey));
      return null;
    }

    if (now - data.timestamp > CACHE_DURATION) {
      localStorage.removeItem(queryKey);
      setLruKeys(getLruKeys().filter((k) => k !== queryKey));
      return null;
    }

    touchLru(queryKey);
    return { files: data.files, total: data.total };
  } catch {
    return null;
  }
}

export function setCachedFileList(
  queryKey: string,
  files: FileMetadata[],
  total: number
): void {
  const data: CachedFileList = {
    version: CACHE_VERSION,
    files,
    total,
    timestamp: Date.now(),
    queryKey,
  };
  try {
    localStorage.setItem(queryKey, JSON.stringify(data));
    touchLru(queryKey);
    evictLru();
  } catch {
    // localStorage 可能已满或不可用，尝试淘汰后重试一次
    try {
      evictLru();
      localStorage.setItem(queryKey, JSON.stringify(data));
      touchLru(queryKey);
    } catch {
      // 忽略
    }
  }
}

export function clearFileListCache(): void {
  try {
    const keys = getLruKeys();
    keys.forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem(LRU_KEY);
  } catch {
    // 回退：按前缀删除
    Object.keys(localStorage)
      .filter((k) => k.startsWith(CACHE_KEY_PREFIX) || k === LRU_KEY)
      .forEach((k) => localStorage.removeItem(k));
  }
}
