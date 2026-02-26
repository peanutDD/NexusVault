/**
 * FileListContent 组件
 * 
 * 文件列表的主要内容组件，包含全选栏、文件夹和文件网格、分组视图等
 * 
 * @param props 组件属性
 * @param props.files 文件列表
 * @param props.selectedFiles 选中的文件
 * @param props.selectedFolders 选中的文件夹
 * @param props.currentFolderId 当前文件夹 ID
 * @param props.error 错误信息
 * @param props.isLoading 是否正在加载
 * @param props.isRevalidating 是否正在重新验证
 * @param props.totalItems 总项目数
 * @param props.isGroupByType 是否按类型分组
 * @param props.groupedFiles 分组后的文件
 * @param props.displayFolders 要显示的文件夹
 * @param props.totalPages 总页数
 * @param props.page 当前页码
 * @param props.hasMore 是否有更多数据
 * @param props.loadingMore 是否正在加载更多数据
 * @param props.loadMore 加载更多数据的回调函数
 * @param props.allFilesSelected 是否全选
 * @param props.toggleSelectAll 切换全选状态的回调函数
 * @param props.handleSelectFile 选择文件的回调函数
 * @param props.handleSelectFolder 选择文件夹的回调函数
 * @param props.handleOpenFolder 打开文件夹的回调函数
 * @param props.handleRenameFolder 重命名文件夹的回调函数
 * @param props.handleDelete 删除文件/文件夹的回调函数
 * @param props.handleDownload 下载文件的回调函数
 * @param props.handleBatchDownload 批量下载文件的回调函数
 * @param props.handleBatchDelete 批量删除文件/文件夹的回调函数
 * @param props.handleShowBatchMove 显示批量移动对话框的回调函数
 * @param props.handleShowBatchShare 显示批量分享对话框的回调函数
 * @param props.handleFileDragStart 文件拖拽开始的回调函数
 * @param props.handleDropOnFolder 拖放到文件夹上的回调函数
 * @param props.batchDownloading 是否正在批量下载
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import FileGrid from '../grid/FileGrid';
import VirtualizedFileGrid from '../grid/VirtualizedFileGrid';
import FolderGrid from '../grid/FolderGrid';
import MixedGrid from '../grid/MixedGrid';
import VirtualizedMixedGrid from '../grid/VirtualizedMixedGrid';
import FileListBatchActions from './FileListBatchActions';
import FileListPagination from './FileListPagination';
import ErrorMessage from '../../common/feedback/ErrorMessage';
import { FileCardSkeleton } from '../../common/feedback/Skeleton';
import { FILE_LIST } from '../../../constants';
import InfiniteScrollSentinel from '../InfiniteScrollSentinel';
import { EmptyState } from '../../common/EmptyState';
import type { FileMetadata } from '../../../types/files';
import type { Folder } from '../../../types/folders';
import type { SortOption } from '../../../hooks/files/useFileFilters';

/** 移动端宽度阈值：小于此宽度禁用虚拟列表 */
const MOBILE_WIDTH_THRESHOLD = 768;

interface MenuState {
  type: 'file' | 'folder';
  id: string;
}

interface FileListContentProps {
  files: FileMetadata[];
  selectedFiles: Set<string>;
  selectedFolders: Set<string>;
  currentFolderId: string | null;
  sortBy: SortOption;
  error: string | null;
  onClearError?: () => void;
  isLoading: boolean;
  isRevalidating: boolean;
  isGroupByType: boolean;
  isGroupByTime: boolean;
  groupedFiles: { key: string; files: FileMetadata[]; icon: React.ReactNode; label: string }[] | null;
  timeGroupedItems:
    | { key: string; label: string; sortKey: number; files: FileMetadata[]; folders: Folder[]; items: Array<{ type: 'file'; file: FileMetadata } | { type: 'folder'; folder: Folder }> }[]
    | null;
  displayFolders: Folder[];
  totalPages: number;
  page: number;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
  allFilesSelected: boolean;
  toggleSelectAll: () => void;
  handleSelectFile: (fileId: string, selected: boolean) => void;
  handleSelectFolder: (folderId: string, selected: boolean) => void;
  handleOpenFolder: (folderId: string) => void;
  handleRenameFolder: (folder: Folder) => void;
  handleRenameFile: (file: FileMetadata) => void;
  handleDelete: (file: FileMetadata | Folder, type: 'file' | 'folder') => void;
  handleDownload: (file: FileMetadata) => void;
  handleBatchDownload: () => void;
  handleBatchDelete: () => void;
  handleShowBatchMove: () => void;
  handleShowBatchShare: () => void;
  handleFileDragStart: (fileId: string, e: React.DragEvent) => void;
  handleDropOnFolder: (folderId: string, fileIds: string[], folderIds: string[]) => void;
  setPreviewFile: (file: FileMetadata | null) => void;
  setShareFile: (file: FileMetadata | null) => void;
  batchDownloading: boolean;
}

const FileListContent: React.FC<FileListContentProps> = ({
  files,
  selectedFiles,
  selectedFolders,
  currentFolderId,
  sortBy,
  error,
  onClearError,
  isLoading,
  isRevalidating,
  isGroupByType,
  isGroupByTime,
  groupedFiles,
  timeGroupedItems,
  displayFolders,
  totalPages,
  page,
  hasMore,
  loadingMore,
  loadMore,
  allFilesSelected,
  toggleSelectAll,
  handleSelectFile,
  handleSelectFolder,
  handleOpenFolder,
  handleRenameFolder,
  handleRenameFile,
  handleDelete,
  handleDownload,
  handleBatchDownload,
  handleBatchDelete,
  handleShowBatchMove,
  handleShowBatchShare,
  handleFileDragStart,
  handleDropOnFolder,
  batchDownloading,
  setPreviewFile,
  setShareFile,
}) => {
  const [isMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < MOBILE_WIDTH_THRESHOLD
  );
  const isPlainSort = sortBy !== 'type_group' && sortBy !== 'time_group';
  const mixedItems = useMemo(() => {
    if (!isPlainSort) return [];

    const folderItems = displayFolders.map((folder) => ({ type: 'folder' as const, folder }));
    const fileItems = files.map((file) => ({ type: 'file' as const, file }));
    const items = [...folderItems, ...fileItems];

    const compareName = (a: string, b: string) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

    const getCreatedAt = (item: (typeof items)[number]) =>
      item.type === 'folder' ? item.folder.created_at : item.file.created_at;
    const getName = (item: (typeof items)[number]) =>
      item.type === 'folder' ? item.folder.name : item.file.original_filename;
    const getSize = (item: (typeof items)[number]) =>
      item.type === 'folder' ? 0 : item.file.file_size;

    const getTime = (v: string) => {
      const t = Date.parse(v);
      return Number.isFinite(t) ? t : 0;
    };

    const cmp = (a: (typeof items)[number], b: (typeof items)[number]) => {
      if (sortBy.startsWith('filename_')) {
        const dir = sortBy.endsWith('_asc') ? 1 : -1;
        const r = compareName(getName(a), getName(b));
        if (r !== 0) return r * dir;
      } else if (sortBy.startsWith('created_at_')) {
        const dir = sortBy.endsWith('_asc') ? 1 : -1;
        const r = getTime(getCreatedAt(a)) - getTime(getCreatedAt(b));
        if (r !== 0) return r * dir;
      } else if (sortBy.startsWith('file_size_')) {
        const dir = sortBy.endsWith('_asc') ? 1 : -1;
        const r = getSize(a) - getSize(b);
        if (r !== 0) return r * dir;
      }

      const tie = compareName(getName(a), getName(b));
      if (tie !== 0) return tie;
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return 0;
    };

    return items.sort(cmp);
  }, [displayFolders, files, sortBy, isPlainSort]);

  const itemCountForVirtual = isPlainSort ? mixedItems.length : files.length;
  const shouldUseVirtualList = !isMobile && itemCountForVirtual > FILE_LIST.VIRTUAL_THRESHOLD;
  const [openMenu, setOpenMenu] = useState<MenuState | null>(null);
  const openFileMenuId = openMenu?.type === 'file' ? openMenu.id : null;
  const openFolderMenuId = openMenu?.type === 'folder' ? openMenu.id : null;
  const listKey = currentFolderId ?? 'root';

  const closeMenu = useCallback(() => {
    setOpenMenu(null);
  }, []);

  const toggleFileMenu = useCallback((id: string) => {
    setOpenMenu((prev) => (prev?.type === 'file' && prev.id === id ? null : { type: 'file', id }));
  }, []);

  const toggleFolderMenu = useCallback((id: string) => {
    setOpenMenu((prev) => (prev?.type === 'folder' && prev.id === id ? null : { type: 'folder', id }));
  }, []);

  useEffect(() => {
    if (!openMenu) return;
    const exists =
      openMenu.type === 'file'
        ? files.some((f) => f.id === openMenu.id)
        : displayFolders.some((f) => f.id === openMenu.id);
    if (!exists) {
      queueMicrotask(() => setOpenMenu(null));
    }
  }, [openMenu, files, displayFolders]);

  const showBatchActions = selectedFiles.size + selectedFolders.size > 0;

  return (
    <div>
      {error && (
        <ErrorMessage
          message={error}
          type="error"
          onClose={onClearError}
          autoDismissMs={5000}
          className="mb-[var(--bar-gap)]"
        />
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          <FileCardSkeleton count={12} />
        </div>
      ) : files.length + displayFolders.length === 0 ? (
        <EmptyState
          title={currentFolderId ? '文件夹为空' : '暂无文件'}
          description={
            currentFolderId
              ? '拖拽文件到此处或创建子文件夹'
              : '上传你的第一个文件吧'
          }
          icon={<EmptyIcon />}
        />
      ) : (
        <>
          {/* 全选栏 + 批量工具栏：有选择时整合为一块玻璃拟态，无选择时独立 */}
          {showBatchActions ? (
            <div className="sticky top-20 sm:top-24 z-40 mb-[var(--bar-gap)]">
              <div className="glass-panel-soft bars-integrated flex flex-col">
                <div className="all-files-row flex items-center justify-between gap-4">
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
                          inline-flex h-4 min-h-4 w-4 min-w-4 shrink-0 items-center justify-center overflow-hidden rounded-sm
                          border transition-all duration-200
                          ${allFilesSelected
                            ? 'border-white/30 bg-white/15 text-white'
                            : 'border-white/15 bg-white/5 text-transparent hover:border-white/25 hover:bg-white/10'
                          }
                        `}
                      >
                        <i
                          className={`bi bi-check-lg block text-[0.55rem] font-bold leading-none ${allFilesSelected ? '' : 'invisible'}`}
                          aria-hidden
                        />
                      </span>
                      <span className="select-none">All Files</span>
                    </label>
                    <span className="font-brand font-normal tracking-widest text-[0.625rem] leading-none text-yellow-400">
                      {selectedFiles.size + selectedFolders.size} selected
                    </span>
                  </div>
                  <span className="font-brand min-w-0 truncate font-normal tracking-widest text-gray-400 text-[0.625rem] leading-none">
                    total:{
                      displayFolders.length > 0 && `${displayFolders.length} folders · `
                    }
                    {files.length} files
                  </span>
                </div>
                <FileListBatchActions
                  bare
                  selectedFileCount={selectedFiles.size}
                  selectedFolderCount={selectedFolders.size}
                  onBatchMove={handleShowBatchMove}
                  onBatchShare={handleShowBatchShare}
                  onBatchDownload={handleBatchDownload}
                  onBatchDelete={handleBatchDelete}
                  batchDownloading={batchDownloading}
                />
              </div>
            </div>
          ) : (
            <div
              className="sticky top-[clamp(4.75rem,7.6vw,6.25rem)] z-40 flex flex-col mb-[var(--bar-gap)]"
              style={{ gap: 'var(--bar-gap)' }}
            >
              <div className="all-files-bar glass-panel-soft mb-0 flex items-center justify-between gap-4">
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
                        inline-flex h-4 min-h-4 w-4 min-w-4 shrink-0 items-center justify-center overflow-hidden rounded-sm
                        border transition-all duration-200
                        ${allFilesSelected
                          ? 'border-white/30 bg-white/15 text-white'
                          : 'border-white/15 bg-white/5 text-transparent hover:border-white/25 hover:bg-white/10'
                        }
                      `}
                    >
                      <i
                        className={`bi bi-check-lg block text-[0.625rem] font-bold leading-none ${allFilesSelected ? '' : 'invisible'}`}
                        aria-hidden
                      />
                    </span>
                    <span className="select-none">All Files</span>
                  </label>
                </div>
                <span className="font-brand min-w-0 truncate font-normal tracking-widest text-gray-400 text-[0.625rem] leading-none">
                  total:{
                    displayFolders.length > 0 && `${displayFolders.length} folders · `
                  }
                  {files.length} files
                </span>
              </div>
              <FileListBatchActions
                selectedFileCount={selectedFiles.size}
                selectedFolderCount={selectedFolders.size}
                onBatchMove={handleShowBatchMove}
                onBatchShare={handleShowBatchShare}
                onBatchDownload={handleBatchDownload}
                onBatchDelete={handleBatchDelete}
                batchDownloading={batchDownloading}
              />
            </div>
          )}

          {/* 文件区域 - 按类型分组、按时间分组或普通列表 */}
          {isGroupByType && groupedFiles ? (
            // 按类型分组视图：文件夹单独一组 + 各类型文件分组
            <div className="space-y-6">
              {/* 文件夹分组 */}
              {displayFolders.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center gap-3">
                    {/* 分组全选复选框 */}
                    <GroupSelectCheckbox
                      itemIds={displayFolders.map(f => f.id)}
                      selectedIds={selectedFolders}
                      onToggle={(ids, selected) => {
                        ids.forEach(id => handleSelectFolder(id, selected));
                      }}
                    />
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-base text-white/90" aria-hidden>
                      <i className="bi bi-folder2" aria-hidden />
                    </span>
                    <span className="font-brand text-[clamp(0.7rem,1.4vw,0.8rem)] tracking-[0.18em] text-white/80 uppercase">
                      FOLDERS
                      <span className="ml-2 text-[0.7em] text-white/60">({displayFolders.length})</span>
                    </span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>
                  <FolderGrid
                    folders={displayFolders}
                    selectedFolders={selectedFolders}
                    onSelect={handleSelectFolder}
                    onOpen={handleOpenFolder}
                    onRename={handleRenameFolder}
                    onDelete={(folderId) => {
                      const folder = displayFolders.find(f => f.id === folderId);
                      if (folder) handleDelete(folder, 'folder');
                    }}
                    onDrop={handleDropOnFolder}
                    openFolderMenuId={openFolderMenuId}
                    onToggleMenu={toggleFolderMenu}
                    onCloseMenu={closeMenu}
                  />
                </div>
              )}
              {/* 各类型文件分组 */}
              {groupedFiles.map((group) => (
                <div key={`group-${group.key}`}>
                  <div className="mb-3 flex items-center gap-3">
                    {/* 分组全选复选框 */}
                    <GroupSelectCheckbox
                      itemIds={group.files.map(f => f.id)}
                      selectedIds={selectedFiles}
                      onToggle={(ids, selected) => {
                        ids.forEach(id => handleSelectFile(id, selected));
                      }}
                    />
                    {group.icon}
                    <span className="font-brand text-[clamp(0.7rem,1.4vw,0.8rem)] tracking-[0.18em] text-white/80 uppercase">
                      {group.label}
                      <span className="ml-2 text-[0.7em] text-white/60">({group.files.length})</span>
                    </span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>
                  <FileGrid
                    key={`group-grid-${group.key}`}
                    files={group.files}
                    selectedFiles={selectedFiles}
                    onSelect={handleSelectFile}
                    onPreview={setPreviewFile}
                    onShare={setShareFile}
                    onDownload={handleDownload}
                    onRename={handleRenameFile}
                    onDelete={handleDelete}
                    onDragStart={handleFileDragStart}
                    openFileMenuId={openFileMenuId}
                    onToggleMenu={toggleFileMenu}
                    onCloseMenu={closeMenu}
                  />
                </div>
              ))}
            </div>
          ) : isGroupByTime && timeGroupedItems ? (
            // 按时间分组视图：文件夹单独一组 + 各月份文件分组
            <div className="space-y-6">
              {(timeGroupedItems ?? []).map((group) => (
                <div key={`time-group-${group.key}`}>
                  <div className="mb-3 flex items-center gap-3">
                    <GroupSelectCheckboxMixed
                      fileIds={group.files.map((f) => f.id)}
                      folderIds={group.folders.map((f) => f.id)}
                      selectedFileIds={selectedFiles}
                      selectedFolderIds={selectedFolders}
                      onToggle={(fileIds: string[], folderIds: string[], selected: boolean) => {
                        fileIds.forEach((id) => handleSelectFile(id, selected));
                        folderIds.forEach((id) => handleSelectFolder(id, selected));
                      }}
                    />
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-base text-white/90" aria-hidden>
                      <i className="bi bi-calendar3" aria-hidden />
                    </span>
                    <span className="font-brand text-[clamp(0.7rem,1.4vw,0.8rem)] tracking-[0.18em] text-white/80 uppercase">
                      {group.label}
                      <span className="ml-2 text-[0.7em] text-white/60">
                        ({group.files.length + group.folders.length})
                      </span>
                    </span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>
                  <MixedGrid
                    key={`time-group-mixed-${group.key}`}
                    items={group.items}
                    selectedFiles={selectedFiles}
                    selectedFolders={selectedFolders}
                    onSelectFile={handleSelectFile}
                    onSelectFolder={handleSelectFolder}
                    onOpenFolder={handleOpenFolder}
                    onPreviewFile={setPreviewFile}
                    onShareFile={setShareFile}
                    onDownloadFile={handleDownload}
                    onRenameFolder={handleRenameFolder}
                    onRenameFile={handleRenameFile}
                    onDelete={handleDelete}
                    onFileDragStart={handleFileDragStart}
                    onDropOnFolder={handleDropOnFolder}
                    openFileMenuId={openFileMenuId}
                    openFolderMenuId={openFolderMenuId}
                    onToggleFileMenu={toggleFileMenu}
                    onToggleFolderMenu={toggleFolderMenu}
                    onCloseMenu={closeMenu}
                  />
                </div>
              ))}
            </div>
          ) : (
            // 普通列表视图：文件夹和文件顺序展示；文件过多时用虚拟列表（基于窗口滚动，视口即浏览器窗口）
            <div className="space-y-4">
              {isPlainSort ? (
                shouldUseVirtualList ? (
                  <VirtualizedMixedGrid
                    key={`mixed-virtual-${listKey}`}
                    items={mixedItems}
                    selectedFiles={selectedFiles}
                    selectedFolders={selectedFolders}
                    onSelectFile={handleSelectFile}
                    onSelectFolder={handleSelectFolder}
                    onOpenFolder={handleOpenFolder}
                    onPreviewFile={setPreviewFile}
                    onShareFile={setShareFile}
                    onDownloadFile={handleDownload}
                    onRenameFolder={handleRenameFolder}
                    onRenameFile={handleRenameFile}
                    onDelete={handleDelete}
                    onFileDragStart={handleFileDragStart}
                    onDropOnFolder={handleDropOnFolder}
                    openFileMenuId={openFileMenuId}
                    openFolderMenuId={openFolderMenuId}
                    onToggleFileMenu={toggleFileMenu}
                    onToggleFolderMenu={toggleFolderMenu}
                    onCloseMenu={closeMenu}
                  />
                ) : (
                  <MixedGrid
                    key={`mixed-grid-${listKey}`}
                    items={mixedItems}
                    selectedFiles={selectedFiles}
                    selectedFolders={selectedFolders}
                    onSelectFile={handleSelectFile}
                    onSelectFolder={handleSelectFolder}
                    onOpenFolder={handleOpenFolder}
                    onPreviewFile={setPreviewFile}
                    onShareFile={setShareFile}
                    onDownloadFile={handleDownload}
                    onRenameFolder={handleRenameFolder}
                    onRenameFile={handleRenameFile}
                    onDelete={handleDelete}
                    onFileDragStart={handleFileDragStart}
                    onDropOnFolder={handleDropOnFolder}
                    openFileMenuId={openFileMenuId}
                    openFolderMenuId={openFolderMenuId}
                    onToggleFileMenu={toggleFileMenu}
                    onToggleFolderMenu={toggleFolderMenu}
                    onCloseMenu={closeMenu}
                  />
                )
              ) : (
                <>
                  <FolderGrid
                    folders={displayFolders}
                    selectedFolders={selectedFolders}
                    onSelect={handleSelectFolder}
                    onOpen={handleOpenFolder}
                    onRename={handleRenameFolder}
                    onDelete={(folderId) => {
                      const folder = displayFolders.find(f => f.id === folderId);
                      if (folder) handleDelete(folder, 'folder');
                    }}
                    onDrop={handleDropOnFolder}
                    openFolderMenuId={openFolderMenuId}
                    onToggleMenu={toggleFolderMenu}
                    onCloseMenu={closeMenu}
                  />
                  {shouldUseVirtualList ? (
                    <VirtualizedFileGrid
                      key={`virtual-${listKey}`}
                      files={files}
                      selectedFiles={selectedFiles}
                      onSelect={handleSelectFile}
                      onPreview={setPreviewFile}
                      onShare={setShareFile}
                      onDownload={handleDownload}
                      onRename={handleRenameFile}
                      onDelete={handleDelete}
                      onDragStart={handleFileDragStart}
                      openFileMenuId={openFileMenuId}
                      onToggleMenu={toggleFileMenu}
                      onCloseMenu={closeMenu}
                    />
                  ) : (
                    <FileGrid
                      key={`grid-${listKey}`}
                      files={files}
                      selectedFiles={selectedFiles}
                      onSelect={handleSelectFile}
                      onPreview={setPreviewFile}
                      onShare={setShareFile}
                      onDownload={handleDownload}
                      onRename={handleRenameFile}
                      onDelete={handleDelete}
                      onDragStart={handleFileDragStart}
                      openFileMenuId={openFileMenuId}
                      onToggleMenu={toggleFileMenu}
                      onCloseMenu={closeMenu}
                    />
                  )}
                </>
              )}
            </div>
          )}

          {/* 分页 / 无限滚动：已加载 x/y 页 + 加载更多，滚动到底部自动加载 */}
          <InfiniteScrollSentinel
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
            requireUserScroll
            listSize={files.length}
          />
          <FileListPagination
            page={page}
            totalPages={totalPages}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
          />
        </>
      )}
    </div>
  );
};

// 分组全选复选框组件
interface GroupSelectCheckboxProps {
  itemIds: string[];
  selectedIds: Set<string>;
  onToggle: (ids: string[], selected: boolean) => void;
}

function GroupSelectCheckbox({ itemIds, selectedIds, onToggle }: GroupSelectCheckboxProps) {
  const selectedCount = itemIds.filter(id => selectedIds.has(id)).length;
  const allSelected = selectedCount === itemIds.length && itemIds.length > 0;
  const someSelected = selectedCount > 0 && selectedCount < itemIds.length;

  const handleClick = () => {
    // 如果全选了，则取消全选；否则全选
    onToggle(itemIds, !allSelected);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`
        flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all duration-150
        ${allSelected
          ? 'border-white/30 bg-white/15 text-white'
          : someSelected
            ? 'border-white/30 bg-white/10 text-white'
            : 'border-white/15 bg-white/5 text-transparent hover:border-white/25 hover:bg-white/10'
        }
      `}
      aria-label={allSelected ? '取消全选此分组' : '全选此分组'}
    >
      {allSelected ? (
        <i className="bi bi-check-lg text-[0.5rem] font-bold leading-none" aria-hidden />
      ) : someSelected ? (
        <i className="bi bi-dash text-[0.625rem] font-bold leading-none" aria-hidden />
      ) : null}
    </button>
  );
}

interface GroupSelectCheckboxMixedProps {
  fileIds: string[];
  folderIds: string[];
  selectedFileIds: Set<string>;
  selectedFolderIds: Set<string>;
  onToggle: (fileIds: string[], folderIds: string[], selected: boolean) => void;
}

function GroupSelectCheckboxMixed({
  fileIds,
  folderIds,
  selectedFileIds,
  selectedFolderIds,
  onToggle,
}: GroupSelectCheckboxMixedProps) {
  const selectedCount =
    fileIds.filter((id) => selectedFileIds.has(id)).length +
    folderIds.filter((id) => selectedFolderIds.has(id)).length;
  const total = fileIds.length + folderIds.length;
  const allSelected = total > 0 && selectedCount === total;
  const someSelected = selectedCount > 0 && selectedCount < total;

  const handleClick = () => {
    onToggle(fileIds, folderIds, !allSelected);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`
        flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all duration-150
        ${allSelected
          ? 'border-white/30 bg-white/15 text-white'
          : someSelected
            ? 'border-white/30 bg-white/10 text-white'
            : 'border-white/15 bg-white/5 text-transparent hover:border-white/25 hover:bg-white/10'
        }
      `}
      aria-label="Select group"
    >
      <i
        className={`bi bi-check-lg block text-[0.625rem] font-bold leading-none ${selectedCount > 0 ? '' : 'invisible'}`}
        aria-hidden
      />
    </button>
  );
}

// 空状态图标组件
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

export default FileListContent;
