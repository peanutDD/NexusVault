import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { fileService, type FileMetadata } from '../../services/files';
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
import FileRow from './FileRow';
import FileListFilters from './FileListFilters';
import Spinner from '../common/Spinner';

export default function FileList() {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [mimeType, setMimeType] = useState('');
  const [category, setCategory] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sizeMin, setSizeMin] = useState('');
  const [sizeMax, setSizeMax] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [previewFile, setPreviewFile] = useState<FileMetadata | null>(null);
  const [shareFile, setShareFile] = useState<FileMetadata | null>(null);
  const [showBatchShare, setShowBatchShare] = useState(false);
  const [showBatchMove, setShowBatchMove] = useState(false);

  const { categories, loading: loadingCategories, refresh: refreshCategories } = useCategories();
  const limit = FILE_LIST.LIMIT;
  const parentRef = useRef<HTMLDivElement | null>(null);
  
  // Debounce search to reduce API calls
  const debouncedSearch = useDebounce(search, 300);
  
  // Request deduplication
  const dedupedListFiles = useRequestDedup(fileService.listFiles.bind(fileService));
  
  const rowVirtualizer = useVirtualizer({
    count: files.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => FILE_LIST.ROW_HEIGHT,
    overscan: 5,
  });

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    const query = {
      page,
      limit,
      search: debouncedSearch || undefined,
      mime_type: mimeType || undefined,
      category: category === '__uncategorized__' ? '' : (category || undefined),
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      size_min: sizeMin ? parseInt(sizeMin) * 1024 * 1024 : undefined,
      size_max: sizeMax ? parseInt(sizeMax) * 1024 * 1024 : undefined,
    };
    
    const cacheKey = getCacheKey(query);
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
  }, [page, debouncedSearch, mimeType, category, dateFrom, dateTo, sizeMin, sizeMax, dedupedListFiles]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleDelete = useCallback(async (fileId: string) => {
    if (!confirm('确定要删除此文件吗？')) return;
    try {
      await fileService.deleteFile(fileId);
      clearFileListCache(); // 清除缓存，强制刷新
      loadFiles();
    } catch (err) {
      alert(getErrorMessage(err, '删除失败'));
    }
  }, [loadFiles]);

  const handleBatchDelete = async () => {
    if (selectedFiles.size === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedFiles.size} 个文件吗？`)) return;
    try {
      await fileService.batchDelete(Array.from(selectedFiles));
      clearFileListCache(); // 清除缓存，强制刷新
      loadFiles();
    } catch (err) {
      alert(getErrorMessage(err, '批量删除失败'));
    }
  };

  const handleBatchDownload = async () => {
    if (selectedFiles.size === 0) return;
    try {
      await fileService.downloadZip(Array.from(selectedFiles));
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

  const toggleSelect = (fileId: string) => {
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

  const toggleSelectAll = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(files.map((f) => f.id)));
    }
  };

  // Memoized computed values
  const totalPages = useMemo(() => Math.ceil(total / limit), [total, limit]);
  const allSelected = useMemo(
    () => files.length > 0 && selectedFiles.size === files.length,
    [files.length, selectedFiles.size]
  );
  
  // Memoized handlers
  const handleSelect = useCallback((id: string) => toggleSelect(id), []);
  const handlePreview = useCallback((file: FileMetadata) => setPreviewFile(file), []);
  const handleShare = useCallback((file: FileMetadata) => setShareFile(file), []);
  const handleDeleteRow = useCallback((id: string) => handleDelete(id), [handleDelete]);
  
  const handleClearFilters = useCallback(() => {
    setDateFrom('');
    setDateTo('');
    setSizeMin('');
    setSizeMax('');
    setCategory('');
    setPage(1);
  }, []);

  return (
    <div>
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

      {selectedFiles.size > 0 && (
        <div className="mb-4 p-3 bg-purple-500/20 border border-purple-500/50 rounded-lg flex items-center justify-between">
          <span className="text-purple-200">
            已选择 {selectedFiles.size} 个文件
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setShowBatchMove(true)}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
            >
              批量移动
            </button>
            <button
              onClick={() => setShowBatchShare(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              批量分享
            </button>
            <button
              onClick={handleBatchDownload}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              批量下载 ZIP
            </button>
            <button
              onClick={handleBatchDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              批量删除
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

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-3">
          <Spinner size="lg" />
          <span>加载中…</span>
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          暂无文件，上传你的第一个文件吧
        </div>
      ) : (
        <>
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div
              className="grid grid-cols-[auto_72px_1fr_80px_120px_100px_100px_auto] gap-0 items-center px-6 py-3 bg-gray-700 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
              style={{ minWidth: 800 }}
            >
              <div>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="rounded"
                  aria-label="全选所有文件"
                />
              </div>
              <div>缩略图</div>
              <div>文件名</div>
              <div>大小</div>
              <div>类型</div>
              <div>分类</div>
              <div>上传时间</div>
              <div className="text-right">操作</div>
            </div>
            <div
              ref={parentRef}
              className="overflow-auto divide-y divide-gray-700"
              style={{ height: FILE_LIST.LIST_HEIGHT }}
            >
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const file = files[virtualRow.index];
                  return (
                    <div
                      key={file.id}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <FileRow
                        file={file}
                        isSelected={selectedFiles.has(file.id)}
                        onSelect={handleSelect}
                        onPreview={handlePreview}
                        onShare={handleShare}
                        onDownload={handleDownload}
                        onDelete={handleDeleteRow}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <span className="px-4 py-2 text-gray-300">
                第 {page} 页，共 {totalPages} 页
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}

      {previewFile && (
        <FilePreview file={previewFile} onClose={() => setPreviewFile(null)} />
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
    </div>
  );
}
