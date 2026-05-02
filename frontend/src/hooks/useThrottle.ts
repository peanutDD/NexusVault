import { useState, useEffect, useRef } from 'react';

/**
 * Throttle a value: at most one update per `delay` ms.
 * 用于滚动、resize、预览切换等需要限制频率的场景。
 */
export function useThrottle<T>(value: T, delay: number): T {
  const [throttled, setThrottled] = useState<T>(value);
  const lastCall = useRef<number>(0);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingValue = useRef<T>(value);

  useEffect(() => {
    pendingValue.current = value;
    const now = Date.now();

    if (timeout.current === null) {
      const timeSinceLast = now - lastCall.current;
      const wait = Math.max(0, delay - timeSinceLast);

      timeout.current = setTimeout(() => {
        lastCall.current = Date.now();
        setThrottled(pendingValue.current);
        timeout.current = null;
      }, wait);
    }

    return () => {
      if (timeout.current !== null) {
        clearTimeout(timeout.current);
        timeout.current = null;
      }
    };
  }, [value, delay]);

  return throttled;
}
