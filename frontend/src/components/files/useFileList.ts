import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fileService } from '../../services/files';
import type { FileMetadata } from '../../types/files';
import type { Folder } from '../../types/folders';
import { folderService } from '../../services/folders';
import { getErrorMessage } from '../../utils/error';
import { BATCH_LIMITS, MIME_FILTER_FOLDERS } from '../../constants';
import { useFileFilters } from '../../hooks/files/useFileFilters';
import { useFileSelection } from '../../hooks/files/useFileSelection';
import { FILE_TYPE_LABELS } from './fileTypeLabels';
import { groupFilesInWorker } from '../../utils/workerPool';
import { useFiles } from '../../hooks/files/useFiles';
import { useFolderContents } from '../../hooks/folders/useFolders';
import { useFileMutations } from '../../hooks/files/useFileMutations';

// 重新导出 FILE_TYPE_LABELS 以保持向后兼容
export { FILE_TYPE_LABELS };

const GROUP_FILES_WORKER_THRESHOLD = 50;

function getTypeKey(mime: string): string {
  if (mime === 'image/gif') return 'gif';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf') return 'application/pdf';
  if (mime.startsWith('text/')) return 'text';
  if (mime === 'application/zip' || mime === 'application/x-zip-compressed') return 'application/zip';
  if (mime.startsWith('application/')) return 'application';
  return 'other';
}

function getTimeGroupInfo(dateStr: string): { key: string; label: string; sortKey: number } {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const label = `${monthNames[month - 1]} ${day}, ${year}`;
  const sortKey = year * 10000 + month * 100 + day;
  return { key, label, sortKey };
}

function useFileGroupingWithIcons(
  files: FileMetadata[],
  isGroupByType: boolean,
  shouldBuildIndex: boolean
) {
  const typeOrderForWorker = useMemo(
    () => Object.fromEntries(Object.entries(FILE_TYPE_LABELS).map(([k, v]) => [k, v.order])),
    []
  );

  const [workerGrouped, setWorkerGrouped] = useState<
    Array<{ key: string; order: number; files: FileMetadata[] }> | null
  >(null);

  const requestIdRef = useRef(0);

  useEffect(() => {
    if (files.length <= GROUP_FILES_WORKER_THRESHOLD || !isGroupByType) {
      requestIdRef.current += 1;
      return;
    }

    const currentRequestId = ++requestIdRef.current;

    groupFilesInWorker(files as Parameters<typeof groupFilesInWorker>[0], typeOrderForWorker)
      .then((result) => {
        if (requestIdRef.current === currentRequestId) {
          setWorkerGrouped(result as Array<{ key: string; order: number; files: FileMetadata[] }>);
        }
      })
      .catch(() => {
        if (requestIdRef.current === currentRequestId) {
          setWorkerGrouped(null);
        }
      });

    return () => {
      requestIdRef.current = currentRequestId + 1;
    };
  }, [files, isGroupByType, typeOrderForWorker]);

  const memoGrouped = useMemo(() => {
    if (!isGroupByType) return null;

    const groups = new Map<string, FileMetadata[]>();
    files.forEach((file) => {
      const key = getTypeKey(file.mime_type);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(file);
    });

    return Array.from(groups.entries())
      .map(([key, groupFiles]) => ({
        key,
        ...(FILE_TYPE_LABELS[key] ?? FILE_TYPE_LABELS.other),
        files: groupFiles,
      }))
      .sort((a, b) => a.order - b.order);
  }, [files, isGroupByType]);

  const groupedFiles = useMemo(() => {
    if (!isGroupByType) return null;
    if (files.length > GROUP_FILES_WORKER_THRESHOLD && workerGrouped) {
      return workerGrouped.map(({ key, files: groupFiles }) => ({
        key,
        ...(FILE_TYPE_LABELS[key] ?? FILE_TYPE_LABELS.other),
        files: groupFiles,
      }));
    }
    return memoGrouped;
  }, [isGroupByType, files.length, workerGrouped, memoGrouped]);

  const displayFiles = useMemo(() => {
    if (!isGroupByType || !groupedFiles) return files;
    return groupedFiles.flatMap((group) => group.files);
  }, [files, isGroupByType, groupedFiles]);

  const emptyIndex = useMemo(() => new Map<string, number>(), []);
  const displayFileIndexById = useMemo(() => {
    if (!shouldBuildIndex) return emptyIndex;
    const m = new Map<string, number>();
    for (let i = 0; i < displayFiles.length; i += 1) {
      m.set(displayFiles[i]!.id, i);
    }
    return m;
  }, [displayFiles, shouldBuildIndex, emptyIndex]);

  return {
    groupedFiles,
    displayFiles,
    displayFileIndexById,
  };
}

function useTimeGrouping(files: FileMetadata[], isGroupByTime: boolean) {
  const timeGroupedFiles = useMemo(() => {
    if (!isGroupByTime) return null;

    const groups = new Map<string, { label: string; sortKey: number; files: FileMetadata[] }>();

    for (const file of files) {
      const createdAt = file.created_at;
      const { key, label, sortKey } = getTimeGroupInfo(createdAt);
      const existing = groups.get(key);
      if (existing) {
        existing.files.push(file);
      } else {
        groups.set(key, { label, sortKey, files: [file] });
      }
    }

    return Array.from(groups.entries())
      .map(([key, { label, sortKey, files: groupFiles }]) => ({
        key,
        label,
        sortKey,
        files: groupFiles,
      }))
      .sort((a, b) => b.sortKey - a.sortKey);
  }, [files, isGroupByTime]);

  const displayFilesForTime = useMemo(() => {
    if (!isGroupByTime || !timeGroupedFiles) return files;
    return timeGroupedFiles.flatMap((group) => group.files);
  }, [files, isGroupByTime, timeGroupedFiles]);

  return {
    timeGroupedFiles,
    displayFilesForTime,
  };
}

export function useFileList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentFolderId = searchParams.get('folder') || null;

  // 使用抽取的过滤器 Hook
  const {
    search,
    mimeType,
    sortBy,
    debouncedSearch,
    sortField,
    sortOrder,
    isGroupByType,
    isGroupByTime,
    handleSearchChange,
    handleMimeTypeChange,
    handleSortChange,
  } = useFileFilters();

  // 使用 TanStack Query 获取文件
  const {
    data: filesData,
    fetchNextPage: loadMore,
    hasNextPage: hasMore,
    isFetchingNextPage: loadingMore,
    isLoading: loadingFiles,
    isFetching: isFetchingFiles,
    refetch: refetchFiles,
  } = useFiles({
    search: debouncedSearch || undefined,
    mime_type: mimeType || undefined,
    folder_id: currentFolderId,
    sort_by: sortField,
    sort_order: sortOrder,
  });

  const files = useMemo(() => {
    const flat = filesData?.pages.flatMap((page) => page.files) ?? [];
    if (flat.length <= 1) return flat;
    const seen = new Set<string>();
    const deduped: FileMetadata[] = [];
    for (const file of flat) {
      if (seen.has(file.id)) continue;
      seen.add(file.id);
      deduped.push(file);
    }
    return deduped;
  }, [filesData]);
  const totalItems = filesData?.pages[0]?.total ?? 0;

  // 使用 TanStack Query 获取文件夹内容
  const {
    data: folderContents,
    isLoading: loadingFolders,
    refetch: refetchFolders,
  } = useFolderContents(currentFolderId);

  const folders = useMemo(() => folderContents?.folders ?? [], [folderContents]);
  const folderPath = useMemo(() => folderContents?.path ?? [], [folderContents]);

  // 使用 TanStack Query Mutations
  const {
    deleteFile: deleteFileMutation,
    batchDeleteFiles: batchDeleteMutation,
    deleteFolder: deleteFolderMutation,
    renameFolder: renameFolderMutation,
    renameFile: renameFileMutation,
  } = useFileMutations();

  // 使用抽取的选择状态 Hook
  const {
    selectedFiles,
    selectedFolders,
    selectedFileIds,
    selectedFolderIds,
    allFilesSelected,
    toggleSelectAll,
    clearSelection,
    setSelectedFiles,
    setSelectedFolders,
  } = useFileSelection(files, folders);

  const [previewFile, setPreviewFile] = useState<FileMetadata | null>(null);

  // 使用带 icon 的分组 Hook
  const {
    groupedFiles,
    displayFiles,
    displayFileIndexById,
  } = useFileGroupingWithIcons(files, isGroupByType, previewFile !== null);

  // 使用时间分组 Hook
  const {
    timeGroupedFiles,
    displayFilesForTime,
  } = useTimeGrouping(files, isGroupByTime);

  // 对话框状态
  const [shareFile, setShareFile] = useState<FileMetadata | null>(null);
  const [showBatchShare, setShowBatchShare] = useState(false);
  const [batchShareFileIds, setBatchShareFileIds] = useState<string[]>([]);
  const [showBatchMove, setShowBatchMove] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<Folder | null>(null);
  const [renamingFile, setRenamingFile] = useState<FileMetadata | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'file' | 'folder' | 'batch';
    id?: string;
    name?: string;
    fileCount?: number;
    folderCount?: number;
  } | null>(null);
  
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [batchDownloading, setBatchDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clearError = useCallback(() => setError(null), []);

  const navigateToFolder = useCallback((folderId: string | null) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (folderId) {
          next.set('folder', folderId);
        } else {
          next.delete('folder');
        }
        return next;
      },
      { replace: false }
    );
    setSelectedFiles(new Set());
    setSelectedFolders(new Set());
  }, [setSearchParams, setSelectedFiles, setSelectedFolders]);

  const displayFolders = useMemo(() => {
    if (mimeType !== '' && mimeType !== MIME_FILTER_FOLDERS) return [];
    const q = debouncedSearch?.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter((f) => f.name.toLowerCase().includes(q));
  }, [mimeType, folders, debouncedSearch]);

  const handleSelectFile = useCallback((fileId: string, selected: boolean) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(fileId);
      } else {
        next.delete(fileId);
      }
      return next;
    });
  }, [setSelectedFiles]);

  const handleSelectFolder = useCallback((folderId: string, selected: boolean) => {
    setSelectedFolders((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(folderId);
      } else {
        next.delete(folderId);
      }
      return next;
    });
  }, [setSelectedFolders]);

  const handleDelete = useCallback((fileId: string) => {
    const file = files.find((f) => f.id === fileId);
    setDeleteConfirm({
      type: 'file',
      id: fileId,
      name: file?.original_filename || '文件',
    });
  }, [files]);

  const handleBatchDelete = useCallback(() => {
    const fileCount = selectedFiles.size;
    const folderCount = selectedFolders.size;
    if (fileCount === 0 && folderCount === 0) return;

    setDeleteConfirm({
      type: 'batch',
      fileCount,
      folderCount,
    });
  }, [selectedFiles.size, selectedFolders.size]);

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
  }, [deleteConfirm, deleteFileMutation, deleteFolderMutation, batchDeleteMutation, selectedFiles.size, selectedFolders.size, selectedFileIds, selectedFolderIds, setSelectedFiles, setSelectedFolders]);

  const handleRenameFolderSubmit = useCallback(async (id: string, name: string) => {
    try {
      await renameFolderMutation.mutateAsync({ id, name });
      setRenamingFolder(null);
    } catch (err) {
      setError(getErrorMessage(err, '重命名失败'));
    }
  }, [renameFolderMutation]);

  const handleRenameFileSubmit = useCallback(async (id: string, name: string) => {
    try {
      await renameFileMutation.mutateAsync({ id, name });
      setRenamingFile(null);
    } catch (err) {
      setError(getErrorMessage(err, '重命名失败'));
    }
  }, [renameFileMutation]);

  const handleDownload = useCallback(async (file: FileMetadata) => {
    try {
      await fileService.downloadFile(file.id, file.original_filename);
    } catch (err) {
      setError(getErrorMessage(err, '下载失败'));
    }
  }, []);

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
  }, [selectedFiles.size, selectedFolders.size, selectedFileIds, selectedFolderIds]);

  const handleShowBatchMove = useCallback(() => {
    if (selectedFiles.size === 0 && selectedFolders.size === 0) return;
    setShowBatchMove(true);
  }, [selectedFiles.size, selectedFolders.size]);

  const handleShowBatchShare = useCallback(() => {
    if (selectedFiles.size === 0) return;
    setBatchShareFileIds(selectedFileIds);
    setShowBatchShare(true);
  }, [selectedFiles.size, selectedFileIds]);

  const handleDropOnBreadcrumb = useCallback(async (targetFolderId: string | null, e: React.DragEvent) => {
    e.preventDefault();
    const fileId = e.dataTransfer.getData('application/file-id');
    if (!fileId) return;

    try {
      await folderService.moveFilesToFolder([fileId], targetFolderId);
      refetchFiles();
      refetchFolders();
    } catch (err) {
      setError(getErrorMessage(err, '移动失败'));
    }
  }, [refetchFiles, refetchFolders]);

  const addFolderToList = useCallback(() => {
    refetchFolders();
  }, [refetchFolders]);

  return {
    files,
    folderPath,
    search,
    mimeType,
    sortBy,
    selectedFiles,
    selectedFolders,
    selectedFileIds,
    selectedFolderIds,
    currentFolderId,
    error,
    clearError,
    isLoading: loadingFiles || loadingFolders,
    isRevalidating: isFetchingFiles,
    totalItems,
    isGroupByType,
    isGroupByTime,
    groupedFiles,
    timeGroupedFiles,
    displayFolders,
    displayFiles: isGroupByTime ? displayFilesForTime : displayFiles,
    displayFileIndexById,
    totalPages: Math.ceil(totalItems / 50), // 简化处理，假设 limit 为 50
    page: 1, // 简化处理，无限滚动不需要页码
    hasMore,
    loadingMore,
    loadMore,
    allFilesSelected,
    handleSearchChange,
    handleMimeTypeChange,
    handleSortChange,
    toggleSelectAll,
    handleSelectFile,
    handleSelectFolder,
    handleRenameFolder: setRenamingFolder,
    handleRenameFile: setRenamingFile,
    handleRenameFolderSubmit,
    handleRenameFileSubmit,
    getOptimisticMoveRollback: () => () => {}, // 简化处理
    navigateToFolder,
    handleDelete,
    handleDownload,
    handleBatchDownload,
    handleBatchDelete,
    handleShowBatchMove,
    handleShowBatchShare,
    handleDropOnBreadcrumb,
    loadFiles: refetchFiles,
    loadFolders: refetchFolders,
    clearSelection,
    addFolderToList,
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
    deleteLoading,
    executeDelete,
    setDeleteConfirm,
    batchDownloading,
  };
}
