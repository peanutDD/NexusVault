import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { FileMetadata } from '../../types/files';
import { FILE_COLLECTION_COUNTS_QUERY_KEY } from '../../services/fileListService';
import { MIME_FILTER_FOLDERS } from '../../constants';
import { getErrorMessage } from '../../utils/error';
import { useFileFilters } from '../../hooks/files/useFileFilters';
import { useFileSelection } from '../../hooks/files/useFileSelection';
import { FILE_TYPE_LABELS } from './fileTypeLabels';
import { useFiles } from '../../hooks/files/useFiles';
import { useFolderContents } from '../../hooks/folders/useFolders';
import { useFileUI } from '../../hooks/files/useFileUI';
import { useFileActions } from '../../hooks/files/useFileActions';
import {
  clearSmartFilterParams,
  toggleCollectionParam,
  toggleTagParam,
} from './fileListFilterParams';
import { useFileListScope } from './useFileListScope';
import {
  useFileGroupingWithIcons,
  useTimeGrouping,
  useTimeGroupingMixed,
} from './useFileListGrouping';
import { useFileListNavigation } from './useFileListNavigation';
import { useFileListOptimisticDelete } from './useFileListOptimisticDelete';

// 重新导出 FILE_TYPE_LABELS 以保持向后兼容
export { FILE_TYPE_LABELS };

export function useFileList() {
  const queryClient = useQueryClient();
  const {
    setSearchParams,
    currentFolderId,
    activeCollection,
    activeTagId,
  } = useFileListScope();

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

  const {
    data: filesData,
    fetchNextPage: loadMore,
    hasNextPage: hasMore,
    isFetchingNextPage: loadingMore,
    isLoading: loadingFiles,
    isFetching: isFetchingFiles,
    isError: hasFilesError,
    error: filesError,
    refetch: refetchFiles,
  } = useFiles({
    search: debouncedSearch || undefined,
    mime_type: mimeType || undefined,
    folder_id: currentFolderId,
    collection: activeCollection as Parameters<typeof useFiles>[0]['collection'],
    tag_id: activeTagId || undefined,
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
  const searchMetadata = filesData?.pages[0]?.search ?? null;
  const totalItems = filesData?.pages[0]?.total ?? 0;

  const sortedFiles = useMemo(() => {
    if (files.length <= 1) return files;
    if (!sortBy.startsWith('filename_')) return files;
    const dir = sortBy.endsWith('_asc') ? 1 : -1;
    const compareName = (a: string, b: string) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    const leadingZeroScore = (s: string) => {
      let score = 0;
      let i = 0;
      while (i < s.length) {
        const c = s.charCodeAt(i);
        const isDigit = c >= 48 && c <= 57;
        if (!isDigit) {
          i += 1;
          continue;
        }
        const start = i;
        while (i < s.length) {
          const cc = s.charCodeAt(i);
          if (cc < 48 || cc > 57) break;
          i += 1;
        }
        const raw = s.slice(start, i);
        const stripped = raw.replace(/^0+/, '');
        const normalized = stripped === '' ? '0' : stripped;
        score += raw.length - normalized.length;
      }
      return score;
    };
    const getTime = (v: string) => {
      const t = Date.parse(v);
      return Number.isFinite(t) ? t : 0;
    };
    const list = [...files];
    list.sort((a, b) => {
      const r = compareName(a.original_filename, b.original_filename);
      if (r !== 0) return r * dir;
      const z = leadingZeroScore(a.original_filename) - leadingZeroScore(b.original_filename);
      if (z !== 0) return z * dir;
      const tr = getTime(a.created_at) - getTime(b.created_at);
      if (tr !== 0) return tr;
      const cr = a.original_filename.localeCompare(b.original_filename, undefined, {
        numeric: false,
        sensitivity: 'base',
      });
      if (cr !== 0) return cr * dir;
      return a.id.localeCompare(b.id);
    });
    return list;
  }, [files, sortBy]);

  const {
    data: folderContents,
    isLoading: loadingFolders,
    isError: hasFoldersError,
    error: foldersError,
    refetch: refetchFolders,
  } = useFolderContents(currentFolderId);

  const folders = useMemo(() => folderContents?.folders ?? [], [folderContents]);
  const folderPath = useMemo(() => folderContents?.path ?? [], [folderContents]);

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

  const {
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
  } = useFileUI();

  const queryErrorMessage = useMemo(() => {
    if (hasFilesError) {
      return getErrorMessage(
        filesError,
        debouncedSearch?.trim() ? '搜索文件失败' : '加载文件列表失败',
      );
    }
    if (hasFoldersError) {
      return getErrorMessage(foldersError, '加载文件夹内容失败');
    }
    return null;
  }, [
    debouncedSearch,
    filesError,
    foldersError,
    hasFilesError,
    hasFoldersError,
  ]);
  const queryErrorKey = queryErrorMessage
    ? `${hasFilesError ? 'files' : 'folders'}:${queryErrorMessage}`
    : null;
  const hasBlockingQueryError = queryErrorKey !== null;

  const lastSelectionScopeRef = useRef<{ sortBy: string; mimeType: string } | null>(null);

  const {
    groupedFiles,
    displayFiles,
  } = useFileGroupingWithIcons(sortedFiles, isGroupByType, activeCollection);

  const {
    timeGroupedFiles,
    displayFilesForTime,
  } = useTimeGrouping(sortedFiles, isGroupByTime);

  const finalDisplayFiles = useMemo(
    () => (isGroupByTime ? displayFilesForTime : displayFiles),
    [isGroupByTime, displayFilesForTime, displayFiles]
  );

  const finalDisplayFileIndexById = useMemo(() => {
    if (previewFile === null) return new Map<string, number>();
    const m = new Map<string, number>();
    for (let i = 0; i < finalDisplayFiles.length; i += 1) {
      m.set(finalDisplayFiles[i]!.id, i);
    }
    return m;
  }, [finalDisplayFiles, previewFile]);

  const {
    deleteLoading,
    batchDownloading,
    handleDelete,
    handleBatchDelete,
    executeDelete: wrappedExecuteDelete,
    handleRenameFolderSubmit,
    handleRenameFileSubmit,
    handleDownload,
    handleBatchDownload,
    handleDropOnFolder,
    handleDropOnBreadcrumb,
  } = useFileActions({
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
  });

  const displayFolders = useMemo(() => {
    if (activeCollection || activeTagId) return [];
    if (mimeType !== '' && mimeType !== MIME_FILTER_FOLDERS) return [];
    const q = debouncedSearch?.trim().toLowerCase();
    const filtered = q ? folders.filter((f) => f.name.toLowerCase().includes(q)) : folders;
    if (filtered.length <= 1) return filtered;

    const compareName = (a: string, b: string) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    const getTime = (v: string) => {
      const t = Date.parse(v);
      return Number.isFinite(t) ? t : 0;
    };

    const list = [...filtered];
    if (sortBy === 'time_group' || sortBy.startsWith('created_at_')) {
      const dir = sortBy.endsWith('_asc') ? 1 : -1;
      list.sort((a, b) => {
        const r = getTime(a.created_at) - getTime(b.created_at);
        if (r !== 0) return r * dir;
        return compareName(a.name, b.name);
      });
      return list;
    }
    if (sortBy.startsWith('filename_')) {
      const dir = sortBy.endsWith('_asc') ? 1 : -1;
      list.sort((a, b) => compareName(a.name, b.name) * dir);
      return list;
    }
    list.sort((a, b) => compareName(a.name, b.name));
    return list;
  }, [activeCollection, activeTagId, mimeType, folders, debouncedSearch, sortBy]);

  const { timeGroupedItems } = useTimeGroupingMixed(sortedFiles, displayFolders, isGroupByTime);

  const visibleFileIds = useMemo(() => new Set(finalDisplayFiles.map((file) => file.id)), [finalDisplayFiles]);
  const visibleFolderIds = useMemo(() => new Set(displayFolders.map((folder) => folder.id)), [displayFolders]);

  useEffect(() => {
    setSelectedFiles((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(Array.from(prev).filter((id) => visibleFileIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
    setSelectedFolders((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(Array.from(prev).filter((id) => visibleFolderIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [visibleFileIds, visibleFolderIds, setSelectedFiles, setSelectedFolders]);

  useEffect(() => {
    if (lastSelectionScopeRef.current === null) {
      lastSelectionScopeRef.current = { sortBy, mimeType };
      return;
    }
    if (
      lastSelectionScopeRef.current.sortBy !== sortBy ||
      lastSelectionScopeRef.current.mimeType !== mimeType
    ) {
      clearSelection();
      lastSelectionScopeRef.current = { sortBy, mimeType };
    }
  }, [sortBy, mimeType, clearSelection]);

  const { navigateToFolder } = useFileListNavigation({
    currentFolderId,
    debouncedSearch,
    mimeType,
    sortBy,
    loadingFiles,
    loadingFolders,
    setSearchParams,
    setSelectedFiles,
    setSelectedFolders,
  });

  const optimisticDelete = useFileListOptimisticDelete({
    files,
    displayFolders,
    deleteConfirm,
    selectedFileIds,
    selectedFolderIds,
    executeDelete: wrappedExecuteDelete,
  });

  const handleShowBatchMove = useCallback(() => {
    if (selectedFiles.size === 0 && selectedFolders.size === 0) return;
    setShowBatchMove(true);
  }, [selectedFiles.size, selectedFolders.size, setShowBatchMove]);

  const handleShowBatchShare = useCallback(() => {
    if (selectedFiles.size === 0) return;
    setBatchShareFileIds(selectedFileIds);
    setShowBatchShare(true);
  }, [selectedFiles.size, selectedFileIds, setBatchShareFileIds, setShowBatchShare]);

  const refreshListsAfterMove = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['files'] }),
      queryClient.invalidateQueries({ queryKey: FILE_COLLECTION_COUNTS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ['folders', 'contents'] }),
    ]);
    await Promise.all([refetchFiles(), refetchFolders()]);
  }, [queryClient, refetchFiles, refetchFolders]);

  const addFolderToList = useCallback(() => {
    refetchFolders();
  }, [refetchFolders]);

  const handleCollectionChange = useCallback(
    (collection: string) => {
      setSearchParams(
        (prev) => toggleCollectionParam(prev, collection),
        { replace: false },
      );
      setSelectedFiles(new Set());
      setSelectedFolders(new Set());
    },
    [setSearchParams, setSelectedFiles, setSelectedFolders],
  );

  const handleTagChange = useCallback(
    (tagId: string) => {
      setSearchParams(
        (prev) => toggleTagParam(prev, tagId),
        { replace: false },
      );
      setSelectedFiles(new Set());
      setSelectedFolders(new Set());
    },
    [setSearchParams, setSelectedFiles, setSelectedFolders],
  );

  const handleResetFilters = useCallback(
    () => {
      setSearchParams(
        (prev) => clearSmartFilterParams(prev),
        { replace: false },
      );
      setSelectedFiles(new Set());
      setSelectedFolders(new Set());
    },
    [setSearchParams, setSelectedFiles, setSelectedFolders],
  );

  return {
    files: optimisticDelete.files,
    folderPath,
    search,
    searchMetadata,
    mimeType,
    sortBy,
    activeCollection,
    activeTagId,
    selectedFiles,
    selectedFolders,
    selectedFileIds,
    selectedFolderIds,
    currentFolderId,
    error: error ?? queryErrorMessage,
    clearError: error ? clearError : undefined,
    isLoading: (loadingFiles || loadingFolders) && !hasBlockingQueryError,
    isRevalidating: isFetchingFiles,
    totalItems,
    isGroupByType,
    isGroupByTime,
    groupedFiles,
    timeGroupedFiles,
    timeGroupedItems,
    displayFolders: optimisticDelete.folders,
    displayFiles: finalDisplayFiles,
    displayFileIndexById: finalDisplayFileIndexById,
    totalPages: Math.ceil(totalItems / 50),
    page: 1,
    hasMore,
    loadingMore,
    loadMore,
    allFilesSelected,
    handleSearchChange,
    handleMimeTypeChange,
    handleSortChange,
    handleCollectionChange,
    handleResetFilters,
    handleTagChange,
    toggleSelectAll,
    handleSelectFile: (fileId: string, selected: boolean) => {
      setSelectedFiles((prev) => {
        const next = new Set(prev);
        if (selected) next.add(fileId); else next.delete(fileId);
        return next;
      });
    },
    handleSelectFolder: (folderId: string, selected: boolean) => {
      setSelectedFolders((prev) => {
        const next = new Set(prev);
        if (selected) next.add(folderId); else next.delete(folderId);
        return next;
      });
    },
    handleRenameFolder: setRenamingFolder,
    handleRenameFile: setRenamingFile,
    handleRenameFolderSubmit,
    handleRenameFileSubmit,
    getOptimisticMoveRollback: () => () => {},
    navigateToFolder,
    handleDelete,
    handleDownload,
    handleBatchDownload,
    handleBatchDelete,
    handleShowBatchMove,
    handleShowBatchShare,
    handleDropOnFolder,
    handleDropOnBreadcrumb,
    loadFiles: refetchFiles,
    loadFolders: refetchFolders,
    refreshListsAfterMove,
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
    executeDelete: optimisticDelete.executeDelete,
    setDeleteConfirm,
    batchDownloading,
  };
}
