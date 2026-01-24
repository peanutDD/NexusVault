import { useState, useEffect, useCallback } from 'react';
import { fileService } from '../services/files';

export function useCategories(): {
  categories: string[];
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fileService.getCategories();
      setCategories(list);
    } catch {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { categories, loading, refresh };
}
