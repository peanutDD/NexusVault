/**
 * 缩略图 Blob URL 缓存：同一 fileId 只请求一次，滚动进出视口时复用，减少重复请求。
 */
const MAX_SIZE = 80;
const TTL_MS = 10 * 60 * 1000; // 10 分钟

interface Entry {
  url: string;
  timestamp: number;
}

const cache = new Map<string, Entry>();
const accessOrder: string[] = [];

function touch(fileId: string): void {
  const idx = accessOrder.indexOf(fileId);
  if (idx !== -1) accessOrder.splice(idx, 1);
  accessOrder.push(fileId);
}

function evict(): void {
  while (cache.size >= MAX_SIZE && accessOrder.length > 0) {
    const oldest = accessOrder.shift();
    if (!oldest) break;
    const entry = cache.get(oldest);
    cache.delete(oldest);
    if (entry?.url) {
      try {
        URL.revokeObjectURL(entry.url);
      } catch {
        // ignore
      }
    }
  }
}

export function getCachedThumbnailUrl(fileId: string): string | null {
  const entry = cache.get(fileId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > TTL_MS) {
    try {
      URL.revokeObjectURL(entry.url);
    } catch {
      // ignore
    }
    cache.delete(fileId);
    const idx = accessOrder.indexOf(fileId);
    if (idx !== -1) accessOrder.splice(idx, 1);
    return null;
  }
  touch(fileId);
  return entry.url;
}

export function setCachedThumbnailUrl(fileId: string, url: string): void {
  touch(fileId);
  evict();
  cache.set(fileId, { url, timestamp: Date.now() });
}
