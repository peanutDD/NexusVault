import { lazy, Suspense, useEffect, useRef } from 'react';
import './FileListGlass.css';
import { FolderPlus, UploadCloud } from 'lucide-react';
import ErrorMessage from '../common/ErrorMessage';
import FileGrid from './FileGrid';
import VirtualizedFileGrid from './VirtualizedFileGrid';
import FolderGrid from './FolderGrid';
import { FILE_LIST } from '../../constants';
import FolderBreadcrumb from './FolderBreadcrumb';
import FileListFilters from './FileListFilters';
import FileListPagination from './FileListPagination';
import FileListBatchActions from './FileListBatchActions';
import { FileCardSkeleton } from '../common/Skeleton';
import { useFileList } from './useFileList';
import { clearFileListCache } from '../../utils/fileListCache';
import { useThrottledCallback } from '../../hooks/useThrottledCallback';

interface FileListProps {
  onOpenUpload?: () => void;
}

// 懒加载重型对话框组件
const FilePreview = lazy(() => import('./FilePreview'));
const ShareDialog = lazy(() => import('./ShareDialog'));
const BatchShareDialog = lazy(() => import('./BatchShareDialog'));
const BatchMoveDialog = lazy(() => import('./BatchMoveDialog'));
const CreateFolderDialog = lazy(() => import('./CreateFolderDialog'));
const RenameFolderDialog = lazy(() => import('./RenameFolderDialog'));
const ConfirmDialog = lazy(() => import('../common/ConfirmDialog'));

/** 删除确认文案中显示的文件/文件夹名：过长时中间省略，最多约 19 字 */
function truncateNameForConfirm(name: string, maxLen = 19): string {
  if (!name || name.length <= maxLen) return name;
  const extMatch = name.match(/\.[^.]+$/);
  const ext = extMatch ? extMatch[0] : '';
  const base = name.slice(0, name.length - ext.length);
  const budget = maxLen - ext.length - 1;
  if (budget <= 0) return name.slice(0, maxLen - 1) + '…';
  const head = base.slice(0, Math.ceil(budget / 2));
  const tail = base.slice(-Math.floor(budget / 2));
  return `${head}…${tail}${ext}`;
}

/** 无限滚动哨兵：进入视口时触发 onLoadMore */
function InfiniteScrollSentinel({
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || loadingMore) return;

    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting) onLoadMore();
      },
      { rootMargin: '200px', threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);

  if (!hasMore) return null;
  return <div ref={sentinelRef} className="h-1 w-full" aria-hidden />;
}

export default function FileList({ onOpenUpload }: FileListProps) {
  const {
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
    setError,
    isLoading,
    isRevalidating,
    totalItems,
    isGroupByType,
    groupedFiles,
    displayFolders,
    displayFiles,
    displayFileIndexById,
    totalPages,
    page,
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
    handleOpenFolder,
    handleRenameFolder,
    navigateToFolder,
    handleDelete,
    handleDownload,
    handleBatchDownload,
    handleBatchDelete,
    handleShowBatchMove,
    handleShowBatchShare,
    handleFileDragStart,
    handleDropOnFolder,
    handleDropOnBreadcrumb,
    loadFiles,
    loadFolders,
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
    deleteConfirm,
    deleteLoading,
    executeDelete,
    setDeleteConfirm,
  } = useFileList();

  const throttledLoadMore = useThrottledCallback(loadMore, 400);

  return (
    <div className="fileListGlassScope space-y-4">
      {/* 面包屑：进入文件夹后置顶、左对齐 */}
      {folderPath.length > 0 && (
        <div className="flex justify-start">
          <FolderBreadcrumb
            path={folderPath}
            onNavigate={navigateToFolder}
            onDrop={handleDropOnBreadcrumb}
          />
        </div>
      )}

      {/* 顶部工具区（复刻截图布局，整体缩放到 0.75） */}
      <div className="glass-panel glass-panel-toolbar fileListToolbarScale75 p-3">
        <FileListFilters
          layout="screenshot"
          search={search}
          mimeType={mimeType}
          sortBy={sortBy}
          onSearchChange={handleSearchChange}
          onMimeTypeChange={handleMimeTypeChange}
          onSortChange={handleSortChange}
          actions={
            <div className="flex flex-nowrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCreateFolder(true)}
                className="glass-btn toolbarActionBtn font-brand flex items-center gap-1.5 px-2 py-1.5 font-normal tracking-widest text-[0.75rem] leading-none text-white hover:brightness-110 transition-all whitespace-nowrap shrink-0"
                aria-label="新建文件夹"
              >
                <FolderPlus className="shrink-0 h-[0.75rem] w-[0.75rem]" aria-hidden="true" />
                <span>新建文件夹</span>
              </button>
              <button
                type="button"
                onClick={() => navigateToFolder(null)}
                className="glass-btn toolbarActionBtn allFilesBtnHighlight font-brand flex items-center gap-1.5 px-2 py-1.5 font-normal tracking-widest text-[0.75rem] leading-none text-white hover:brightness-110 transition-all whitespace-nowrap shrink-0"
                aria-label="All Files"
              >
                <i className="bi bi-folder2-open shrink-0 text-[0.75rem]" aria-hidden />
                <span>All Files</span>
              </button>
              {onOpenUpload && (
                <button
                  type="button"
                  onClick={onOpenUpload}
                  className="glass-btn toolbarActionBtn uploadBtnHighlight font-brand flex items-center gap-1.5 px-2 py-1.5 font-normal tracking-widest text-[0.75rem] leading-none text-white hover:brightness-110 transition-all whitespace-nowrap shrink-0"
                  aria-label="Upload File"
                >
                  <UploadCloud className="shrink-0 h-[0.75rem] w-[0.75rem]" aria-hidden="true" />
                  <span>Upload File</span>
                </button>
              )}
            </div>
          }
        />
      </div>

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
        <div className="glass-panel-soft flex flex-col items-center justify-center py-16">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
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
          {/* 全选栏：字体与导航栏标题一致，勾选框与文字同高 */}
          <div className="glass-panel-soft mb-4 flex items-center justify-between gap-4 px-4 py-3">
            <div className="flex shrink-0 items-center gap-3">
              {isRevalidating && (
                <span className="text-[0.65rem] text-gray-500" aria-live="polite">
                  更新中…
                </span>
              )}
              <label className="font-brand flex cursor-pointer items-center gap-2 whitespace-nowrap font-normal tracking-widest text-gray-300 text-[0.625rem] leading-none">
                <input
                  type="checkbox"
                  checked={allFilesSelected}
                  onChange={toggleSelectAll}
                  aria-label="All Files"
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className={`
                    inline-flex h-[1em] w-[1em] shrink-0 items-center justify-center rounded-md
                    border transition-all duration-200
                    ${allFilesSelected
                      ? 'border-white/30 bg-white/15 text-white'
                      : 'border-white/15 bg-white/5 text-transparent hover:border-white/25 hover:bg-white/10'
                    }
                  `}
                >
                  {allFilesSelected ? (
                    <i className="bi bi-check-lg text-[0.625rem] font-bold leading-none" aria-hidden />
                  ) : null}
                </span>
                <span className="select-none">All Files</span>
              </label>
              {selectedFiles.size + selectedFolders.size > 0 && (
                <span className="font-brand font-normal tracking-widest text-[0.625rem] leading-none text-yellow-400">
                  {selectedFiles.size + selectedFolders.size} selected
                </span>
              )}
            </div>
            <span className="font-brand min-w-0 truncate font-normal tracking-widest text-gray-400 text-[0.625rem] leading-none">
              total:{' '}
              {displayFolders.length > 0 && `${displayFolders.length} folders · `}
              {files.length} files
            </span>
          </div>

          {/* 文件区域 - 按类型分组或普通列表 */}
          {isGroupByType && groupedFiles ? (
            // 分组视图：文件夹单独一组 + 各类型文件分组
            <div className="space-y-6">
              {/* 文件夹分组 */}
              {displayFolders.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center gap-3">
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-base text-white/90" aria-hidden>
                      <i className="bi bi-folder2" aria-hidden />
                    </span>
                    <span className="text-sm font-medium text-gray-400">文件夹</span>
                    <span className="text-xs text-gray-500">({displayFolders.length})</span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>
                  <FolderGrid
                    folders={displayFolders}
                    selectedFolders={selectedFolders}
                    onSelect={handleSelectFolder}
                    onOpen={handleOpenFolder}
                    onRename={handleRenameFolder}
                    onDelete={() => {}}
                    onDrop={handleDropOnFolder}
                  />
                </div>
              )}
              {/* 各类型文件分组 */}
              {groupedFiles.map((group) => (
                <div key={`group-${group.key}-${sortBy}`}>
                  <div className="mb-3 flex items-center gap-3">
                    {group.icon}
                    <span className="text-sm font-medium text-gray-400">{group.label}</span>
                    <span className="text-xs text-gray-500">({group.files.length})</span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>
                  <FileGrid
                    key={`group-grid-${group.key}-${sortBy}`}
                    files={group.files}
                    selectedFiles={selectedFiles}
                    onSelect={handleSelectFile}
                    onPreview={setPreviewFile}
                    onShare={setShareFile}
                    onDownload={handleDownload}
                    onDelete={handleDelete}
                    onDragStart={handleFileDragStart}
                  />
                </div>
              ))}
            </div>
          ) : (
            // 普通列表视图：文件夹和文件顺序展示；文件过多时用虚拟列表（基于窗口滚动，视口即浏览器窗口）
            <div className="space-y-4">
              <FolderGrid
                folders={displayFolders}
                selectedFolders={selectedFolders}
                onSelect={handleSelectFolder}
                onOpen={handleOpenFolder}
                onRename={handleRenameFolder}
                onDelete={() => {}}
                onDrop={handleDropOnFolder}
              />
              {files.length > FILE_LIST.VIRTUAL_THRESHOLD ? (
                <VirtualizedFileGrid
                  key={`virtual-${sortBy}-${currentFolderId || 'root'}`}
                  files={files}
                  selectedFiles={selectedFiles}
                  onSelect={handleSelectFile}
                  onPreview={setPreviewFile}
                  onShare={setShareFile}
                  onDownload={handleDownload}
                  onDelete={handleDelete}
                  onDragStart={handleFileDragStart}
                />
              ) : (
                <FileGrid
                  key={`grid-${sortBy}-${currentFolderId || 'root'}`}
                  files={files}
                  selectedFiles={selectedFiles}
                  onSelect={handleSelectFile}
                  onPreview={setPreviewFile}
                  onShare={setShareFile}
                  onDownload={handleDownload}
                  onDelete={handleDelete}
                  onDragStart={handleFileDragStart}
                />
              )}
            </div>
          )}

          {/* 分页 / 无限滚动：已加载 x/y 页 + 加载更多，滚动到底部自动加载 */}
          <InfiniteScrollSentinel hasMore={hasMore} loadingMore={loadingMore} onLoadMore={throttledLoadMore} />
          <FileListPagination
            page={page}
            totalPages={totalPages}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={throttledLoadMore}
          />
        </> 
      )}

      {/* 对话框 - 懒加载 */}
      <Suspense fallback={null}>
        {previewFile && (
          <FilePreview
            key={previewFile.id}
            file={previewFile}
            files={displayFiles}
            currentIndex={displayFileIndexById.get(previewFile.id) ?? -1}
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

        {showBatchShare && batchShareFileIds.length > 0 && (
          <BatchShareDialog
            fileIds={batchShareFileIds}
            fileCount={batchShareFileIds.length}
            onClose={() => {
              setShowBatchShare(false);
              setBatchShareFileIds([]);
            }}
            onShareCreated={() => {
              setShowBatchShare(false);
              setBatchShareFileIds([]);
            }}
          />
        )}

        {showBatchMove && (
          <BatchMoveDialog
            fileIds={selectedFileIds}
            folderIds={selectedFolderIds}
            fileCount={selectedFiles.size}
            folderCount={selectedFolders.size}
            onClose={() => setShowBatchMove(false)}
            onMoved={() => {
              setShowBatchMove(false);
              clearSelection();
              clearFileListCache();
              loadFiles();
              loadFolders();
            }}
          />
        )}

        {showCreateFolder && (
          <CreateFolderDialog
            open={showCreateFolder}
            parentId={currentFolderId}
            onClose={() => setShowCreateFolder(false)}
            onCreated={(folder) => {
              setShowCreateFolder(false);
              addFolderToList(folder);
            }}
          />
        )}

        {renamingFolder && (
          <RenameFolderDialog
            open={!!renamingFolder}
            folder={renamingFolder}
            onClose={() => setRenamingFolder(null)}
            onRenamed={() => {
              setRenamingFolder(null);
            }}
          />
        )}

        {/* 删除确认对话框 */}
        {deleteConfirm && (
          <ConfirmDialog
            open={!!deleteConfirm}
            appearance="glass"
            title={
              deleteConfirm.type === 'batch'
                ? '确认批量删除'
                : deleteConfirm.type === 'folder'
                  ? '确认删除文件夹'
                  : '确认删除文件'
            }
            message={
              deleteConfirm.type === 'batch' ? (
                <>
                  <span className="text-white/80">即将删除 {[
                    deleteConfirm.fileCount && `${deleteConfirm.fileCount} 个文件`,
                    deleteConfirm.folderCount && `${deleteConfirm.folderCount} 个文件夹`,
                  ].filter(Boolean).join(' 和 ')}。</span>
                  <br /><br />
                  <span className="text-amber-400 text-xs font-medium">此操作不可撤销！</span>
                </>
              ) : deleteConfirm.type === 'folder' ? (
                <>
                  <span className="text-white/75 text-xs">确定要删除文件夹「</span>
                  <span className="text-rose-300 text-sm font-semibold">{truncateNameForConfirm(deleteConfirm.name ?? '')}</span>
                  <span className="text-white/75 text-xs">」吗？</span>
                  <br /><br />
                  <span className="text-amber-400/90 text-xs">文件夹内的所有内容也会被删除！</span>
                </>
              ) : (
                <>
                  <span className="text-white/75 text-xs">确定要删除文件「</span>
                  <span className="text-rose-300 text-sm font-semibold">{truncateNameForConfirm(deleteConfirm.name ?? '')}</span>
                  <span className="text-white/75 text-xs">」吗？</span>
                  <br /><br />
                  <span className="text-amber-400/90 text-xs">此操作不可撤销。</span>
                </>
              )
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

// PlusIcon 已废弃：改用 lucide 的 FolderPlus/Upload
