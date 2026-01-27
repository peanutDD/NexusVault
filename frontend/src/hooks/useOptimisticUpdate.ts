import { useState, useCallback, useRef } from 'react';

/**
 * Optimistic update pattern: update UI immediately, rollback on error.
 * 使用 ref 存储 prev 值，避免闭包陈旧状态问题。
 */
export function useOptimisticUpdate<T>(
  initial: T,
  updateFn: (current: T, optimistic: T) => T
): [T, (optimistic: T, actual: Promise<T>) => Promise<void>] {
  const [state, setState] = useState<T>(initial);
  
  // 使用 ref 存储 updateFn，避免依赖变化
  const updateFnRef = useRef(updateFn);
  updateFnRef.current = updateFn;

  const update = useCallback(
    async (optimistic: T, actual: Promise<T>) => {
      // 使用函数式更新获取当前状态，并存储 prev 用于回滚
      let prev: T | undefined;
      setState((currentState) => {
        prev = currentState;
        return updateFnRef.current(currentState, optimistic);
      });

      try {
        const result = await actual;
        setState(result);
      } catch {
        // 使用存储的 prev 值回滚
        if (prev !== undefined) {
          setState(prev);
        }
        throw new Error('Optimistic update failed, rolled back');
      }
    },
    []
  );

  return [state, update];
}
