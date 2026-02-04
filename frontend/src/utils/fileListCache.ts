/**
 * 文件列表缓存工具
 * 提供文件列表的本地缓存功能，支持 LRU 淘汰策略和缓存过期
 *
 * 修复：
 * - 解决 touchLru 竞态风险
 * - 确保 LRU 列表与实际缓存一致
 * - 使用同步的读-改-写模式
 */
import type { FileMetadata, CachedFileList } from '../types';
import { FILE_LIST } from '../constants';

/**
 * 缓存配置常量
 */
const CACHE_VERSION = FILE_LIST.CACHE_VERSION;
const CACHE_DURATION = FILE_LIST.CACHE_MINUTES * 60 * 1000; // 缓存有效期（毫秒）
const CACHE_MAX_ENTRIES = FILE_LIST.CACHE_MAX_ENTRIES; // 最大缓存条目数
const CACHE_KEY_PREFIX = 'file_list_cache_'; // 缓存键前缀
const LRU_KEY = 'file_list_cache::lru'; // LRU 键

// 操作锁：防止并发操作导致的竞态
let isOperating = false;
const pendingOperations: Array<() => void> = [];

/**
 * 获取操作锁
 */
function acquireLock(): Promise<void> {
  return new Promise((resolve) => {
    if (!isOperating) {
      isOperating = true;
      resolve();
    } else {
      pendingOperations.push(resolve);
    }
  });
}

/**
 * 释放操作锁
 */
function releaseLock(): void {
  const next = pendingOperations.shift();
  if (next) {
    next();
  } else {
    isOperating = false;
  }
}

/**
 * 检查 localStorage 是否可用
 */
function isLocalStorageAvailable(): boolean {
  return typeof localStorage !== 'undefined';
}

/**
 * 获取 LRU 键列表（内部使用，需在锁内调用）
 */
function getLruKeysInternal(): string[] {
  try {
    if (!isLocalStorageAvailable()) return [];

    const raw = localStorage.getItem(LRU_KEY);
    if (!raw) return [];

    const keys = JSON.parse(raw) as unknown;
    return Array.isArray(keys) && keys.every((k) => typeof k === 'string') ? keys : [];
  } catch {
    return [];
  }
}

/**
 * 设置 LRU 键列表（内部使用，需在锁内调用）
 */
function setLruKeysInternal(keys: string[]): void {
  try {
    if (!isLocalStorageAvailable()) return;
    localStorage.setItem(LRU_KEY, JSON.stringify(keys));
  } catch {
    // 忽略错误
  }
}

/**
 * 同步 LRU 列表与实际缓存（清理不一致的条目）
 */
function syncLruWithCache(): void {
  if (!isLocalStorageAvailable()) return;

  const lruKeys = getLruKeysInternal();
  const validKeys: string[] = [];

  // 检查 LRU 中的每个 key 是否在 localStorage 中存在
  for (const key of lruKeys) {
    if (localStorage.getItem(key) !== null) {
      validKeys.push(key);
    }
  }

  // 如果有变化，更新 LRU 列表
  if (validKeys.length !== lruKeys.length) {
    setLruKeysInternal(validKeys);
  }
}

/**
 * 原子操作：将键移到 LRU 末尾并淘汰超限条目
 */
function touchAndEvict(key: string): void {
  if (!isLocalStorageAvailable()) return;

  const keys = getLruKeysInternal();

  // 移除已存在的 key
  const index = keys.indexOf(key);
  if (index !== -1) {
    keys.splice(index, 1);
  }

  // 添加到末尾
  keys.push(key);

  // 淘汰超限条目
  while (keys.length > CACHE_MAX_ENTRIES) {
    const oldestKey = keys.shift();
    if (oldestKey) {
      try {
        localStorage.removeItem(oldestKey);
      } catch {
        // 忽略错误
      }
    }
  }

  setLruKeysInternal(keys);
}

/**
 * 从 LRU 列表中移除指定 key
 */
function removeFromLru(key: string): void {
  if (!isLocalStorageAvailable()) return;

  const keys = getLruKeysInternal();
  const index = keys.indexOf(key);
  if (index !== -1) {
    keys.splice(index, 1);
    setLruKeysInternal(keys);
  }
}

/**
 * 生成缓存键
 * @param query 查询参数对象
 * @returns 缓存键字符串
 */
export function getCacheKey(query: Record<string, unknown>): string {
  // 对查询参数键进行排序，确保相同参数生成相同的缓存键
  const sorted = Object.keys(query)
    .sort()
    .map((k) => `${k}=${query[k]}`)
    .join('&');
  return `${CACHE_KEY_PREFIX}${sorted}`;
}

/**
 * 获取缓存的文件列表
 * @param queryKey 查询键
 * @returns 缓存的文件列表和总数，或 null（如果缓存不存在或已过期）
 */
export async function getCachedFileList(
  queryKey: string
): Promise<{ files: FileMetadata[]; total: number } | null> {
  if (!isLocalStorageAvailable()) return null;

  await acquireLock();
  try {
    const cached = localStorage.getItem(queryKey);
    if (!cached) return null;

    let data: CachedFileList;
    try {
      data = JSON.parse(cached) as CachedFileList;
    } catch {
      // JSON 解析失败，删除损坏的缓存
      localStorage.removeItem(queryKey);
      removeFromLru(queryKey);
      return null;
    }

    const now = Date.now();

    // 检查缓存版本
    if (data.version !== CACHE_VERSION) {
      localStorage.removeItem(queryKey);
      removeFromLru(queryKey);
      return null;
    }

    // 检查缓存是否过期
    if (now - data.timestamp > CACHE_DURATION) {
      localStorage.removeItem(queryKey);
      removeFromLru(queryKey);
      return null;
    }

    // 标记为最近使用（原子操作）
    touchAndEvict(queryKey);
    return { files: data.files, total: data.total };
  } catch {
    return null;
  } finally {
    releaseLock();
  }
}

/**
 * 获取缓存的文件列表（同步版本，用于初始化等场景）
 * 注意：可能有轻微竞态风险，仅在必要时使用
 */
export function getCachedFileListSync(
  queryKey: string
): { files: FileMetadata[]; total: number } | null {
  if (!isLocalStorageAvailable()) return null;

  try {
    const cached = localStorage.getItem(queryKey);
    if (!cached) return null;

    const data = JSON.parse(cached) as CachedFileList;
    const now = Date.now();

    // 检查缓存版本和过期
    if (data.version !== CACHE_VERSION || now - data.timestamp > CACHE_DURATION) {
      return null;
    }

    return { files: data.files, total: data.total };
  } catch {
    return null;
  }
}

/**
 * 设置缓存的文件列表
 * @param queryKey 查询键
 * @param files 文件列表
 * @param total 总文件数
 */
export async function setCachedFileList(
  queryKey: string,
  files: FileMetadata[],
  total: number
): Promise<void> {
  if (!isLocalStorageAvailable()) return;

  await acquireLock();
  try {
    const data: CachedFileList = {
      version: CACHE_VERSION,
      files,
      total,
      timestamp: Date.now(),
      queryKey,
    };

    try {
      localStorage.setItem(queryKey, JSON.stringify(data));
      touchAndEvict(queryKey);
    } catch {
      // localStorage 可能已满，尝试清理后重试
      syncLruWithCache();

      // 强制淘汰一些条目
      const keys = getLruKeysInternal();
      const toRemove = Math.max(1, Math.floor(keys.length * 0.2)); // 淘汰 20%
      for (let i = 0; i < toRemove && keys.length > 0; i++) {
        const oldKey = keys.shift();
        if (oldKey) {
          try {
            localStorage.removeItem(oldKey);
          } catch {
            // 忽略
          }
        }
      }
      setLruKeysInternal(keys);

      // 重试写入
      try {
        localStorage.setItem(queryKey, JSON.stringify(data));
        touchAndEvict(queryKey);
      } catch {
        // 仍然失败，放弃
      }
    }
  } finally {
    releaseLock();
  }
}

/**
 * 设置缓存的文件列表（同步版本）
 * 注意：可能有轻微竞态风险，用于性能敏感的场景
 */
export function setCachedFileListSync(
  queryKey: string,
  files: FileMetadata[],
  total: number
): void {
  if (!isLocalStorageAvailable()) return;

  const data: CachedFileList = {
    version: CACHE_VERSION,
    files,
    total,
    timestamp: Date.now(),
    queryKey,
  };

  try {
    localStorage.setItem(queryKey, JSON.stringify(data));
    // 简化的 LRU 更新（可能有轻微竞态，但性能更好）
    const keys = getLruKeysInternal().filter((k) => k !== queryKey);
    keys.push(queryKey);
    while (keys.length > CACHE_MAX_ENTRIES) {
      const oldest = keys.shift();
      if (oldest) {
        try {
          localStorage.removeItem(oldest);
        } catch {
          // 忽略
        }
      }
    }
    setLruKeysInternal(keys);
  } catch {
    // 忽略错误
  }
}

/**
 * 清除所有文件列表缓存
 */
export async function clearFileListCache(): Promise<void> {
  if (!isLocalStorageAvailable()) return;

  await acquireLock();
  try {
    const keys = getLruKeysInternal();
    for (const key of keys) {
      try {
        localStorage.removeItem(key);
      } catch {
        // 忽略
      }
    }
    localStorage.removeItem(LRU_KEY);
  } catch {
    // 回退：按前缀删除所有缓存
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(CACHE_KEY_PREFIX) || k === LRU_KEY)
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      // 忽略
    }
  } finally {
    releaseLock();
  }
}

/**
 * 清除所有文件列表缓存（同步版本）
 */
export function clearFileListCacheSync(): void {
  if (!isLocalStorageAvailable()) return;

  try {
    const keys = getLruKeysInternal();
    for (const key of keys) {
      try {
        localStorage.removeItem(key);
      } catch {
        // 忽略
      }
    }
    localStorage.removeItem(LRU_KEY);
  } catch {
    // 回退
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(CACHE_KEY_PREFIX) || k === LRU_KEY)
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      // 忽略
    }
  }
}

/**
 * 检查缓存是否可用
 * @returns 缓存是否可用
 */
export function isCacheAvailable(): boolean {
  try {
    if (!isLocalStorageAvailable()) return false;

    // 测试 localStorage 是否可写
    const testKey = `${CACHE_KEY_PREFIX}_test`;
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取缓存统计（用于调试/监控）
 */
export function getCacheStats(): { entryCount: number; lruCount: number } {
  if (!isLocalStorageAvailable()) return { entryCount: 0, lruCount: 0 };

  const lruKeys = getLruKeysInternal();
  let entryCount = 0;

  for (const key of lruKeys) {
    if (localStorage.getItem(key) !== null) {
      entryCount++;
    }
  }

  return { entryCount, lruCount: lruKeys.length };
}
