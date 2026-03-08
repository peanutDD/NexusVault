import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { fileService } from '../../services/files';
import { folderService } from '../../services/folders';
import { useFileMutations } from './useFileMutations';
import { getErrorMessage } from '../../utils/error';
import { BATCH_LIMITS } from '../../constants';
import type { FileMetadata } from '../../types/files';
import type { Folder } from '../../types/folders';
import type { DeleteConfirmState } from './useFileUI';

interface UseFileActionsProps {
  files: FileMetadata[];
  selectedFiles: Set<string>;
  selectedFolders: Set<string>;
  selectedFileIds: string[];
  selectedFolderIds: string[];
  setSelectedFiles: (files: Set<string>) => void;
  setSelectedFolders: (folders: Set<string>) => void;
  setError: (error: string | null) => void;
  setDeleteConfirm: (state: DeleteConfirmState | null) => void;
  deleteConfirm: DeleteConfirmState | null;
  setRenamingFolder: (folder: Folder | null) => void;
  setRenamingFile: (file: FileMetadata | null) => void;
  refetchFiles: () => Promise<unknown>;
  refetchFolders: () => Promise<unknown>;
}

export function useFileActions({
  files,
  selectedFiles,
  selectedFolders,
  selectedFileIds,
  selectedFolderIds,
  setSelectedFiles,
  setSelectedFolders,
  setError,
  setDeleteConfirm,
  deleteConfirm,
  setRenamingFolder,
  setRenamingFile,
  refetchFiles,
  refetchFolders,
}: UseFileActionsProps) {
  const queryClient = useQueryClient();
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [batchDownloading, setBatchDownloading] = useState(false);

  const {
    deleteFile: deleteFileMutation,
    batchDeleteFiles: batchDeleteMutation,
    deleteFolder: deleteFolderMutation,
    renameFolder: renameFolderMutation,
    renameFile: renameFileMutation,
  } = useFileMutations();

  const handleDelete = useCallback((fileId: string) => {
    const file = files.find((f) => f.id === fileId);
    setDeleteConfirm({
      type: 'file',
      id: fileId,
      name: file?.original_filename || '文件',
    });
  }, [files, setDeleteConfirm]);

  const handleBatchDelete = useCallback(() => {
    const fileCount = selectedFiles.size;
    const folderCount = selectedFolders.size;
    if (fileCount === 0 && folderCount === 0) return;

    setDeleteConfirm({
      type: 'batch',
      fileCount,
      folderCount,
    });
  }, [selectedFiles.size, selectedFolders.size, setDeleteConfirm]);

  const executeDelete = useCallback(async () => {
    if (!deleteConfirm) return;
    setDeleteLoading(true);
    try {
      if (deleteConfirm.type === 'file' && deleteConfirm.id) {
        await deleteFileMutation.mutateAsync(deleteConfirm.id);
      } else if (deleteConfirm.type === 'folder' && deleteConfirm.id) {
        await deleteFolderMutation.mutateAsync(deleteConfirm.id);
      } else if (deleteConfirm.type === 'batch') {
        if (selectedFiles.size > 0) {
          await batchDeleteMutation.mutateAsync(selectedFileIds);
        }
        if (selectedFolders.size > 0) {
          await Promise.all(selectedFolderIds.map((id) => deleteFolderMutation.mutateAsync(id)));
        }
        setSelectedFiles(new Set());
        setSelectedFolders(new Set());
      }
      setDeleteConfirm(null);
    } catch (err) {
      setError(getErrorMessage(err, '删除失败'));
    } finally {
      setDeleteLoading(false);
    }
  }, [
    deleteConfirm,
    deleteFileMutation,
    deleteFolderMutation,
    batchDeleteMutation,
    selectedFiles.size,
    selectedFolders.size,
    selectedFileIds,
    selectedFolderIds,
    setSelectedFiles,
    setSelectedFolders,
    setError,
    setDeleteConfirm,
  ]);

  const handleRenameFolderSubmit = useCallback(async (id: string, name: string) => {
    try {
      await renameFolderMutation.mutateAsync({ id, name });
      setRenamingFolder(null);
    } catch (err) {
      setError(getErrorMessage(err, '重命名失败'));
    }
  }, [renameFolderMutation, setError, setRenamingFolder]);

  const handleRenameFileSubmit = useCallback(async (id: string, name: string) => {
    try {
      await renameFileMutation.mutateAsync({ id, name });
      setRenamingFile(null);
    } catch (err) {
      setError(getErrorMessage(err, '重命名失败'));
    }
  }, [renameFileMutation, setError, setRenamingFile]);

  const handleDownload = useCallback(async (file: FileMetadata) => {
    try {
      await fileService.downloadFile(file.id, file.original_filename);
    } catch (err) {
      setError(getErrorMessage(err, '下载失败'));
    }
  }, [setError]);

  const handleBatchDownload = useCallback(async () => {
    if (selectedFiles.size === 0 && selectedFolders.size === 0) return;
    setBatchDownloading(true);
    try {
      let allFileIds = [...selectedFileIds];

      if (selectedFolders.size > 0) {
        const folderFileIds = await folderService.getFilesInFolders(selectedFolderIds);
        allFileIds = [...new Set([...allFileIds, ...folderFileIds])];
      }

      if (allFileIds.length === 0) {
        setError('没有可下载的文件');
        return;
      }

      if (allFileIds.length > BATCH_LIMITS.MAX_DOWNLOAD_ZIP_FILES) {
        setError(`一次最多下载 ${BATCH_LIMITS.MAX_DOWNLOAD_ZIP_FILES} 个文件`);
        return;
      }

      await fileService.downloadZip(allFileIds);
    } catch (err) {
      setError(getErrorMessage(err, '批量下载失败'));
    } finally {
      setBatchDownloading(false);
    }
  }, [selectedFiles.size, selectedFolders.size, selectedFileIds, selectedFolderIds, setError]);

  const handleDropOnBreadcrumb = useCallback(async (targetFolderId: string | null, e: React.DragEvent) => {
    e.preventDefault();
    const fileId = e.dataTransfer.getData('application/file-id');
    if (!fileId) return;

    try {
      await folderService.moveFilesToFolder([fileId], targetFolderId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['files'] }),
        queryClient.invalidateQueries({ queryKey: ['folders', 'contents'] }),
      ]);
      refetchFiles();
      refetchFolders();
    } catch (err) {
      setError(getErrorMessage(err, '移动失败'));
    }
  }, [queryClient, refetchFiles, refetchFolders, setError]);

  return {
    deleteLoading,
    batchDownloading,
    handleDelete,
    handleBatchDelete,
    executeDelete,
    handleRenameFolderSubmit,
    handleRenameFileSubmit,
    handleDownload,
    handleBatchDownload,
    handleDropOnBreadcrumb,
  };
}
