import { useCallback, useRef, useState } from 'react';

export function useClipboard(): {
  copy: (text: string) => Promise<boolean>;
  copied: boolean;
} {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      if (timer.current) clearTimeout(timer.current);
      setCopied(true);
      timer.current = setTimeout(() => {
        timer.current = null;
        setCopied(false);
      }, 1500);
      return true;
    } catch {
      return false;
    }
  }, []);

  return { copy, copied };
}
