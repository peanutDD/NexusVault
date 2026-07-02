import { useState, useEffect, useCallback, useRef } from 'react';
import { fileService } from '../services/files';

export function useCategories(): {
  categories: string[];
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 使用 ref 标记是否已初始化，避免重复请求
  const initializedRef = useRef(false);

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

  // 初始化时加载一次，移除 refresh 依赖避免循环
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      refresh();
    }
  }, [refresh]);

  return { categories, loading, refresh };
}
