import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { fileService } from '../../services/files';
import { FILE_COLLECTION_COUNTS_QUERY_KEY } from '../../services/fileListService';
import { folderService } from '../../services/folders';
import type { FileListResponse } from '../../types/files';
import type { FolderContentsResponse } from '../../types/folders';

/**
 * 文件和文件夹操作的 Mutation Hook
 *
 * 删除操作使用乐观更新（Optimistic Update）：
 *   - onMutate:  取消进行中的 refetch，立即从缓存移除 item → UI 即时响应
 *   - onError:   回滚到快照
 *   - onSettled: 无论成功/失败都 invalidate，保证与服务端最终一致
 *
 * 修复：「第二次删除后 UI 不更新」的竞态 bug ——
 *   原因：onSuccess 里的 invalidateQueries 在上次 refetch 仍进行中时可能被忽略。
 */
export function useFileMutations() {
  const queryClient = useQueryClient();

  const deleteFile = useMutation({
    mutationFn: (fileId: string) => fileService.deleteFile(fileId),
    onMutate: async (fileId: string) => {
      // 取消所有进行中的 files 查询，防止 refetch 回滚乐观更新
      await queryClient.cancelQueries({ queryKey: ['files'] });
      // 保存快照用于回滚
      const previous = queryClient.getQueriesData<InfiniteData<FileListResponse>>({ queryKey: ['files'] });
      // 立即从缓存中移除该文件（乐观更新）
      queryClient.setQueriesData<InfiniteData<FileListResponse>>(
        { queryKey: ['files'] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              files: page.files.filter((f) => f.id !== fileId),
              total: Math.max(0, (page.total ?? 0) - 1),
            })),
          };
        },
      );
      return { previous };
    },
    onError: (_err, _fileId, context) => {
      // 删除失败时回滚到快照
      if (context?.previous) {
        for (const [queryKey, data] of context.previous) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      // 使用 refetchType: 'none' 仅标记 stale 而不立即触发后台 refetch，
      // 避免"取消进行中的 refetch → React Query 回滚缓存"的竞态问题。
      // 下次用户切换页面/窗口聚焦时会自动重新获取最新数据。
      void queryClient.invalidateQueries({ queryKey: ['files'], refetchType: 'none' });
      void queryClient.invalidateQueries({ queryKey: ['trash'], refetchType: 'none' });
      void queryClient.invalidateQueries({ queryKey: FILE_COLLECTION_COUNTS_QUERY_KEY });
    },
  });

  const batchDeleteFiles = useMutation({
    mutationFn: (fileIds: string[]) => fileService.batchDelete(fileIds),
    onMutate: async (fileIds: string[]) => {
      await queryClient.cancelQueries({ queryKey: ['files'] });
      const previous = queryClient.getQueriesData<InfiniteData<FileListResponse>>({ queryKey: ['files'] });
      const idSet = new Set(fileIds);
      queryClient.setQueriesData<InfiniteData<FileListResponse>>(
        { queryKey: ['files'] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              files: page.files.filter((f) => !idSet.has(f.id)),
              total: Math.max(0, (page.total ?? 0) - fileIds.length),
            })),
          };
        },
      );
      return { previous };
    },
    onError: (_err, _fileIds, context) => {
      if (context?.previous) {
        for (const [queryKey, data] of context.previous) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['files'], refetchType: 'none' });
      void queryClient.invalidateQueries({ queryKey: ['trash'], refetchType: 'none' });
      void queryClient.invalidateQueries({ queryKey: FILE_COLLECTION_COUNTS_QUERY_KEY });
    },
  });

  const deleteFolder = useMutation({
    mutationFn: (folderId: string) => folderService.delete(folderId),
    onMutate: async (folderId: string) => {
      await queryClient.cancelQueries({ queryKey: ['folders', 'contents'] });
      const previous = queryClient.getQueriesData<FolderContentsResponse>({ queryKey: ['folders', 'contents'] });
      queryClient.setQueriesData<FolderContentsResponse>(
        { queryKey: ['folders', 'contents'] },
        (old) => {
          if (!old) return old;
          return { ...old, folders: old.folders.filter((f) => f.id !== folderId) };
        },
      );
      return { previous };
    },
    onError: (_err, _folderId, context) => {
      if (context?.previous) {
        for (const [queryKey, data] of context.previous) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['folders'], refetchType: 'none' });
      void queryClient.invalidateQueries({ queryKey: ['files'], refetchType: 'none' });
      void queryClient.invalidateQueries({ queryKey: FILE_COLLECTION_COUNTS_QUERY_KEY });
    },
  });

  const renameFolder = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => folderService.rename(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['folders', 'contents'] });
    },
  });

  const renameFile = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => fileService.renameFile(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: FILE_COLLECTION_COUNTS_QUERY_KEY });
    },
  });

  const batchMove = useMutation({
    mutationFn: async ({ fileIds, folderIds, targetFolderId }: {
      fileIds: string[]; folderIds: string[]; targetFolderId: string | null;
    }) => {
      let movedFiles = 0, movedFolders = 0;
      if (fileIds.length > 0) movedFiles = await folderService.moveFilesToFolder(fileIds, targetFolderId);
      if (folderIds.length > 0) movedFolders = await folderService.moveFolders(folderIds, targetFolderId);
      return { movedFiles, movedFolders };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['folders', 'contents'] });
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: FILE_COLLECTION_COUNTS_QUERY_KEY });
    },
  });

  return { deleteFile, batchDeleteFiles, deleteFolder, renameFolder, renameFile, batchMove };
}
