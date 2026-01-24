import { useRef, useCallback } from 'react';

/**
 * Request deduplication: if the same request is in-flight, return the existing promise.
 * Prevents duplicate API calls for the same resource.
 */
export function useRequestDedup<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>
): (...args: Args) => Promise<T> {
  const inFlight = useRef<Map<string, Promise<T>>>(new Map());

  return useCallback(
    (...args: Args): Promise<T> => {
      const key = JSON.stringify(args);
      const existing = inFlight.current.get(key);
      if (existing) return existing;

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
