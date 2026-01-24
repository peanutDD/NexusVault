import type { FileMetadata } from '../services/files';
import { FILE_LIST } from '../constants';

interface CachedFileList {
  files: FileMetadata[];
  total: number;
  timestamp: number;
  queryKey: string;
}

const CACHE_DURATION = FILE_LIST.CACHE_MINUTES * 60 * 1000;
const CACHE_KEY_PREFIX = 'file_list_cache_';

export function getCacheKey(query: Record<string, unknown>): string {
  const sorted = Object.keys(query)
    .sort()
    .map((key) => `${key}=${query[key]}`)
    .join('&');
  return `${CACHE_KEY_PREFIX}${sorted}`;
}

export function getCachedFileList(
  queryKey: string
): { files: FileMetadata[]; total: number } | null {
  try {
    const cached = localStorage.getItem(queryKey);
    if (!cached) return null;

    const data: CachedFileList = JSON.parse(cached);
    const now = Date.now();

    if (now - data.timestamp > CACHE_DURATION) {
      localStorage.removeItem(queryKey);
      return null;
    }

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
  try {
    const data: CachedFileList = {
      files,
      total,
      timestamp: Date.now(),
      queryKey,
    };
    localStorage.setItem(queryKey, JSON.stringify(data));
  } catch {
    // localStorage 可能已满或不可用，忽略错误
  }
}

export function clearFileListCache(): void {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch {
    // 忽略错误
  }
}
