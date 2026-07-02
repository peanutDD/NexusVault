/**
 * 缩略图 Blob URL 简单内存缓存：
 * - 同一 fileId 只请求一次，滚动进出视口时复用
 * - 不再做复杂的引用计数 / 延迟 revoke，避免阻塞或卡死
 *
 * 注意：缩略图数量上限为 MAX_SIZE，超过后会淘汰最早使用的条目。
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
    cache.delete(oldest);
    // 这里不再调用 URL.revokeObjectURL，避免复杂的生命周期问题
    // 由浏览器自己回收这些短期 thumbnail blob 即可
  }
}

export function getCachedThumbnailUrl(fileId: string): string | null {
  const entry = cache.get(fileId);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > TTL_MS) {
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
