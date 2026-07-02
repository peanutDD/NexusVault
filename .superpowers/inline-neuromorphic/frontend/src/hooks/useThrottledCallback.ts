import { useCallback, useRef } from 'react';

/**
 * 节流回调：在指定时间间隔内最多执行一次（leading）。
 * 用于无限滚动触发、预览切换、resize 等需要限制频率的场景。
 */
export function useThrottledCallback<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): T {
  const lastRun = useRef(0);

  // 使用简单的箭头函数表达式，避免 ESLint 错误
  const throttledFn = useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    const elapsed = now - lastRun.current;
    if (elapsed >= delay || lastRun.current === 0) {
      lastRun.current = now;
      fn(...args);
    }
  }, [fn, delay]);

  return throttledFn as unknown as T;
}
