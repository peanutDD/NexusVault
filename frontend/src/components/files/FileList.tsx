import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { fileService, type FileMetadata, type FileListQuery } from '../../services/files';
import { folderService, type Folder } from '../../services/folders';
import { getErrorMessage } from '../../utils/error';
import {
  Image,
  Film,
  Video,
  Music,
  FileText,
  FileCode,
  Archive,
  File,
  Folder as FolderIcon,
} from 'lucide-react';
import {
  getCacheKey,
  getCachedFileList,
  setCachedFileList,
  clearFileListCache,
} from '../../utils/fileListCache';
import { FILE_LIST } from '../../constants';
import { useCategories } from '../../hooks/useCategories';
import { useDebounce } from '../../hooks/useDebounce';
import { useRequestDedup } from '../../hooks/useRequestDedup';
import ErrorMessage from '../common/ErrorMessage';
import FileCard from './FileCard';
import FolderCard from './FolderCard';
import FolderBreadcrumb from './FolderBreadcrumb';
import FileListFilters from './FileListFilters';
import FileListPagination from './FileListPagination';
import FileListBatchActions from './FileListBatchActions';
import { FileCardSkeleton } from '../common/Skeleton';
import { useKeyboardShortcuts, SHORTCUTS } from '../../hooks/useKeyboardShortcuts';

// 懒加载重型对话框组件
const FilePreview = lazy(() => import('./FilePreview'));
const ShareDialog = lazy(() => import('./ShareDialog'));
const BatchShareDialog = lazy(() => import('./BatchShareDialog'));
const BatchMoveDialog = lazy(() => import('./BatchMoveDialog'));
const CreateFolderDialog = lazy(() => import('./CreateFolderDialog'));
const RenameFolderDialog = lazy(() => import('./RenameFolderDialog'));
const ConfirmDialog = lazy(() => import('../common/ConfirmDialog'));

export default function FileList() {
  // 文件状态
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  
  // 文件夹状态
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderPath, setFolderPath] = useState<Folder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  
  // 过滤器状态
  const [search, setSearch] = useState('');
  const [mimeType, setMimeType] = useState('');
  const [category, setCategory] = useState<string>('');
  const [sortBy, setSortBy] = useState<import('./FileListFilters').SortOption>(() => {
    const saved = localStorage.getItem('fileListSortBy');
    return (saved as import('./FileListFilters').SortOption) || 'created_at_desc';
  });
  
  // 选择状态
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  
  // 缓存 selectedFileIds，避免多次 Array.from 转换
  const selectedFileIds = useMemo(() => Array.from(selectedFiles), [selectedFiles]);
  
  // 对话框状态
  const [previewFile, setPreviewFile] = useState<FileMetadata | null>(null);
  const [shareFile, setShareFile] = useState<FileMetadata | null>(null);
  const [showBatchShare, setShowBatchShare] = useState(false);
  const [showBatchMove, setShowBatchMove] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<Folder | null>(null);
  
  // 删除确认对话框状态
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'file' | 'folder' | 'batch';
    id?: string;
    name?: string;
    fileCount?: number;
    folderCount?: number;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { categories, loading: loadingCategories, refresh: refreshCategories } = useCategories();
  const limit = FILE_LIST.LIMIT;

  const debouncedSearch = useDebounce(search, 300);

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

  // 解析排序选项
  const [sortField, sortOrder] = useMemo(() => {
    // 按类型分组时，后端仍按时间排序，前端负责分组
    if (sortBy === 'type_group') {
      return ['created_at', 'desc'] as const;
    }
    // 特殊处理 created_at 和 file_size
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

  // 加载文件
  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    const query: FileListQuery = {
      page,
      limit,
      search: debouncedSearch || undefined,
      mime_type: mimeType || undefined,
      category: category === '__uncategorized__' ? '' : (category || undefined),
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
  }, [page, limit, debouncedSearch, mimeType, category, currentFolderId, sortField, sortOrder, dedupedListFiles]);

  // 加载数据
  useEffect(() => {
    loadFolders();
    loadFiles();
  }, [loadFolders, loadFiles]);

  // 预取下一页数据（用户体验优化）
  useEffect(() => {
    // 计算总页数（避免依赖尚未定义的 totalPages）
    const computedTotalPages = Math.ceil(total / limit);
    
    // 仅在有下一页时预取
    if (page >= computedTotalPages || loading || total === 0) return;
    
    const prefetchTimeout = setTimeout(() => {
      const nextPageQuery: FileListQuery = {
        page: page + 1,
        limit,
        search: debouncedSearch || undefined,
        mime_type: mimeType || undefined,
        category: category === '__uncategorized__' ? '' : (category || undefined),
        folder_id: currentFolderId,
        sort_by: sortField,
        sort_order: sortOrder,
      };
      
      const cacheKey = getCacheKey(nextPageQuery as Record<string, unknown>);
      // 仅在缓存不存在时预取
      if (!getCachedFileList(cacheKey)) {
        dedupedListFiles(nextPageQuery)
          .then((response) => {
            setCachedFileList(cacheKey, response.files, response.total);
          })
          .catch(() => {
            // 预取失败忽略错误
          });
      }
    }, 500); // 延迟 500ms 后预取，避免频繁请求
    
    return () => clearTimeout(prefetchTimeout);
  }, [page, total, loading, limit, debouncedSearch, mimeType, category, currentFolderId, sortField, sortOrder, dedupedListFiles]);

  // 导航到文件夹
  const navigateToFolder = useCallback((folderId: string | null) => {
    setCurrentFolderId(folderId);
    setPage(1);
    setSelectedFiles(new Set());
    setSelectedFolders(new Set());
  }, []);

  // 按类型分组文件（仅当排序为 type_group 时）
  const isGroupByType = sortBy === 'type_group';
  
  const groupedFiles = useMemo(() => {
    if (!isGroupByType) return null;
    
    // Lucide 图标 + 彩色渐变效果
    const typeLabels: Record<string, { label: string; icon: React.ReactNode; order: number }> = {
      'image': { label: '图片', icon: <Image className="w-4 h-4 text-emerald-400" />, order: 1 },
      'gif': { label: 'GIF', icon: <Film className="w-4 h-4 text-pink-400" />, order: 2 },
      'video': { label: '视频', icon: <Video className="w-4 h-4 text-red-400" />, order: 3 },
      'audio': { label: '音频', icon: <Music className="w-4 h-4 text-violet-400" />, order: 4 },
      'application/pdf': { label: 'PDF', icon: <FileText className="w-4 h-4 text-orange-400" />, order: 5 },
      'text': { label: '文本', icon: <FileCode className="w-4 h-4 text-cyan-400" />, order: 6 },
      'application/zip': { label: '压缩包', icon: <Archive className="w-4 h-4 text-amber-400" />, order: 7 },
      'application': { label: '文档', icon: <File className="w-4 h-4 text-blue-400" />, order: 8 },
      'other': { label: '其他', icon: <File className="w-4 h-4 text-gray-400" />, order: 99 },
    };
    
    const getTypeKey = (mime: string): string => {
      if (mime === 'image/gif') return 'gif'; // GIF 单独分类
      if (mime.startsWith('image/')) return 'image';
      if (mime.startsWith('video/')) return 'video';
      if (mime.startsWith('audio/')) return 'audio';
      if (mime === 'application/pdf') return 'application/pdf';
      if (mime.startsWith('text/')) return 'text';
      if (mime === 'application/zip' || mime === 'application/x-zip-compressed') return 'application/zip';
      if (mime.startsWith('application/')) return 'application';
      return 'other';
    };
    
    const groups = new Map<string, FileMetadata[]>();
    
    files.forEach((file) => {
      const key = getTypeKey(file.mime_type);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(file);
    });
    
    // 按 order 排序
    return Array.from(groups.entries())
      .map(([key, groupFiles]) => ({
        key,
        ...typeLabels[key] || typeLabels.other,
        files: groupFiles,
      }))
      .sort((a, b) => a.order - b.order);
  }, [files, isGroupByType]);

  // 文件删除 - 显示确认对话框
  const handleDelete = useCallback((fileId: string) => {
    const file = files.find(f => f.id === fileId);
    setDeleteConfirm({
      type: 'file',
      id: fileId,
      name: file?.original_filename || '文件',
    });
  }, [files]);

  // 文件夹删除 - 显示确认对话框
  const handleDeleteFolder = useCallback((folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    setDeleteConfirm({
      type: 'folder',
      id: folderId,
      name: folder?.name || '文件夹',
    });
  }, [folders]);

  // 批量删除 - 显示确认对话框
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

  // 执行删除操作
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
            Promise.all(folderIds.map(id => folderService.delete(id)))
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

  // 批量下载
  const handleBatchDownload = async () => {
    if (selectedFiles.size === 0) return;
    try {
      await fileService.downloadZip(selectedFileIds);
    } catch (err) {
      alert(getErrorMessage(err, '批量下载失败'));
    }
  };

  // 下载文件
  const handleDownload = async (file: FileMetadata) => {
    try {
      await fileService.downloadFile(file.id, file.original_filename);
    } catch (err) {
      alert(getErrorMessage(err, '下载失败'));
    }
  };

  // 拖拽：移动文件到文件夹
  const handleDropOnFolder = useCallback(async (e: React.DragEvent, targetFolder: Folder) => {
    const fileId = e.dataTransfer.getData('application/file-id');
    const folderId = e.dataTransfer.getData('application/folder-id');
    
    if (fileId) {
      // 移动文件
      try {
        await folderService.moveFilesToFolder([fileId], targetFolder.id);
        clearFileListCache();
        loadFiles();
      } catch (err) {
        alert(getErrorMessage(err, '移动文件失败'));
      }
    } else if (folderId && folderId !== targetFolder.id) {
      // 移动文件夹
      try {
        await folderService.move(folderId, targetFolder.id);
        loadFolders();
      } catch (err) {
        alert(getErrorMessage(err, '移动文件夹失败'));
      }
    }
  }, [loadFiles, loadFolders]);

  // 拖拽：移动到面包屑位置
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

  // 选择切换 - 使用 useCallback 优化，避免每次渲染创建新函数
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

  // 使用 useCallback 优化
  const toggleSelectAll = useCallback(() => {
    setSelectedFiles((prev) =>
      prev.size === files.length ? new Set() : new Set(files.map((f) => f.id))
    );
  }, [files]);

  // 计算值（使用 useMemo 缓存，避免重复计算）
  const totalPages = useMemo(() => Math.ceil(total / limit), [total, limit]);
  const allFilesSelected = useMemo(
    () => files.length > 0 && selectedFiles.size === files.length,
    [files.length, selectedFiles.size]
  );
  // 批量操作回调
  const handleShowBatchMove = useCallback(() => setShowBatchMove(true), []);
  const handleShowBatchShare = useCallback(() => setShowBatchShare(true), []);
  const handlePageChange = useCallback((newPage: number) => setPage(newPage), []);
  
  // 事件处理器 - 直接使用 toggleSelectFile/toggleSelectFolder
  const handleSelectFile = toggleSelectFile;
  const handleSelectFolder = toggleSelectFolder;
  const handlePreview = useCallback((file: FileMetadata) => setPreviewFile(file), []);
  const handleShare = useCallback((file: FileMetadata) => setShareFile(file), []);
  const handleDeleteRow = useCallback((id: string) => handleDelete(id), [handleDelete]);
  const handleOpenFolder = useCallback((folder: Folder) => navigateToFolder(folder.id), [navigateToFolder]);
  const handleRenameFolder = useCallback((folder: Folder) => setRenamingFolder(folder), []);
  
  // 筛选器回调函数 - 使用 useCallback 避免每次渲染创建新函数
  const handleSearchChange = useCallback((v: string) => {
    setSearch(v);
    setPage(1);
  }, []);

  const handleMimeTypeChange = useCallback((v: string) => {
    setMimeType(v);
    setPage(1);
  }, []);

  const handleCategoryChange = useCallback((v: string) => {
    setCategory(v);
    setPage(1);
  }, []);

  const handleSortChange = useCallback((v: import('./FileListFilters').SortOption) => {
    clearFileListCache(); // 清除缓存确保获取最新排序结果
    setSortBy(v);
    setPage(1);
    localStorage.setItem('fileListSortBy', v); // 持久化排序选项
  }, []);

  // 拖拽开始：设置文件 ID
  const handleFileDragStart = useCallback((e: React.DragEvent, file: FileMetadata) => {
    e.dataTransfer.setData('application/file-id', file.id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  // 键盘快捷键 - 使用短路运算和 early return 简化
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
      // 使用短路运算替代 if
      handler: () => files.length > 0 && toggleSelectAll(),
      description: '全选/取消全选',
    },
    {
      key: SHORTCUTS.BATCH_DELETE,
      // 使用短路运算替代 if
      handler: () => selectedFiles.size > 0 && handleBatchDelete(),
      description: '批量删除选中文件',
    },
    {
      key: SHORTCUTS.DELETE,
      handler: () => {
        // 使用 early return 替代嵌套 if
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

  return (
    <div>
      {/* 面包屑导航 + 新建文件夹按钮 */}
      <div className="mb-4 flex items-center justify-between">
        <FolderBreadcrumb
          path={folderPath}
          onNavigate={navigateToFolder}
          onDrop={handleDropOnBreadcrumb}
        />
        <button
          type="button"
          onClick={() => setShowCreateFolder(true)}
          className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-500"
        >
          <PlusIcon />
          新建文件夹
        </button>
      </div>

      <FileListFilters
        search={search}
        mimeType={mimeType}
        category={category}
        sortBy={sortBy}
        categories={categories}
        onSearchChange={handleSearchChange}
        onMimeTypeChange={handleMimeTypeChange}
        onCategoryChange={handleCategoryChange}
        onSortChange={handleSortChange}
      />

      {/* 批量操作栏 */}
      <FileListBatchActions
        selectedFileCount={selectedFiles.size}
        selectedFolderCount={selectedFolders.size}
        onBatchMove={handleShowBatchMove}
        onBatchShare={handleShowBatchShare}
        onBatchDownload={handleBatchDownload}
        onBatchDelete={handleBatchDelete}
      />

      {error && (
        <ErrorMessage
          message={error}
          onClose={() => setError(null)}
          type="error"
        />
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          <FileCardSkeleton count={12} />
        </div>
      ) : totalItems === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-gray-800/50 py-16">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-700/50">
            <EmptyIcon />
          </div>
          <p className="text-lg font-medium text-gray-400">
            {currentFolderId ? '文件夹为空' : '暂无文件'}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {currentFolderId ? '拖拽文件到此处或创建子文件夹' : '上传你的第一个文件吧'}
          </p>
        </div>
      ) : (
        <>
          {/* 全选栏 */}
          <div className="mb-4 flex items-center justify-between rounded-lg bg-gray-800/50 px-4 py-3">
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <input
                type="checkbox"
                checked={allFilesSelected}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-purple-500 focus:ring-purple-500"
                aria-label="全选所有文件"
              />
              全选文件
            </label>
            <span className="text-sm text-gray-500">
              {folders.length > 0 && `${folders.length} 个文件夹 · `}
              {total} 个文件
            </span>
          </div>

          {/* 文件区域 - 按类型分组或普通列表 */}
          {isGroupByType && groupedFiles ? (
            // 分组视图：文件夹单独一组 + 各类型文件分组
            <div className="space-y-6">
              {/* 文件夹分组 */}
              {folders.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <FolderIcon className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm font-medium text-gray-400">文件夹</span>
                    <span className="text-xs text-gray-500">({folders.length})</span>
                    <div className="flex-1 h-px bg-gray-700/50" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {folders.map((folder) => (
                      <FolderCard
                        key={folder.id}
                        folder={folder}
                        isSelected={selectedFolders.has(folder.id)}
                        onSelect={handleSelectFolder}
                        onOpen={handleOpenFolder}
                        onRename={handleRenameFolder}
                        onDelete={handleDeleteFolder}
                        onDrop={handleDropOnFolder}
                      />
                    ))}
                  </div>
                </div>
              )}
              {/* 各类型文件分组 */}
              {groupedFiles.map((group) => (
                <div key={group.key}>
                  <div className="mb-3 flex items-center gap-2">
                    {group.icon}
                    <span className="text-sm font-medium text-gray-400">{group.label}</span>
                    <span className="text-xs text-gray-500">({group.files.length})</span>
                    <div className="flex-1 h-px bg-gray-700/50" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {group.files.map((file) => (
                      <FileCard
                        key={file.id}
                        file={file}
                        isSelected={selectedFiles.has(file.id)}
                        onSelect={handleSelectFile}
                        onPreview={handlePreview}
                        onShare={handleShare}
                        onDownload={handleDownload}
                        onDelete={handleDeleteRow}
                        onDragStart={handleFileDragStart}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // 普通列表视图：文件夹和文件混合显示
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {folders.map((folder) => (
                <FolderCard
                  key={folder.id}
                  folder={folder}
                  isSelected={selectedFolders.has(folder.id)}
                  onSelect={handleSelectFolder}
                  onOpen={handleOpenFolder}
                  onRename={handleRenameFolder}
                  onDelete={handleDeleteFolder}
                  onDrop={handleDropOnFolder}
                />
              ))}
              {files.map((file) => (
                <FileCard
                  key={file.id}
                  file={file}
                  isSelected={selectedFiles.has(file.id)}
                  onSelect={handleSelectFile}
                  onPreview={handlePreview}
                  onShare={handleShare}
                  onDownload={handleDownload}
                  onDelete={handleDeleteRow}
                  onDragStart={handleFileDragStart}
                />
              ))}
            </div>
          )}

          {/* 分页 */}
          <FileListPagination
            page={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </> 
      )}

      {/* 对话框 - 懒加载 */}
      <Suspense fallback={null}>
        {previewFile && (
          <FilePreview
            key={previewFile.id}
            file={previewFile}
            files={files}
            currentIndex={files.findIndex(f => f.id === previewFile.id)}
            onClose={() => setPreviewFile(null)}
            onNavigate={(file) => setPreviewFile(file)}
          />
        )}

        {shareFile && (
          <ShareDialog
            fileId={shareFile.id}
            filename={shareFile.original_filename}
            onClose={() => setShareFile(null)}
          />
        )}

        {showBatchShare && (
          <BatchShareDialog
            fileIds={selectedFileIds}
            fileCount={selectedFiles.size}
            onClose={() => setShowBatchShare(false)}
            onShareCreated={() => {
              setShowBatchShare(false);
              setSelectedFiles(new Set());
            }}
          />
        )}

        {showBatchMove && (
          <BatchMoveDialog
            fileIds={selectedFileIds}
            fileCount={selectedFiles.size}
            categories={categories}
            loadingCategories={loadingCategories}
            onClose={() => setShowBatchMove(false)}
            onMoved={() => {
              setShowBatchMove(false);
              setSelectedFiles(new Set());
              clearFileListCache();
              loadFiles();
              refreshCategories();
            }}
          />
        )}

        {showCreateFolder && (
          <CreateFolderDialog
            open={showCreateFolder}
            parentId={currentFolderId}
            onClose={() => setShowCreateFolder(false)}
            onCreated={() => {
              loadFolders();
            }}
          />
        )}

        {renamingFolder && (
          <RenameFolderDialog
            open={!!renamingFolder}
            folder={renamingFolder}
            onClose={() => setRenamingFolder(null)}
            onRenamed={() => {
              loadFolders();
            }}
          />
        )}

        {/* 删除确认对话框 */}
        {deleteConfirm && (
          <ConfirmDialog
            open={!!deleteConfirm}
            title={
              deleteConfirm.type === 'batch'
                ? '确认批量删除'
                : deleteConfirm.type === 'folder'
                  ? '确认删除文件夹'
                  : '确认删除文件'
            }
            message={
              deleteConfirm.type === 'batch'
                ? `即将删除 ${[
                    deleteConfirm.fileCount && `${deleteConfirm.fileCount} 个文件`,
                    deleteConfirm.folderCount && `${deleteConfirm.folderCount} 个文件夹`,
                  ].filter(Boolean).join(' 和 ')}。\n\n此操作不可撤销！`
                : deleteConfirm.type === 'folder'
                  ? `确定要删除文件夹「${deleteConfirm.name}」吗？\n\n文件夹内的所有内容也会被删除！`
                  : `确定要删除文件「${deleteConfirm.name}」吗？\n\n此操作不可撤销。`
            }
            confirmText="删除"
            cancelText="取消"
            variant="danger"
            loading={deleteLoading}
            onConfirm={executeDelete}
            onCancel={() => setDeleteConfirm(null)}
          />
        )}
      </Suspense>
    </div>
  );
}

// 图标组件
function EmptyIcon() {
  return (
    <svg className="h-10 w-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}
