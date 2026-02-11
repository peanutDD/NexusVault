import { useState, useEffect, useCallback, useMemo, useRef, startTransition } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fileService } from '../../services/files';
import type { FileMetadata, FileListQuery, Folder } from '../../types';
import { folderService } from '../../services/folders';
import { getErrorMessage, isRequestCanceled } from '../../utils/error';
import {
  getCacheKey,
  getCachedFileListSync as getCachedFileList,
  setCachedFileListSync as setCachedFileList,
  clearFileListCacheSync as clearFileListCache,
} from '../../utils/fileListCache';
import { BATCH_LIMITS, FILE_LIST, MIME_FILTER_FOLDERS } from '../../constants';
import { useRequestDedup } from '../../hooks/useRequestDedup';
import { useKeyboardShortcuts, SHORTCUTS } from '../../hooks/useKeyboardShortcuts';
import { useFileFilters } from '../../hooks/files/useFileFilters';
import { useFileSelection } from '../../hooks/files/useFileSelection';
import { FILE_TYPE_LABELS } from './fileTypeLabels';
import { groupFilesInWorker } from '../../utils/workerPool';

// 重新导出 FILE_TYPE_LABELS 以保持向后兼容
export { FILE_TYPE_LABELS };

// 自定义分组 hook，使用完整版 FILE_TYPE_LABELS（带 icon）
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

/**
 * 根据日期获取时间分组的键和标签（精确到「天」）
 * 返回格式: { key: '2024-01-24', label: 'Jan 24, 2024', sortKey: 20240124 }
 */
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

/**
 * 文件分组 Hook（使用 Worker 池复用）
 * 修复：不再每次消息后 terminate Worker，使用池化复用
 */
function useFileGroupingWithIcons(files: FileMetadata[], isGroupByType: boolean) {
  const typeOrderForWorker = useMemo(
    () => Object.fromEntries(Object.entries(FILE_TYPE_LABELS).map(([k, v]) => [k, v.order])),
    []
  );

  const [workerGrouped, setWorkerGrouped] = useState<
    Array<{ key: string; order: number; files: FileMetadata[] }> | null
  >(null);

  // 用于取消的 ref
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (files.length <= GROUP_FILES_WORKER_THRESHOLD || !isGroupByType) {
      setWorkerGrouped(null);
      return;
    }

    // 递增请求 ID，用于检测竞态
    const currentRequestId = ++requestIdRef.current;

    // 使用 Worker 池执行分组（复用 Worker，不再每次创建/销毁）
    groupFilesInWorker(files as Parameters<typeof groupFilesInWorker>[0], typeOrderForWorker)
      .then((result) => {
        // 检查是否仍然是最新的请求
        if (requestIdRef.current === currentRequestId) {
          setWorkerGrouped(result as Array<{ key: string; order: number; files: FileMetadata[] }>);
        }
      })
      .catch(() => {
        // Worker 错误，回退到主线程计算（memoGrouped）
        if (requestIdRef.current === currentRequestId) {
          setWorkerGrouped(null);
        }
      });

    // 清理函数：标记当前请求已过期
    return () => {
      requestIdRef.current++;
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

  const displayFileIndexById = useMemo(() => {
    const m = new Map<string, number>();
    for (let i = 0; i < displayFiles.length; i += 1) {
      m.set(displayFiles[i]!.id, i);
    }
    return m;
  }, [displayFiles]);

  return {
    groupedFiles,
    displayFiles,
    displayFileIndexById,
  };
}

/**
 * 按时间分组 Hook
 * 将文件按月份分组，最新的月份在前
 */
function useTimeGrouping(files: FileMetadata[], isGroupByTime: boolean) {
  const timeGroupedFiles = useMemo(() => {
    if (!isGroupByTime) return null;

    const groups = new Map<string, { label: string; sortKey: number; files: FileMetadata[] }>();

    // 避免对同一月份重复计算 label/sortKey：仅在首次创建分组时调用 getTimeGroupInfo
    for (const file of files) {
      const createdAt = file.created_at;
      // 预判 key：仅用于 map 查询；label/sortKey 在首次命中时再正式计算
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

  // 文件状态（无限滚动：files 为已加载的累加列表，loadedPageCount 为已加载页数）
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedPageCount, setLoadedPageCount] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const loadingMoreRef = useRef(false);
  const lastRequestedPageRef = useRef(1);
  const nextAllowedLoadMoreAtRef = useRef(0);

  // 文件夹状态
  const currentFolderId = searchParams.get('folder') || null;
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderPath, setFolderPath] = useState<Folder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);

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
    handleSearchChange: baseHandleSearchChange,
    handleMimeTypeChange: baseHandleMimeTypeChange,
    handleSortChange: baseHandleSortChange,
  } = useFileFilters();

  // 使用抽取的选择状态 Hook
  const {
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
  } = useFileSelection(files, folders);

  // 使用带 icon 的分组 Hook（保持与 FileListContent 兼容）
  const {
    groupedFiles,
    displayFiles,
    displayFileIndexById,
  } = useFileGroupingWithIcons(files, isGroupByType);

  // 使用时间分组 Hook
  const {
    timeGroupedFiles,
    displayFilesForTime,
  } = useTimeGrouping(files, isGroupByTime);

  // 根据分组模式选择正确的 displayFiles
  const finalDisplayFiles = isGroupByTime ? displayFilesForTime : displayFiles;

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
  const [batchDownloading, setBatchDownloading] = useState(false);

  const limit = FILE_LIST.LIMIT;
  const fileListCacheKeyRef = useRef<string>('');
  const [isRevalidating, setIsRevalidating] = useState(false);

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

  // 创建文件夹后立即加入当前列表（乐观更新，无需 refetch）
  const addFolderToList = useCallback(
    (folder: Folder) => {
      const viewingParent = currentFolderId ?? null;
      const folderParent = folder.parent_id ?? null;
      if (viewingParent !== folderParent) return;
      setFolders((prev) => {
        if (prev.some((f) => f.id === folder.id)) return prev;
        return [...prev, folder].sort((a, b) => a.name.localeCompare(b.name));
      });
    },
    [currentFolderId]
  );

  // 加载文件（仅第一页）：stale-while-revalidate — 有缓存先展示，后台 revalidate 后更新
  const loadFiles = useCallback(async () => {
    setError(null);

    // 「仅文件夹」筛选：不请求文件列表，只展示文件夹
    if (mimeType === MIME_FILTER_FOLDERS) {
      setFiles([]);
      setTotal(0);
      setLoadedPageCount(1);
      setSelectedFiles(new Set());
      setLoading(false);
      setIsRevalidating(false);
      return;
    }

    const query: FileListQuery = {
      page: 1,
      limit,
      search: debouncedSearch || undefined,
      mime_type: mimeType || undefined,
      folder_id: currentFolderId,
      sort_by: sortField,
      sort_order: sortOrder,
    };

    const cacheKey = getCacheKey(query as Record<string, unknown>);
    fileListCacheKeyRef.current = cacheKey;
    const cached = getCachedFileList(cacheKey);

    if (cached) {
      startTransition(() => {
        setFiles(cached.files);
        setTotal(cached.total);
        setLoadedPageCount(1);
        setSelectedFiles(new Set());
        setLoading(false);
      });
      setIsRevalidating(true);
      dedupedListFiles(query)
        .then((response) => {
          if (fileListCacheKeyRef.current !== cacheKey) return;
          startTransition(() => {
            setFiles(response.files);
            setTotal(response.total ?? 0);
            setLoadedPageCount(1);
            setCachedFileList(cacheKey, response.files, response.total ?? 0);
          });
        })
        .catch(() => {
          // 后台 revalidate 失败不覆盖已有缓存展示，静默忽略
        })
        .finally(() => {
          if (fileListCacheKeyRef.current === cacheKey) setIsRevalidating(false);
        });
      return;
    }

    setLoading(true);
    try {
      const response = await dedupedListFiles(query);
      if (fileListCacheKeyRef.current !== cacheKey) return;
      // 关键修复：setLoading(false) 必须在 startTransition 内部
      // 否则会导致两次渲染：1) loading=false + 旧数据  2) 新数据
      // 这个中间状态会触发大量无意义的组件挂载/卸载，阻塞主线程
      startTransition(() => {
        setLoading(false);
        setFiles(response.files);
        setTotal(response.total ?? 0);
        setLoadedPageCount(1);
        setSelectedFiles(new Set());
        lastRequestedPageRef.current = 1;
        setCachedFileList(cacheKey, response.files, response.total ?? 0);
      });
    } catch (err) {
      if (isRequestCanceled(err)) return;
      setError(getErrorMessage(err, 'Failed to load files'));
      setLoading(false);
    }
  }, [limit, debouncedSearch, mimeType, currentFolderId, sortField, sortOrder, dedupedListFiles, setSelectedFiles]);

  const totalPages = useMemo(() => Math.ceil(total / limit), [total, limit]);
  const hasMore = loadedPageCount < totalPages && total > 0;

  // 加载更多（无限滚动）
  // 修复：添加竞态检查，防止快速切换文件夹时旧页数据追加到新列表
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMoreRef.current || loading) return;
    const now = Date.now();
    if (now < nextAllowedLoadMoreAtRef.current) return;
    // 基础冷却，避免短时间重复触发
    nextAllowedLoadMoreAtRef.current = now + 800;

    loadingMoreRef.current = true;
    const nextPage = loadedPageCount + 1;
    if (nextPage <= lastRequestedPageRef.current) {
      loadingMoreRef.current = false;
      return;
    }
    lastRequestedPageRef.current = nextPage;

    // 计算第一页的 cacheKey 用于竞态检查
    const firstPageQuery: FileListQuery = {
      page: 1,
      limit,
      search: debouncedSearch || undefined,
      mime_type: mimeType || undefined,
      folder_id: currentFolderId,
      sort_by: sortField,
      sort_order: sortOrder,
    };
    const firstPageCacheKey = getCacheKey(firstPageQuery as Record<string, unknown>);

    // 竞态检查：如果当前查询已变更，则放弃本次加载
    if (fileListCacheKeyRef.current !== firstPageCacheKey) return;

    const query: FileListQuery = {
      page: nextPage,
      limit,
      search: debouncedSearch || undefined,
      mime_type: mimeType || undefined,
      folder_id: currentFolderId,
      sort_by: sortField,
      sort_order: sortOrder,
    };

    const cacheKey = getCacheKey(query as Record<string, unknown>);
    const cached = getCachedFileList(cacheKey);

    setLoadingMore(true);
    try {
      if (cached) {
        // 再次检查竞态：缓存读取后可能查询已变更
        if (fileListCacheKeyRef.current !== firstPageCacheKey) return;
        startTransition(() => {
          setFiles((prev) => [...prev, ...cached.files]);
          setLoadedPageCount(nextPage);
        });
        return;
      }
      const response = await dedupedListFiles(query);
      // 请求完成后再次检查竞态：异步请求期间查询可能已变更
      if (fileListCacheKeyRef.current !== firstPageCacheKey) return;
      startTransition(() => {
        setFiles((prev) => [...prev, ...response.files]);
        setLoadedPageCount(nextPage);
        setCachedFileList(cacheKey, response.files, response.total ?? 0);
      });
    } catch (err) {
      if (isRequestCanceled(err)) return;
      // 允许失败后重试当前页
      if (lastRequestedPageRef.current === nextPage) {
        lastRequestedPageRef.current = nextPage - 1;
      }
      // 失败时增加退避，避免无限重试
      nextAllowedLoadMoreAtRef.current = Date.now() + 2000;
      setError(getErrorMessage(err, 'Failed to load more'));
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, loading, loadedPageCount, limit, debouncedSearch, mimeType, currentFolderId, sortField, sortOrder, dedupedListFiles]);

  // 初始化加载 / 依赖变更时重新加载（始终加载第 1 页）
  useEffect(() => {
    loadFolders();
    loadFiles();
  }, [loadFolders, loadFiles]);

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
    setLoadedPageCount(1);
    setSelectedFiles(new Set());
    setSelectedFolders(new Set());
  }, [setSearchParams, setSelectedFiles, setSelectedFolders]);

  /** 按类型筛选时隐藏文件夹：仅「全部」或「仅文件夹」时展示文件夹；有搜索词时只展示名称匹配的文件夹 */
  const displayFolders = useMemo(() => {
    if (mimeType !== '' && mimeType !== MIME_FILTER_FOLDERS) return [];
    const q = debouncedSearch?.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter((f) => f.name.toLowerCase().includes(q));
  }, [mimeType, folders, debouncedSearch]);

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
        setFiles((prev) => prev.filter((f) => f.id !== deleteConfirm.id));
        setTotal((prev) => Math.max(0, prev - 1));
        loadFiles();
      } else if (deleteConfirm.type === 'folder' && deleteConfirm.id) {
        await folderService.delete(deleteConfirm.id);
        setFolders((prev) => prev.filter((f) => f.id !== deleteConfirm.id));
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
        setFiles((prev) => prev.filter((f) => !selectedFileIds.includes(f.id)));
        setTotal((prev) => Math.max(0, prev - selectedFileIds.length));
        setFolders((prev) => prev.filter((f) => !selectedFolderIds.includes(f.id)));
        loadFiles();
        loadFolders();
      }
      setDeleteConfirm(null);
    } catch (err) {
      setError(getErrorMessage(err, '删除失败'));
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteConfirm, selectedFiles, selectedFolders, selectedFileIds, selectedFolderIds, setSelectedFiles, setSelectedFolders, loadFiles, loadFolders]);

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
        setError(
          `单次批量下载最多 ${BATCH_LIMITS.MAX_DOWNLOAD_ZIP_FILES} 个文件（当前 ${allFileIds.length}）。请缩小选择范围后重试。`
        );
        return;
      }

      await fileService.downloadZip(allFileIds);
    } catch (err) {
      alert(getErrorMessage(err, '批量下载失败'));
    } finally {
      setBatchDownloading(false);
    }
  }, [selectedFiles.size, selectedFolders.size, selectedFileIds, selectedFolderIds]);

  const handleDownload = useCallback(async (file: FileMetadata) => {
    try {
      await fileService.downloadFile(file.id, file.original_filename);
    } catch (err) {
      alert(getErrorMessage(err, '下载失败'));
    }
  }, []);

  /**
   * 移动前乐观更新：从当前列表移除被移动的项（仅当目标不是当前目录时），返回回滚函数。
   */
  const getOptimisticMoveRollback = useCallback(
    (fileIds: string[], folderIds: string[], targetFolderId: string | null) => {
      if (targetFolderId !== currentFolderId) {
        let prevFiles: FileMetadata[] | undefined;
        let prevFolders: Folder[] | undefined;
        setFiles((prev) => {
          prevFiles = prev;
          const idSet = new Set(fileIds);
          return prev.filter((f) => !idSet.has(f.id));
        });
        setFolders((prev) => {
          prevFolders = prev;
          const idSet = new Set(folderIds);
          return prev.filter((f) => !idSet.has(f.id));
        });
        return () => {
          if (prevFiles !== undefined) setFiles(prevFiles);
          if (prevFolders !== undefined) setFolders(prevFolders);
        };
      }
      return () => {};
    },
    [currentFolderId]
  );

  const handleDropOnFolder = useCallback(
    async (e: React.DragEvent, targetFolder: Folder) => {
      const fileId = e.dataTransfer.getData('application/file-id');
      const folderId = e.dataTransfer.getData('application/folder-id');

      if (fileId) {
        const rollback = getOptimisticMoveRollback([fileId], [], targetFolder.id);
        try {
          await folderService.moveFilesToFolder([fileId], targetFolder.id);
          clearFileListCache();
        } catch (err) {
          rollback();
          alert(getErrorMessage(err, '移动文件失败'));
        }
      } else if (folderId && folderId !== targetFolder.id) {
        const rollback = getOptimisticMoveRollback([], [folderId], targetFolder.id);
        try {
          await folderService.move(folderId, targetFolder.id);
        } catch (err) {
          rollback();
          alert(getErrorMessage(err, '移动文件夹失败'));
        }
      }
    },
    [getOptimisticMoveRollback]
  );

  const handleDropOnBreadcrumb = useCallback(
    async (e: React.DragEvent, targetFolderId: string | null) => {
      const fileId = e.dataTransfer.getData('application/file-id');
      const folderId = e.dataTransfer.getData('application/folder-id');

      if (fileId) {
        const rollback = getOptimisticMoveRollback([fileId], [], targetFolderId);
        try {
          await folderService.moveFilesToFolder([fileId], targetFolderId);
          clearFileListCache();
        } catch (err) {
          rollback();
          alert(getErrorMessage(err, '移动文件失败'));
        }
      } else if (folderId && folderId !== targetFolderId) {
        const rollback = getOptimisticMoveRollback([], [folderId], targetFolderId);
        try {
          await folderService.move(folderId, targetFolderId);
        } catch (err) {
          rollback();
          alert(getErrorMessage(err, '移动文件夹失败'));
        }
      }
    },
    [getOptimisticMoveRollback]
  );

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


  const handleSelectFile = toggleSelectFile;
  const handleSelectFolder = toggleSelectFolder;
  const handleOpenFolder = useCallback((folder: Folder) => navigateToFolder(folder.id), [navigateToFolder]);
  const handleRenameFolder = useCallback((folder: Folder) => setRenamingFolder(folder), []);

  /** 重命名文件夹：乐观更新列表中的名称，失败则回滚 */
  const handleRenameFolderSubmit = useCallback(
    async (folderId: string, newName: string) => {
      let prevFolders: Folder[] | undefined;
      setFolders((prev) => {
        prevFolders = prev;
        return prev.map((f) => (f.id === folderId ? { ...f, name: newName } : f));
      });
      try {
        await folderService.rename(folderId, newName);
      } catch (err) {
        if (prevFolders !== undefined) setFolders(prevFolders);
        throw err;
      }
    },
    []
  );

  const handleSearchChange = useCallback((value: string) => {
    baseHandleSearchChange(value);
    setLoadedPageCount(1);
  }, [baseHandleSearchChange]);

  const handleMimeTypeChange = useCallback((value: string) => {
    baseHandleMimeTypeChange(value);
    setLoadedPageCount(1);
  }, [baseHandleMimeTypeChange]);

  const handleSortChange = useCallback((value: import('../../hooks/files/useFileFilters').SortOption) => {
    baseHandleSortChange(value);
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
        clearSelection();
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

  const totalItems = displayFolders.length + (mimeType === MIME_FILTER_FOLDERS ? 0 : files.length);
  const isLoading = loading || loadingFolders;

  return {
    isRevalidating,
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
    isGroupByTime,
    groupedFiles,
    timeGroupedFiles,
    displayFolders,
    displayFiles: finalDisplayFiles,
    displayFileIndexById,
    totalPages,
    page: loadedPageCount,
    hasMore,
    loadingMore,
    loadMore,
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
    handleRenameFolderSubmit,
    getOptimisticMoveRollback,
    navigateToFolder,

    // 文件操作
    handleDelete,
    handleDownload,
    handleBatchDownload,
    handleBatchDelete,
    handleShowBatchMove,
    handleShowBatchShare,
    handleFileDragStart,
    handleDropOnFolder,
    handleDropOnBreadcrumb,
    loadFolders,
    loadFiles,
    clearSelection,
    addFolderToList,

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
    batchDownloading,
  };
}
