import { useQuery } from '@tanstack/react-query';
import { folderService } from '../../services/folders';
import { useAuthStore } from '../../store/authStore';

/**
 * 获取文件夹内容的 Hook（子文件夹 + 面包屑路径）
 * @param folderId 文件夹 ID
 */
export function useFolderContents(folderId: string | null) {
  const userId = useAuthStore((state) => state.user?.id ?? null);

  return useQuery({
    queryKey: ['folders', 'contents', folderId, userId],
    queryFn: () => folderService.getContents(folderId),
    // 文件夹内容通常不经常变动，可以设置较长的 staleTime
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 分钟
    enabled: userId !== null,
  });
}

/**
 * 获取文件夹路径（面包屑导航）的 Hook
 * @param folderId 文件夹 ID
 */
export function useFolderPath(folderId: string | null) {
  const userId = useAuthStore((state) => state.user?.id ?? null);

  return useQuery({
    queryKey: ['folders', 'path', folderId, userId],
    queryFn: () => (folderId ? folderService.getPath(folderId) : Promise.resolve([])),
    enabled: !!folderId && userId !== null,
    staleTime: 1000 * 60 * 30, // 30 分钟
  });
}
