import { useState, useEffect, useCallback, useMemo } from 'react';
import { fileService, type FileMetadata, type FileListQuery } from '../../services/files';
import { folderService, type Folder } from '../../services/folders';
import { getErrorMessage } from '../../utils/error';
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
import FilePreview from './FilePreview';
import ErrorMessage from '../common/ErrorMessage';
import ShareDialog from './ShareDialog';
import BatchShareDialog from './BatchShareDialog';
import BatchMoveDialog from './BatchMoveDialog';
import FileCard from './FileCard';
import FolderCard from './FolderCard';
import FolderBreadcrumb from './FolderBreadcrumb';
import CreateFolderDialog from './CreateFolderDialog';
import RenameFolderDialog from './RenameFolderDialog';
import FileListFilters from './FileListFilters';
import { FileCardSkeleton } from '../common/Skeleton';
import { useKeyboardShortcuts, SHORTCUTS } from '../../hooks/useKeyboardShortcuts';

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
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sizeMin, setSizeMin] = useState('');
  const [sizeMax, setSizeMax] = useState('');
  
  // 选择状态
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  
  // 对话框状态
  const [previewFile, setPreviewFile] = useState<FileMetadata | null>(null);
  const [shareFile, setShareFile] = useState<FileMetadata | null>(null);
  const [showBatchShare, setShowBatchShare] = useState(false);
  const [showBatchMove, setShowBatchMove] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<Folder | null>(null);

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
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      size_min: sizeMin ? parseInt(sizeMin) * 1024 * 1024 : undefined,
      size_max: sizeMax ? parseInt(sizeMax) * 1024 * 1024 : undefined,
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
  }, [page, limit, debouncedSearch, mimeType, category, currentFolderId, dateFrom, dateTo, sizeMin, sizeMax, dedupedListFiles]);

  // 加载数据
  useEffect(() => {
    loadFolders();
    loadFiles();
  }, [loadFolders, loadFiles]);

  // 导航到文件夹
  const navigateToFolder = useCallback((folderId: string | null) => {
    setCurrentFolderId(folderId);
    setPage(1);
    setSelectedFiles(new Set());
    setSelectedFolders(new Set());
  }, []);

  // 文件删除
  const handleDelete = useCallback(async (fileId: string) => {
    if (!confirm('确定要删除此文件吗？')) return;
    try {
      await fileService.deleteFile(fileId);
      clearFileListCache();
      loadFiles();
    } catch (err) {
      alert(getErrorMessage(err, '删除失败'));
    }
  }, [loadFiles]);

  // 文件夹删除
  const handleDeleteFolder = useCallback(async (folderId: string) => {
    if (!confirm('确定要删除此文件夹吗？其中的文件将移至根目录。')) return;
    try {
      await folderService.delete(folderId);
      loadFolders();
    } catch (err) {
      alert(getErrorMessage(err, '删除文件夹失败'));
    }
  }, [loadFolders]);

  // 批量删除文件
  const handleBatchDelete = async () => {
    if (selectedFiles.size === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedFiles.size} 个文件吗？`)) return;
    try {
      await fileService.batchDelete(Array.from(selectedFiles));
      clearFileListCache();
      loadFiles();
    } catch (err) {
      alert(getErrorMessage(err, '批量删除失败'));
    }
  };

  // 批量下载
  const handleBatchDownload = async () => {
    if (selectedFiles.size === 0) return;
    try {
      await fileService.downloadZip(Array.from(selectedFiles));
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

  // 选择切换
  const toggleSelectFile = (fileId: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  const toggleSelectFolder = (folderId: string) => {
    setSelectedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(files.map((f) => f.id)));
    }
  };

  // 计算值
  const totalPages = useMemo(() => Math.ceil(total / limit), [total, limit]);
  const allFilesSelected = useMemo(
    () => files.length > 0 && selectedFiles.size === files.length,
    [files.length, selectedFiles.size]
  );
  
  // 事件处理器
  const handleSelectFile = useCallback((id: string) => toggleSelectFile(id), []);
  const handleSelectFolder = useCallback((id: string) => toggleSelectFolder(id), []);
  const handlePreview = useCallback((file: FileMetadata) => setPreviewFile(file), []);
  const handleShare = useCallback((file: FileMetadata) => setShareFile(file), []);
  const handleDeleteRow = useCallback((id: string) => handleDelete(id), [handleDelete]);
  const handleOpenFolder = useCallback((folder: Folder) => navigateToFolder(folder.id), [navigateToFolder]);
  const handleRenameFolder = useCallback((folder: Folder) => setRenamingFolder(folder), []);
  
  const handleClearFilters = useCallback(() => {
    setDateFrom('');
    setDateTo('');
    setSizeMin('');
    setSizeMax('');
    setCategory('');
    setPage(1);
  }, []);

  // 拖拽开始：设置文件 ID
  const handleFileDragStart = useCallback((e: React.DragEvent, file: FileMetadata) => {
    e.dataTransfer.setData('application/file-id', file.id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  // 键盘快捷键
  useKeyboardShortcuts([
    {
      key: SHORTCUTS.SEARCH,
      handler: () => {
        const w = window as unknown as {
          __fileListSearchInput?: HTMLInputElement;
        };
        const searchInput = w.__fileListSearchInput;
        searchInput?.focus();
        searchInput?.select();
      },
      description: '聚焦搜索框',
    },
    {
      key: SHORTCUTS.SELECT_ALL,
      handler: () => {
        if (files.length > 0) {
          toggleSelectAll();
        }
      },
      description: '全选/取消全选',
    },
    {
      key: SHORTCUTS.BATCH_DELETE,
      handler: () => {
        if (selectedFiles.size > 0) {
          handleBatchDelete();
        }
      },
      description: '批量删除选中文件',
    },
    {
      key: SHORTCUTS.DELETE,
      handler: () => {
        if (selectedFiles.size === 1) {
          const fileId = Array.from(selectedFiles)[0];
          handleDelete(fileId);
        }
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
        dateFrom={dateFrom}
        dateTo={dateTo}
        sizeMin={sizeMin}
        sizeMax={sizeMax}
        categories={categories}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        onMimeTypeChange={(v) => {
          setMimeType(v);
          setPage(1);
        }}
        onCategoryChange={(v) => {
          setCategory(v);
          setPage(1);
        }}
        onDateFromChange={(v) => {
          setDateFrom(v);
          setPage(1);
        }}
        onDateToChange={(v) => {
          setDateTo(v);
          setPage(1);
        }}
        onSizeMinChange={(v) => {
          setSizeMin(v);
          setPage(1);
        }}
        onSizeMaxChange={(v) => {
          setSizeMax(v);
          setPage(1);
        }}
        onClearFilters={handleClearFilters}
      />

      {/* 批量操作栏 */}
      {selectedFiles.size > 0 && (
        <div className="mb-4 p-3 bg-purple-500/20 dark:bg-purple-600/20 border border-purple-500/50 dark:border-purple-600/50 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in transition-all duration-200">
          <span className="text-purple-200 dark:text-purple-300 font-medium">
            已选择 {selectedFiles.size} 个文件
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowBatchMove(true)}
              className="px-3 sm:px-4 py-2 bg-amber-600 dark:bg-amber-700 text-white rounded-lg hover:bg-amber-700 dark:hover:bg-amber-600 transition-all duration-200 text-sm"
            >
              批量移动
            </button>
            <button
              onClick={() => setShowBatchShare(true)}
              className="px-3 sm:px-4 py-2 bg-green-600 dark:bg-green-700 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition-all duration-200 text-sm"
            >
              批量分享
            </button>
            <button
              onClick={handleBatchDownload}
              className="px-3 sm:px-4 py-2 bg-purple-600 dark:bg-purple-700 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 transition-all duration-200 text-sm"
            >
              批量下载 ZIP
            </button>
            <button
              onClick={handleBatchDelete}
              className="px-3 sm:px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-all duration-200 text-sm"
            >
              批量删除 (Ctrl+Shift+D)
            </button>
          </div>
        </div>
      )}

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

          {/* 文件夹 + 文件卡片网格 */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {/* 文件夹 */}
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
            
            {/* 文件 */}
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

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 rounded-lg bg-gray-800 px-4 py-2 text-sm text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeftIcon />
                上一页
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`h-9 w-9 rounded-lg text-sm font-medium transition-colors ${
                        page === pageNum
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 rounded-lg bg-gray-800 px-4 py-2 text-sm text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                下一页
                <ChevronRightIcon />
              </button>
            </div>
          )}
        </> 
      )}

      {/* 对话框 */}
      {previewFile && (
        <FilePreview
          key={previewFile.id}
          file={previewFile}
          onClose={() => setPreviewFile(null)}
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
          fileIds={Array.from(selectedFiles)}
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
          fileIds={Array.from(selectedFiles)}
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

      <CreateFolderDialog
        open={showCreateFolder}
        parentId={currentFolderId}
        onClose={() => setShowCreateFolder(false)}
        onCreated={() => {
          loadFolders();
        }}
      />

      <RenameFolderDialog
        open={!!renamingFolder}
        folder={renamingFolder}
        onClose={() => setRenamingFolder(null)}
        onRenamed={() => {
          loadFolders();
        }}
      />
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

function ChevronLeftIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
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
