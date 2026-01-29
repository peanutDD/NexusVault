import { useState, useEffect, useRef } from 'react';

/**
 * Throttle a value: at most one update per `delay` ms.
 * 用于滚动、resize、预览切换等需要限制频率的场景。
 */
export function useThrottle<T>(value: T, delay: number): T {
  const [throttled, setThrottled] = useState<T>(value);
  const lastRan = useRef<number>(0);
  const trailingRef = useRef<T>(value);

  useEffect(() => {
    if (lastRan.current === 0) lastRan.current = Date.now();
    trailingRef.current = value;
    const elapsed = Date.now() - lastRan.current;
    const remaining = Math.max(0, delay - elapsed);

    const timer = setTimeout(() => {
      lastRan.current = Date.now();
      setThrottled(trailingRef.current);
    }, remaining);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return throttled;
}
