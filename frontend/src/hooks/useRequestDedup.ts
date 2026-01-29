import { useRef, useCallback, useEffect } from 'react';

// 限制 Map 大小，防止内存泄漏
const MAX_CACHE_SIZE = 100;

/**
 * Request deduplication: if the same request is in-flight, return the existing promise.
 * Prevents duplicate API calls for the same resource.
 */
export function useRequestDedup<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>
): (...args: Args) => Promise<T> {
  const inFlight = useRef<Map<string, Promise<T>>>(new Map());

  // 组件卸载时清理 Map（清理时使用 effect 内捕获的引用）
  useEffect(() => {
    const map = inFlight.current;
    return () => {
      map.clear();
    };
  }, []);

  return useCallback(
    (...args: Args): Promise<T> => {
      const key = JSON.stringify(args);
      const existing = inFlight.current.get(key);
      if (existing) return existing;

      // 检查 Map 大小，防止无限增长
      if (inFlight.current.size >= MAX_CACHE_SIZE) {
        // 删除最早的条目
        const firstKey = inFlight.current.keys().next().value;
        if (firstKey !== undefined) {
          inFlight.current.delete(firstKey);
        }
      }

      const promise = fn(...args)
        .then((result) => {
          inFlight.current.delete(key);
          return result;
        })
        .catch((err) => {
          inFlight.current.delete(key);
          throw err;
        });

      inFlight.current.set(key, promise);
      return promise;
    },
    [fn]
  );
}
