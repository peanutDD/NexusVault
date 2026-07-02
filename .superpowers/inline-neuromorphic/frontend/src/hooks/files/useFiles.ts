import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { fileService } from '../../services/files';
import { FILE_LIST } from '../../constants';
import type { FileListQuery } from '../../types/files';
import { useAuthStore } from '../../store/authStore';

/**
 * 获取文件列表的无限滚动 Hook
 * @param query 查询参数（不含 page 和 limit）
 */
export function useFiles(query: Omit<FileListQuery, 'page' | 'limit'>) {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const shouldKeepPreviousSearchResults = Boolean(query.search?.trim());

  return useInfiniteQuery({
    queryKey: ['files', query, userId],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await fileService.listFiles({
        ...query,
        page: pageParam as number,
        limit: FILE_LIST.LIMIT,
      });
      return response;
    },
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.length * FILE_LIST.LIMIT;
      return loadedCount < (lastPage.total ?? 0) ? allPages.length + 1 : undefined;
    },
    initialPageParam: 1,
    enabled: userId !== null,
    placeholderData: shouldKeepPreviousSearchResults ? keepPreviousData : undefined,
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}
