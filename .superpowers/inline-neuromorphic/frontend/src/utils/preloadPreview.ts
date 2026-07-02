import { fileService } from '../services/files';

/**
 * 预加载配置
 */
const MAX_PRELOADED_SIZE = 100;
const MAX_CONCURRENT_PRELOADS = 3;
const PRELOAD_EXPIRE_MS = 5 * 60 * 1000; // 5 分钟
const SCHEDULE_DELAY_MS = 50; // schedulePreload 延迟

interface PreloadEntry {
  timestamp: number;
  abortController?: AbortController;
}

// 状态
const preloaded = new Map<string, PreloadEntry>();
const accessOrder: string[] = [];
let currentPreloading = 0;
const pendingQueue: string[] = [];
const pendingSet = new Set<string>();

// schedulePreload 的调度状态
const scheduledIds = new Set<string>();
let scheduleTimer: ReturnType<typeof setTimeout> | null = null;
const scheduleBatch: string[] = [];

/**
 * LRU：更新访问顺序
 */
function touchAccessOrder(fileId: string): void {
  const idx = accessOrder.indexOf(fileId);
  if (idx !== -1) accessOrder.splice(idx, 1);
  accessOrder.push(fileId);
}

/**
 * LRU：淘汰最久未访问的条目
 */
function evictIfNeeded(): void {
  while (preloaded.size > MAX_PRELOADED_SIZE && accessOrder.length > 0) {
    const oldestId = accessOrder.shift();
    if (oldestId) {
      const entry = preloaded.get(oldestId);
      entry?.abortController?.abort();
      preloaded.delete(oldestId);
    }
  }
}

/**
 * 检查是否可以预加载（未预加载或已过期）
 */
function canPreload(fileId: string): boolean {
  const entry = preloaded.get(fileId);
  if (!entry) return true;

  if (Date.now() - entry.timestamp > PRELOAD_EXPIRE_MS) {
    preloaded.delete(fileId);
    const idx = accessOrder.indexOf(fileId);
    if (idx !== -1) accessOrder.splice(idx, 1);
    return true;
  }

  return false;
}

/**
 * 处理队列中的下一个预加载
 */
function processNext(): void {
  if (currentPreloading >= MAX_CONCURRENT_PRELOADS || pendingQueue.length === 0) return;

  const fileId = pendingQueue.shift();
  if (!fileId) return;
  pendingSet.delete(fileId);

  if (!canPreload(fileId)) {
    processNext();
    return;
  }

  executePreload(fileId);
}

/**
 * 执行预加载
 */
function executePreload(fileId: string): void {
  currentPreloading++;

  const abortController = new AbortController();
  preloaded.set(fileId, { timestamp: Date.now(), abortController });
  touchAccessOrder(fileId);
  evictIfNeeded();

  fileService
    .fetchPreviewBlob(fileId, { signal: abortController.signal })
    .catch(() => {
      // 失败时移除记录，允许重试
      preloaded.delete(fileId);
      const idx = accessOrder.indexOf(fileId);
      if (idx !== -1) accessOrder.splice(idx, 1);
    })
    .finally(() => {
      currentPreloading--;
      const entry = preloaded.get(fileId);
      if (entry) entry.abortController = undefined;
      processNext();
    });
}

/**
 * 预加载文件预览（同步版本，立即执行或入队）
 */
export function preloadPreview(fileId: string): void {
  if (!canPreload(fileId)) return;
  if (pendingSet.has(fileId)) return;

  if (currentPreloading < MAX_CONCURRENT_PRELOADS) {
    executePreload(fileId);
  } else {
    pendingQueue.push(fileId);
    pendingSet.add(fileId);
  }
}

/**
 * 调度预加载（延迟版本，不阻塞 hover 响应）
 *
 * 核心优化：
 * 1. 使用 setTimeout 批量收集 50ms 内的所有 hover 请求
 * 2. 批量执行时使用 requestIdleCallback（如支持）延迟到空闲时
 * 3. 完全不阻塞主线程，hover 效果立即响应
 */
export function schedulePreload(fileId: string): void {
  // 已调度或已预加载则跳过
  if (scheduledIds.has(fileId) || !canPreload(fileId)) return;

  scheduledIds.add(fileId);
  scheduleBatch.push(fileId);

  // 批量收集：50ms 内的请求合并处理
  if (scheduleTimer === null) {
    scheduleTimer = setTimeout(() => {
      scheduleTimer = null;
      const batch = scheduleBatch.splice(0);
      batch.forEach((id) => scheduledIds.delete(id));

      // 使用 requestIdleCallback 延迟到空闲时执行（如不支持则直接执行）
      const execute = () => batch.forEach((id) => preloadPreview(id));

      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(execute, { timeout: 1000 });
      } else {
        execute();
      }
    }, SCHEDULE_DELAY_MS);
  }
}

/**
 * 取消指定文件的预加载
 */
export function cancelPreload(fileId: string): void {
  // 从调度中移除
  scheduledIds.delete(fileId);
  const scheduleIdx = scheduleBatch.indexOf(fileId);
  if (scheduleIdx !== -1) scheduleBatch.splice(scheduleIdx, 1);

  // 从等待队列中移除
  if (pendingSet.has(fileId)) {
    pendingSet.delete(fileId);
    const queueIdx = pendingQueue.indexOf(fileId);
    if (queueIdx !== -1) pendingQueue.splice(queueIdx, 1);
    return;
  }

  // 取消正在进行的预加载
  const entry = preloaded.get(fileId);
  if (entry?.abortController) {
    entry.abortController.abort();
    preloaded.delete(fileId);
    const idx = accessOrder.indexOf(fileId);
    if (idx !== -1) accessOrder.splice(idx, 1);
  }
}

/**
 * 清空所有预加载记录和队列
 */
export function clearAllPreloads(): void {
  // 清除调度
  if (scheduleTimer) {
    clearTimeout(scheduleTimer);
    scheduleTimer = null;
  }
  scheduledIds.clear();
  scheduleBatch.length = 0;

  // 取消所有正在进行的预加载
  for (const entry of preloaded.values()) {
    entry.abortController?.abort();
  }

  preloaded.clear();
  accessOrder.length = 0;
  pendingQueue.length = 0;
  pendingSet.clear();
}

/**
 * 获取预加载统计（调试用）
 */
export function getPreloadStats() {
  return {
    preloadedCount: preloaded.size,
    currentPreloading,
    pendingCount: pendingQueue.length,
    scheduledCount: scheduledIds.size,
  };
}
