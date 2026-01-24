import { useCallback } from 'react';

/**
 * Returns a stable confirm handler. Use for delete/mutation confirmations.
 */
export function useConfirm(): (message: string) => Promise<boolean> {
  return useCallback((message: string) => {
    return Promise.resolve(confirm(message));
  }, []);
}
