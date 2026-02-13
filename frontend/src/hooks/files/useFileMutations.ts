import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fileService } from '../../services/files';
import { folderService } from '../../services/folders';

/**
 * 文件和文件夹操作的 Mutation Hook
 */
export function useFileMutations() {
  const queryClient = useQueryClient();

  // 删除文件
  const deleteFile = useMutation({
    mutationFn: (fileId: string) => fileService.deleteFile(fileId),
    onSuccess: () => {
      // 使文件列表失效，触发重新获取
      queryClient.invalidateQueries({ queryKey: ['files'] });
    },
  });

  // 批量删除文件
  const batchDeleteFiles = useMutation({
    mutationFn: (fileIds: string[]) => fileService.batchDelete(fileIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
    },
  });

  // 删除文件夹
  const deleteFolder = useMutation({
    mutationFn: (folderId: string) => folderService.delete(folderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['files'] });
    },
  });

  // 重命名文件夹
  const renameFolder = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => folderService.rename(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
  });

  // 批量移动
  const batchMove = useMutation({
    mutationFn: async ({ fileIds, folderIds, targetFolderId }: { fileIds: string[]; folderIds: string[]; targetFolderId: string | null }) => {
      let movedFiles = 0;
      let movedFolders = 0;

      if (fileIds.length > 0) {
        movedFiles = await folderService.moveFilesToFolder(fileIds, targetFolderId);
      }

      if (folderIds.length > 0) {
        movedFolders = await folderService.moveFolders(folderIds, targetFolderId);
      }

      return { movedFiles, movedFolders };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['files'] });
    },
  });

  return {
    deleteFile,
    batchDeleteFiles,
    deleteFolder,
    renameFolder,
    batchMove,
  };
}
