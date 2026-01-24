import { useState, useCallback } from 'react';

/**
 * Optimistic update pattern: update UI immediately, rollback on error.
 */
export function useOptimisticUpdate<T>(
  initial: T,
  updateFn: (current: T, optimistic: T) => T
): [T, (optimistic: T, actual: Promise<T>) => Promise<void>] {
  const [state, setState] = useState<T>(initial);

  const update = useCallback(
    async (optimistic: T, actual: Promise<T>) => {
      const prev = state;
      setState((s) => updateFn(s, optimistic));

      try {
        const result = await actual;
        setState(result);
      } catch {
        setState(prev);
        throw new Error('Optimistic update failed, rolled back');
      }
    },
    [state, updateFn]
  );

  return [state, update];
}
