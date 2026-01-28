import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fileService, type FileMetadata, type FileListQuery } from '../../services/files';
import { folderService, type Folder } from '../../services/folders';
import { getErrorMessage } from '../../utils/error';
import {
  getCacheKey,
  getCachedFileList,
  setCachedFileList,
  clearFileListCache,
} from '../../utils/fileListCache';
import { BATCH_LIMITS, FILE_LIST } from '../../constants';
import { useDebounce } from '../../hooks/useDebounce';
import { useRequestDedup } from '../../hooks/useRequestDedup';
import { useKeyboardShortcuts, SHORTCUTS } from '../../hooks/useKeyboardShortcuts';
import type { ReactNode } from 'react';
const FILE_TYPE_LABELS: Record<string, { label: string; icon: ReactNode; order: number }> = {
  image: { label: '图片', icon: null, order: 1 },
  gif: { label: 'GIF', icon: null, order: 2 },
  video: { label: '视频', icon: null, order: 3 },
  audio: { label: '音频', icon: null, order: 4 },
  'application/pdf': { label: 'PDF', icon: null, order: 5 },
  text: { label: '文本', icon: null, order: 6 },
  'application/zip': { label: '压缩包', icon: null, order: 7 },
  application: { label: '文档', icon: null, order: 8 },
  other: { label: '其他', icon: null, order: 99 },
};

const getTypeKey = (mime: string): string => {
  if (mime === 'image/gif') return 'gif';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf') return 'application/pdf';
  if (mime.startsWith('text/')) return 'text';
  if (mime === 'application/zip' || mime === 'application/x-zip-compressed') return 'application/zip';
  if (mime.startsWith('application/')) return 'application';
  return 'other';
};

function useFileFiltersAndSorting() {
  const [search, setSearch] = useState('');
  const [mimeType, setMimeType] = useState('');
  const [sortBy, setSortBy] = useState<import('./FileListFilters').SortOption>(() => {
    const saved = localStorage.getItem('fileListSortBy');
    return (saved as import('./FileListFilters').SortOption) || 'created_at_desc';
  });

  const debouncedSearch = useDebounce(search, 300);

  const [sortField, sortOrder] = useMemo(() => {
    if (sortBy === 'type_group') {
      return ['created_at', 'desc'] as const;
    }
    if (sortBy.startsWith('created_at_')) {
      return ['created_at', sortBy.endsWith('_asc') ? 'asc' : 'desc'] as const;
    }
    if (sortBy.startsWith('file_size_')) {
      return ['file_size', sortBy.endsWith('_asc') ? 'asc' : 'desc'] as const;
    }
    if (sortBy.startsWith('filename_')) {
      return ['filename', sortBy.endsWith('_asc') ? 'asc' : 'desc'] as const;
    }
    const [field, order] = sortBy.split('_') as [string, string];
    return [field as 'created_at' | 'filename' | 'file_size', order as 'asc' | 'desc'] as const;
  }, [sortBy]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
  }, []);

  const handleMimeTypeChange = useCallback((value: string) => {
    setMimeType(value);
  }, []);

  const handleSortChange = useCallback((value: import('./FileListFilters').SortOption) => {
    clearFileListCache();
    setSortBy(value);
    localStorage.setItem('fileListSortBy', value);
  }, []);

  return {
    search,
    mimeType,
    sortBy,
    debouncedSearch,
    sortField,
    sortOrder,
    handleSearchChange,
    handleMimeTypeChange,
    handleSortChange,
    setSearch,
    setMimeType,
    setSortBy,
  };
}

function useSelectionState(files: FileMetadata[]) {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());

  const selectedFileIds = useMemo(() => Array.from(selectedFiles), [selectedFiles]);
  const selectedFolderIds = useMemo(() => Array.from(selectedFolders), [selectedFolders]);

  const toggleSelectFile = useCallback((fileId: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      next.has(fileId) ? next.delete(fileId) : next.add(fileId);
      return next;
    });
  }, []);

  const toggleSelectFolder = useCallback((folderId: string) => {
    setSelectedFolders((prev) => {
      const next = new Set(prev);
      next.has(folderId) ? next.delete(folderId) : next.add(folderId);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set());
      setSelectedFolders(new Set());
    } else {
      setSelectedFiles(new Set(files.map((f) => f.id)));
      setSelectedFolders(new Set());
    }
  }, [files, selectedFiles.size]);

  const allFilesSelected = useMemo(
    () => files.length > 0 && selectedFiles.size === files.length,
    [files.length, selectedFiles.size]
  );

  return {
    selectedFiles,
    selectedFolders,
    selectedFileIds,
    selectedFolderIds,
    toggleSelectFile,
    toggleSelectFolder,
    toggleSelectAll,
    allFilesSelected,
    setSelectedFiles,
    setSelectedFolders,
  };
}

export function useFileList() {
  const [searchParams, setSearchParams] = useSearchParams();

  // 文件状态
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // 文件夹状态
  const currentFolderId = searchParams.get('folder') || null;
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderPath, setFolderPath] = useState<Folder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);

  // 过滤器 + 排序
  const {
    search,
    mimeType,
    sortBy,
    debouncedSearch,
    sortField,
    sortOrder,
    handleSearchChange: baseHandleSearchChange,
    handleMimeTypeChange: baseHandleMimeTypeChange,
    handleSortChange: baseHandleSortChange,
    setSearch,
    setMimeType,
  } = useFileFiltersAndSorting();

  // 选择状态
  const {
    selectedFiles,
    selectedFolders,
    selectedFileIds,
    selectedFolderIds,
    toggleSelectFile,
    toggleSelectFolder,
    toggleSelectAll,
    allFilesSelected,
    setSelectedFiles,
    setSelectedFolders,
  } = useSelectionState(files);

  // 对话框状态
  const [previewFile, setPreviewFile] = useState<FileMetadata | null>(null);
  const [shareFile, setShareFile] = useState<FileMetadata | null>(null);
  const [showBatchShare, setShowBatchShare] = useState(false);
  const [batchShareFileIds, setBatchShareFileIds] = useState<string[]>([]);
  const [showBatchMove, setShowBatchMove] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<Folder | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'file' | 'folder' | 'batch';
    id?: string;
    name?: string;
    fileCount?: number;
    folderCount?: number;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const limit = FILE_LIST.LIMIT;

  const listFilesStable = useCallback(
    (query?: FileListQuery) => fileService.listFiles(query),
    []
  );
  const dedupedListFiles = useRequestDedup(listFilesStable);

  // 加载文件夹
  const loadFolders = useCallback(async () => {
    setLoadingFolders(true);
    try {
      const contents = await folderService.getContents(currentFolderId);
      setFolders(contents.folders);
      setFolderPath(contents.path);
    } catch (err) {
      console.error('Failed to load folders:', err);
    } finally {
      setLoadingFolders(false);
    }
  }, [currentFolderId]);

  // 加载文件
  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);

    const query: FileListQuery = {
      page,
      limit,
      search: debouncedSearch || undefined,
      mime_type: mimeType || undefined,
      folder_id: currentFolderId,
      sort_by: sortField,
      sort_order: sortOrder,
    };

    const cacheKey = getCacheKey(query as Record<string, unknown>);
    const cached = getCachedFileList(cacheKey);

    if (cached) {
      setFiles(cached.files);
      setTotal(cached.total);
      setSelectedFiles(new Set());
      setLoading(false);
      return;
    }

    try {
      const response = await dedupedListFiles(query);
      setFiles(response.files);
      setTotal(response.total);
      setSelectedFiles(new Set());
      setCachedFileList(cacheKey, response.files, response.total);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load files'));
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, mimeType, currentFolderId, sortField, sortOrder, dedupedListFiles]);

  // 初始化加载 / 依赖变更时重新加载
  useEffect(() => {
    loadFolders();
    loadFiles();
  }, [loadFolders, loadFiles]);

  // 预取下一页
  useEffect(() => {
    const computedTotalPages = Math.ceil(total / limit);
    if (page >= computedTotalPages || loading || total === 0) return;

    const prefetchTimeout = setTimeout(() => {
      const nextPageQuery: FileListQuery = {
        page: page + 1,
        limit,
        search: debouncedSearch || undefined,
        mime_type: mimeType || undefined,
        folder_id: currentFolderId,
        sort_by: sortField,
        sort_order: sortOrder,
      };

      const cacheKey = getCacheKey(nextPageQuery as Record<string, unknown>);
      if (!getCachedFileList(cacheKey)) {
        dedupedListFiles(nextPageQuery)
          .then((response) => {
            setCachedFileList(cacheKey, response.files, response.total);
          })
          .catch(() => {
            // ignore prefetch errors
          });
      }
    }, 500);

    return () => clearTimeout(prefetchTimeout);
  }, [page, total, loading, limit, debouncedSearch, mimeType, currentFolderId, sortField, sortOrder, dedupedListFiles]);

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
    setPage(1);
    setSelectedFiles(new Set());
    setSelectedFolders(new Set());
  }, [setSearchParams]);

  const isGroupByType = sortBy === 'type_group';

  const groupedFiles = useMemo(() => {
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

  const displayFiles = useMemo(() => {
    if (!isGroupByType || !groupedFiles) return files;
    return groupedFiles.flatMap((group) => group.files);
  }, [files, isGroupByType, groupedFiles]);

  const displayFileIndexById = useMemo(() => {
    const m = new Map<string, number>();
    for (let i = 0; i < displayFiles.length; i += 1) {
      m.set(displayFiles[i]!.id, i);
    }
    return m;
  }, [displayFiles]);

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
        await fileService.deleteFile(deleteConfirm.id);
        clearFileListCache();
        loadFiles();
      } else if (deleteConfirm.type === 'folder' && deleteConfirm.id) {
        await folderService.delete(deleteConfirm.id);
        loadFolders();
      } else if (deleteConfirm.type === 'batch') {
        const promises: Promise<unknown>[] = [];

        if (selectedFiles.size > 0) {
          promises.push(fileService.batchDelete(selectedFileIds));
        }

        if (selectedFolders.size > 0) {
          const folderIds = Array.from(selectedFolders);
          promises.push(
            Promise.all(folderIds.map((id) => folderService.delete(id)))
          );
        }

        await Promise.all(promises);
        setSelectedFiles(new Set());
        setSelectedFolders(new Set());
        clearFileListCache();
        loadFiles();
        loadFolders();
      }
      setDeleteConfirm(null);
    } catch (err) {
      setError(getErrorMessage(err, '删除失败'));
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteConfirm, selectedFiles, selectedFolders, selectedFileIds, loadFiles, loadFolders]);

  const handleBatchDownload = async () => {
    if (selectedFiles.size === 0 && selectedFolders.size === 0) return;
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
        setError(
          `单次批量下载最多 ${BATCH_LIMITS.MAX_DOWNLOAD_ZIP_FILES} 个文件（当前 ${allFileIds.length}）。请缩小选择范围后重试。`
        );
        return;
      }

      await fileService.downloadZip(allFileIds);
    } catch (err) {
      alert(getErrorMessage(err, '批量下载失败'));
    }
  };

  const handleDownload = async (file: FileMetadata) => {
    try {
      await fileService.downloadFile(file.id, file.original_filename);
    } catch (err) {
      alert(getErrorMessage(err, '下载失败'));
    }
  };

  const handleDropOnFolder = useCallback(async (e: React.DragEvent, targetFolder: Folder) => {
    const fileId = e.dataTransfer.getData('application/file-id');
    const folderId = e.dataTransfer.getData('application/folder-id');

    if (fileId) {
      try {
        await folderService.moveFilesToFolder([fileId], targetFolder.id);
        clearFileListCache();
        loadFiles();
      } catch (err) {
        alert(getErrorMessage(err, '移动文件失败'));
      }
    } else if (folderId && folderId !== targetFolder.id) {
      try {
        await folderService.move(folderId, targetFolder.id);
        loadFolders();
      } catch (err) {
        alert(getErrorMessage(err, '移动文件夹失败'));
      }
    }
  }, [loadFiles, loadFolders]);

  const handleDropOnBreadcrumb = useCallback(async (e: React.DragEvent, targetFolderId: string | null) => {
    const fileId = e.dataTransfer.getData('application/file-id');
    const folderId = e.dataTransfer.getData('application/folder-id');

    if (fileId) {
      try {
        await folderService.moveFilesToFolder([fileId], targetFolderId);
        clearFileListCache();
        loadFiles();
      } catch (err) {
        alert(getErrorMessage(err, '移动文件失败'));
      }
    } else if (folderId && folderId !== targetFolderId) {
      try {
        await folderService.move(folderId, targetFolderId);
        loadFolders();
      } catch (err) {
        alert(getErrorMessage(err, '移动文件夹失败'));
      }
    }
  }, [loadFiles, loadFolders]);

  const totalPages = useMemo(() => Math.ceil(total / limit), [total, limit]);

  const handleShowBatchMove = useCallback(() => setShowBatchMove(true), []);

  const handleShowBatchShare = useCallback(async () => {
    if (selectedFiles.size === 0 && selectedFolders.size === 0) return;

    try {
      let allFileIds = [...selectedFileIds];

      if (selectedFolders.size > 0) {
        const folderFileIds = await folderService.getFilesInFolders(selectedFolderIds);
        allFileIds = [...new Set([...allFileIds, ...folderFileIds])];
      }

      if (allFileIds.length === 0) {
        alert('没有可分享的文件');
        return;
      }

      setBatchShareFileIds(allFileIds);
      setShowBatchShare(true);
    } catch (err) {
      alert(getErrorMessage(err, '获取文件列表失败'));
    }
  }, [selectedFiles.size, selectedFolders.size, selectedFileIds, selectedFolderIds]);

  const handlePageChange = useCallback((newPage: number) => setPage(newPage), []);

  const handleSelectFile = toggleSelectFile;
  const handleSelectFolder = toggleSelectFolder;
  const handleOpenFolder = useCallback((folder: Folder) => navigateToFolder(folder.id), [navigateToFolder]);
  const handleRenameFolder = useCallback((folder: Folder) => setRenamingFolder(folder), []);

  const handleSearchChange = useCallback((value: string) => {
    baseHandleSearchChange(value);
    setPage(1);
  }, [baseHandleSearchChange]);

  const handleMimeTypeChange = useCallback((value: string) => {
    baseHandleMimeTypeChange(value);
    setPage(1);
  }, [baseHandleMimeTypeChange]);

  const handleSortChange = useCallback((value: import('./FileListFilters').SortOption) => {
    baseHandleSortChange(value);
    setPage(1);
  }, [baseHandleSortChange]);

  const handleFileDragStart = useCallback((e: React.DragEvent, file: FileMetadata) => {
    e.dataTransfer.setData('application/file-id', file.id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  useKeyboardShortcuts([
    {
      key: SHORTCUTS.SEARCH,
      handler: () => {
        const searchInput = (window as { __fileListSearchInput?: HTMLInputElement }).__fileListSearchInput;
        searchInput?.focus();
        searchInput?.select();
      },
      description: '聚焦搜索框',
    },
    {
      key: SHORTCUTS.SELECT_ALL,
      handler: () => files.length > 0 && toggleSelectAll(),
      description: '全选/取消全选',
    },
    {
      key: SHORTCUTS.BATCH_DELETE,
      handler: () => selectedFiles.size > 0 && handleBatchDelete(),
      description: '批量删除选中文件',
    },
    {
      key: SHORTCUTS.DELETE,
      handler: () => {
        if (selectedFiles.size !== 1) return;
        handleDelete(selectedFileIds[0]);
      },
      description: '删除选中的单个文件',
    },
    {
      key: SHORTCUTS.ESCAPE,
      handler: () => {
        setSelectedFiles(new Set());
        setSelectedFolders(new Set());
        setPreviewFile(null);
        setShareFile(null);
        setShowBatchShare(false);
        setShowBatchMove(false);
        setShowCreateFolder(false);
        setRenamingFolder(null);
      },
      description: '取消选择/关闭对话框',
      preventInInput: false,
    },
  ]);

  const totalItems = folders.length + files.length;
  const isLoading = loading || loadingFolders;

  return {
    // 状态
    files,
    folders,
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
    setError,

    // 列表与分组
    isLoading,
    totalItems,
    isGroupByType,
    groupedFiles,
    displayFiles,
    displayFileIndexById,
    totalPages,
    page,
    allFilesSelected,

    // 过滤与排序
    handleSearchChange,
    handleMimeTypeChange,
    handleSortChange,

    // 选择与导航
    toggleSelectAll,
    handleSelectFile,
    handleSelectFolder,
    handleOpenFolder,
    handleRenameFolder,
    navigateToFolder,
    handlePageChange,

    // 文件操作
    handleDownload,
    handleBatchDownload,
    handleBatchDelete,
    handleShowBatchMove,
    handleShowBatchShare,
    handleFileDragStart,
    handleDropOnFolder,
    handleDropOnBreadcrumb,

    // 对话框状态与操作
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
    deleteConfirm,
    deleteLoading,
    executeDelete,
    setDeleteConfirm,
  };
}

