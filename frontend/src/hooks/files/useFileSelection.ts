import { useState, useMemo, useCallback } from 'react';
import type { FileMetadata, Folder } from '../../types';

interface UseFileSelectionReturn {
  /** 选中的文件 ID 集合 */
  selectedFiles: Set<string>;
  /** 选中的文件夹 ID 集合 */
  selectedFolders: Set<string>;
  /** 选中的文件 ID 数组 */
  selectedFileIds: string[];
  /** 选中的文件夹 ID 数组 */
  selectedFolderIds: string[];
  /** 是否全选 */
  allFilesSelected: boolean;
  /** 切换选中文件 */
  toggleSelectFile: (fileId: string) => void;
  /** 切换选中文件夹 */
  toggleSelectFolder: (folderId: string) => void;
  /** 切换全选 */
  toggleSelectAll: () => void;
  /** 清空选择 */
  clearSelection: () => void;
  /** 设置选中的文件 */
  setSelectedFiles: React.Dispatch<React.SetStateAction<Set<string>>>;
  /** 设置选中的文件夹 */
  setSelectedFolders: React.Dispatch<React.SetStateAction<Set<string>>>;
}

/**
 * 文件选择状态 Hook
 * 管理文件和文件夹的多选状态
 */
export function useFileSelection(
  files: FileMetadata[],
  folders: Folder[]
): UseFileSelectionReturn {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());

  const selectedFileIds = useMemo(() => Array.from(selectedFiles), [selectedFiles]);
  const selectedFolderIds = useMemo(() => Array.from(selectedFolders), [selectedFolders]);

  const toggleSelectFile = useCallback((fileId: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  }, []);

  const toggleSelectFolder = useCallback((folderId: string) => {
    setSelectedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  const allFilesSelected = useMemo(() => {
    const hasItems = files.length > 0 || folders.length > 0;
    const allFilesSelected = selectedFiles.size === files.length;
    const allFoldersSelected = selectedFolders.size === folders.length;
    return hasItems && allFilesSelected && allFoldersSelected;
  }, [files.length, folders.length, selectedFiles.size, selectedFolders.size]);

  const toggleSelectAll = useCallback(() => {
    if (allFilesSelected) {
      setSelectedFiles(new Set());
      setSelectedFolders(new Set());
    } else {
      setSelectedFiles(new Set(files.map((f) => f.id)));
      setSelectedFolders(new Set(folders.map((f) => f.id)));
    }
  }, [files, folders, allFilesSelected]);

  const clearSelection = useCallback(() => {
    setSelectedFiles(new Set());
    setSelectedFolders(new Set());
  }, []);

  return {
    selectedFiles,
    selectedFolders,
    selectedFileIds,
    selectedFolderIds,
    allFilesSelected,
    toggleSelectFile,
    toggleSelectFolder,
    toggleSelectAll,
    clearSelection,
    setSelectedFiles,
    setSelectedFolders,
  };
}

export default useFileSelection;
