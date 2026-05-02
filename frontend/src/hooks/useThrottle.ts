import { useState, useEffect, useRef } from 'react';

/**
 * Throttle a value: at most one update per `delay` ms.
 * 用于滚动、resize、预览切换等需要限制频率的场景。
 */
export function useThrottle<T>(value: T, delay: number): T {
  const [throttled, setThrottled] = useState<T>(value);
  const lastCall = useRef<number>(Date.now());
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingValue = useRef<T>(value);

  useEffect(() => {
    pendingValue.current = value;
    const now = Date.now();

    if (timeout.current === null) {
      const timeSinceLast = now - lastCall.current;

      if (timeSinceLast >= delay) {
        lastCall.current = now;
        setThrottled(value);
      } else {
        timeout.current = setTimeout(() => {
          lastCall.current = Date.now();
          setThrottled(pendingValue.current);
          timeout.current = null;
        }, delay - timeSinceLast);
      }
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
