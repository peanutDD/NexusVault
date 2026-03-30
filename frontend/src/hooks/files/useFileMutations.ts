import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { fileService } from '../../services/files';
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
      await queryClient.cancelQueries({ queryKey: ['files'] });
      const previous = queryClient.getQueriesData<InfiniteData<FileListResponse>>({ queryKey: ['files'] });
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
      if (context?.previous) {
        for (const [queryKey, data] of context.previous) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['files'] });
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
      void queryClient.invalidateQueries({ queryKey: ['files'] });
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
      void queryClient.invalidateQueries({ queryKey: ['folders'] });
      void queryClient.invalidateQueries({ queryKey: ['files'] });
    },
  });

  const renameFolder = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => folderService.rename(id, name),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['folders'] }); },
  });

  const renameFile = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => fileService.renameFile(id, name),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['files'] }); },
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
      queryClient.invalidateQueries({ queryKey: ['files'] });
    },
  });

  return { deleteFile, batchDeleteFiles, deleteFolder, renameFolder, renameFile, batchMove };
}
