import { useState, useEffect, useCallback, useRef } from 'react';

const memoryCache = new Map<
  string,
  { data: unknown; timestamp: number }
>();

const DEFAULT_TTL = 5 * 60 * 1000;

function getCached<T>(key: string): { data: T; timestamp: number } | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  return entry as { data: T; timestamp: number };
}

function setCached<T>(key: string, data: T): void {
  memoryCache.set(key, { data, timestamp: Date.now() });
}

/**
 * Stale-while-revalidate：先展示缓存（若有），同时在后台请求并更新。
 * 用于列表、元数据等可接受短暂陈旧的场景，降低首屏请求与感知延迟。
 */
export function useStaleWhileRevalidate<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options?: { ttl?: number }
): { data: T | null; isValidating: boolean; mutate: () => Promise<void> } {
  const ttl = options?.ttl ?? DEFAULT_TTL;
  const [data, setData] = useState<T | null>(() => {
    if (!key) return null;
    const cached = getCached<T>(key);
    return cached && Date.now() - cached.timestamp < ttl ? cached.data : null;
  });
  const [isValidating, setIsValidating] = useState(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const mutate = useCallback(async () => {
    if (!key) return;
    setIsValidating(true);
    try {
      const fresh = await fetcherRef.current();
      setData(fresh);
      setCached(key, fresh);
    } finally {
      setIsValidating(false);
    }
  }, [key]);

  useEffect(() => {
    if (!key) return;

    const cached = getCached<T>(key);
    if (cached && Date.now() - cached.timestamp < ttl) {
      setData(cached.data);
    }

    mutate();
  }, [key, ttl, mutate]);

  return { data, isValidating, mutate };
}
