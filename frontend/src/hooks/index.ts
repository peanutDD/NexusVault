/**
 * Hooks 统一导出
 */

// 通用 hooks
export * from './common';

// 文件相关 hooks
export * from './files';

// 文件夹相关 hooks
export * from './folders';

// 原有 hooks（保持向后兼容）
export { useDebounce } from './useDebounce';
export { useThrottle } from './useThrottle';
export { useThrottledCallback } from './useThrottledCallback';
export { useClipboard } from './useClipboard';
export { useConfirm } from './useConfirm';
export { useRequestDedup } from './useRequestDedup';
export { useSafeAsync } from './useSafeAsync';
export { useStaleWhileRevalidate } from './useStaleWhileRevalidate';
export { useOptimisticUpdate } from './useOptimisticUpdate';
export { useCategories } from './useCategories';
export { useKeyboardShortcuts, SHORTCUTS } from './useKeyboardShortcuts';
