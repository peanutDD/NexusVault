/**
 * 文件列表缓存工具
 * 提供文件列表的本地缓存功能，支持 LRU 淘汰策略和缓存过期
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



/**
 * 获取 LRU 键列表
 * @returns LRU 键列表
 */
function getLruKeys(): string[] {
  try {
    // 检查 localStorage 是否存在（避免在 SSR 环境中出错）
    if (typeof localStorage === 'undefined') return [];
    
    const raw = localStorage.getItem(LRU_KEY);
    if (!raw) return [];
    
    const keys = JSON.parse(raw) as unknown;
    return Array.isArray(keys) && keys.every((k) => typeof k === 'string') ? keys : [];
  } catch {
    return [];
  }
}

/**
 * 设置 LRU 键列表
 * @param keys LRU 键列表
 */
function setLruKeys(keys: string[]): void {
  try {
    // 检查 localStorage 是否存在
    if (typeof localStorage === 'undefined') return;
    
    localStorage.setItem(LRU_KEY, JSON.stringify(keys));
  } catch {
    // 忽略错误
  }
}

/**
 * 将键移到 LRU 末尾（标记为最近使用）
 * @param key 缓存键
 */
function touchLru(key: string): void {
  const keys = getLruKeys().filter((k) => k !== key);
  keys.push(key);
  setLruKeys(keys);
}

/**
 * 淘汰最久未使用的缓存条目
 * 确保缓存条目数不超过 CACHE_MAX_ENTRIES
 */
function evictLru(): void {
  const keys = getLruKeys();
  if (keys.length <= CACHE_MAX_ENTRIES) return;
  
  const toRemove = keys.length - CACHE_MAX_ENTRIES;
  const nextKeys = keys.slice(toRemove);
  
  // 删除最久未使用的条目
  for (let i = 0; i < toRemove; i++) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(keys[i]);
      }
    } catch {
      // 忽略错误
    }
  }
  
  setLruKeys(nextKeys);
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
export function getCachedFileList(
  queryKey: string
): { files: FileMetadata[]; total: number } | null {
  try {
    // 检查 localStorage 是否存在
    if (typeof localStorage === 'undefined') return null;
    
    const cached = localStorage.getItem(queryKey);
    if (!cached) return null;

    const data = JSON.parse(cached) as CachedFileList;
    const now = Date.now();

    // 检查缓存版本
    if (data.version !== CACHE_VERSION) {
      localStorage.removeItem(queryKey);
      setLruKeys(getLruKeys().filter((k) => k !== queryKey));
      return null;
    }

    // 检查缓存是否过期
    if (now - data.timestamp > CACHE_DURATION) {
      localStorage.removeItem(queryKey);
      setLruKeys(getLruKeys().filter((k) => k !== queryKey));
      return null;
    }

    // 标记为最近使用
    touchLru(queryKey);
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
export function setCachedFileList(
  queryKey: string,
  files: FileMetadata[],
  total: number
): void {
  // 检查 localStorage 是否存在
  if (typeof localStorage === 'undefined') return;
  
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
      // 忽略错误
    }
  }
}

/**
 * 清除所有文件列表缓存
 */
export function clearFileListCache(): void {
  try {
    // 检查 localStorage 是否存在
    if (typeof localStorage === 'undefined') return;
    
    const keys = getLruKeys();
    keys.forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem(LRU_KEY);
  } catch {
    // 回退：按前缀删除所有缓存
    if (typeof localStorage !== 'undefined') {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(CACHE_KEY_PREFIX) || k === LRU_KEY)
        .forEach((k) => localStorage.removeItem(k));
    }
  }
}

/**
 * 检查缓存是否可用
 * @returns 缓存是否可用
 */
export function isCacheAvailable(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    
    // 测试 localStorage 是否可写
    const testKey = `${CACHE_KEY_PREFIX}_test`;
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}
