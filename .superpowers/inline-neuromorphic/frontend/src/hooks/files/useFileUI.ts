import { useState, useCallback } from 'react';
import type { FileMetadata } from '../../types/files';
import type { Folder } from '../../types/folders';

export interface DeleteConfirmState {
  type: 'file' | 'folder' | 'batch';
  id?: string;
  name?: string;
  fileCount?: number;
  folderCount?: number;
}

export function useFileUI() {
  const [previewFile, setPreviewFile] = useState<FileMetadata | null>(null);
  const [shareFile, setShareFile] = useState<FileMetadata | null>(null);
  const [showBatchShare, setShowBatchShare] = useState(false);
  const [batchShareFileIds, setBatchShareFileIds] = useState<string[]>([]);
  const [showBatchMove, setShowBatchMove] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<Folder | null>(null);
  const [renamingFile, setRenamingFile] = useState<FileMetadata | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  return {
    previewFile,
    setPreviewFile,
    shareFile,
    setShareFile,
    showBatchShare,
    setShowBatchShare,
    batchShareFileIds,
    setBatchShareFileIds,
    showBatchMove,
    setShowBatchMove,
    showCreateFolder,
    setShowCreateFolder,
    renamingFolder,
    setRenamingFolder,
    renamingFile,
    setRenamingFile,
    deleteConfirm,
    setDeleteConfirm,
    error,
    setError,
    clearError,
  };
}
