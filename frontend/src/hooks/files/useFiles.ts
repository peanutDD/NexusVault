import { useInfiniteQuery } from '@tanstack/react-query';
import { fileService } from '../../services/files';
import { FILE_LIST } from '../../constants';
import type { FileListQuery } from '../../types/files';

/**
 * 获取文件列表的无限滚动 Hook
 * @param query 查询参数（不含 page 和 limit）
 */
export function useFiles(query: Omit<FileListQuery, 'page' | 'limit'>) {
  return useInfiniteQuery({
    queryKey: ['files', query],
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
    // 保持旧数据在重新获取时显示，提升 UX
    placeholderData: (previousData) => previousData,
  });
}
