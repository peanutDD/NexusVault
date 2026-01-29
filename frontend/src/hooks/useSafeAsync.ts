import { useState, useCallback, useRef, useEffect } from 'react';

export interface UseSafeAsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  mutate: () => Promise<void>;
  setData: (v: T | null) => void;
  setError: (v: string | null) => void;
}

/**
 * Run async fn safely, track loading/error/data. Avoids state updates after unmount.
 */
export function useSafeAsync<T>(
  fn: () => Promise<T>,
  deps: React.DependencyList,
  options?: { onError?: (err: unknown) => string; initialData?: T | null }
): UseSafeAsyncState<T> {
  const [data, setData] = useState<T | null>(options?.initialData ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // deps 由调用方传入（与 useEffect 一致），故意使用动态依赖数组
  const mutate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      if (mounted.current) setData(result);
    } catch (err) {
      if (mounted.current) {
        const msg =
          options?.onError?.(err) ??
          (err instanceof Error ? err.message : 'Unknown error');
        setError(msg);
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps from caller, same as useEffect
  }, deps);

  return { data, error, loading, mutate, setData, setError };
}
