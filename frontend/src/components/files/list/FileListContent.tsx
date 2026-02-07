/**
 * FileListContent 组件
 * 
 * 文件列表的主要内容组件，包含全选栏、文件夹和文件网格、分组视图等
 * 
 * @param props 组件属性
 * @param props.files 文件列表
 * @param props.folderPath 当前文件夹路径
 * @param props.selectedFiles 选中的文件
 * @param props.selectedFolders 选中的文件夹
 * @param props.selectedFileIds 选中的文件 ID
 * @param props.selectedFolderIds 选中的文件夹 ID
 * @param props.currentFolderId 当前文件夹 ID
 * @param props.error 错误信息
 * @param props.isLoading 是否正在加载
 * @param props.isRevalidating 是否正在重新验证
 * @param props.totalItems 总项目数
 * @param props.isGroupByType 是否按类型分组
 * @param props.groupedFiles 分组后的文件
 * @param props.displayFolders 要显示的文件夹
 * @param props.displayFiles 要显示的文件
 * @param props.displayFileIndexById 文件 ID 到索引的映射
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
 * @param props.handleRenameFolderSubmit 提交文件夹重命名的回调函数
 * @param props.getOptimisticMoveRollback 获取乐观移动回滚函数的回调函数
 * @param props.navigateToFolder 导航到文件夹的回调函数
 * @param props.handleDelete 删除文件/文件夹的回调函数
 * @param props.handleDownload 下载文件的回调函数
 * @param props.handleBatchDownload 批量下载文件的回调函数
 * @param props.handleBatchDelete 批量删除文件/文件夹的回调函数
 * @param props.handleShowBatchMove 显示批量移动对话框的回调函数
 * @param props.handleShowBatchShare 显示批量分享对话框的回调函数
 * @param props.handleFileDragStart 文件拖拽开始的回调函数
 * @param props.handleDropOnFolder 拖放到文件夹上的回调函数
 * @param props.loadFiles 加载文件的回调函数
 * @param props.loadFolders 加载文件夹的回调函数
 * @param props.clearSelection 清除选择的回调函数
 * @param props.addFolderToList 添加文件夹到列表的回调函数
 * @param props.previewFile 预览的文件
 * @param props.setPreviewFile 设置预览文件的回调函数
 * @param props.shareFile 分享的文件
 * @param props.setShareFile 设置分享文件的回调函数
 * @param props.showBatchShare 是否显示批量分享对话框
 * @param props.setShowBatchShare 设置是否显示批量分享对话框的回调函数
 * @param props.batchShareFileIds 批量分享的文件 ID
 * @param props.setBatchShareFileIds 设置批量分享的文件 ID 的回调函数
 * @param props.showBatchMove 是否显示批量移动对话框
 * @param props.setShowBatchMove 设置是否显示批量移动对话框的回调函数
 * @param props.showCreateFolder 是否显示创建文件夹对话框
 * @param props.setShowCreateFolder 设置是否显示创建文件夹对话框的回调函数
 * @param props.renamingFolder 正在重命名的文件夹
 * @param props.setRenamingFolder 设置正在重命名的文件夹的回调函数
 * @param props.deleteConfirm 删除确认信息
 * @param props.deleteLoading 是否正在删除
 * @param props.executeDelete 执行删除操作的回调函数
 * @param props.setDeleteConfirm 设置删除确认信息的回调函数
 * @param props.batchDownloading 是否正在批量下载
 */
import React, { useRef } from 'react';
import FileGrid from '../grid/FileGrid';
import VirtualizedFileGrid from '../grid/VirtualizedFileGrid';
import FolderGrid from '../grid/FolderGrid';
import FileListBatchActions from './FileListBatchActions';
import FileListPagination from './FileListPagination';
import ErrorMessage from '../../common/feedback/ErrorMessage';
import { FileCardSkeleton } from '../../common/feedback/Skeleton';
import { FILE_LIST } from '../../../constants';
import InfiniteScrollSentinel from '../InfiniteScrollSentinel';
import type { FileMetadata, Folder } from '../../../types';

/** 移动端宽度阈值：小于此宽度禁用虚拟列表 */
const MOBILE_WIDTH_THRESHOLD = 768;

interface FileListContentProps {
  files: FileMetadata[];
  folderPath: { id: string; name: string }[];
  selectedFiles: Set<string>;
  selectedFolders: Set<string>;
  selectedFileIds: string[];
  selectedFolderIds: string[];
  currentFolderId: string | null;
  error: string | null;
  isLoading: boolean;
  isRevalidating: boolean;
  totalItems: number;
  isGroupByType: boolean;
  isGroupByTime: boolean;
  groupedFiles: { key: string; files: FileMetadata[]; icon: React.ReactNode; label: string }[] | null;
  timeGroupedFiles: { key: string; label: string; sortKey: number; files: FileMetadata[] }[] | null;
  displayFolders: Folder[];
  displayFiles: FileMetadata[];
  displayFileIndexById: Map<string, number>;
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
  handleRenameFolderSubmit: (folderId: string, newName: string) => void;
  getOptimisticMoveRollback: (fileIds: string[], folderIds: string[], targetFolderId: string) => () => void;
  navigateToFolder: (folderId: string | null) => void;
  handleDelete: (file: FileMetadata | Folder, type: 'file' | 'folder') => void;
  handleDownload: (file: FileMetadata) => void;
  handleBatchDownload: () => void;
  handleBatchDelete: () => void;
  handleShowBatchMove: () => void;
  handleShowBatchShare: () => void;
  handleFileDragStart: (fileId: string, e: React.DragEvent) => void;
  handleDropOnFolder: (folderId: string, fileIds: string[], folderIds: string[]) => void;
  loadFiles: () => void;
  loadFolders: () => void;
  clearSelection: () => void;
  addFolderToList: (folder: Folder) => void;
  previewFile: FileMetadata | null;
  setPreviewFile: (file: FileMetadata | null) => void;
  shareFile: FileMetadata | null;
  setShareFile: (file: FileMetadata | null) => void;
  showBatchShare: boolean;
  setShowBatchShare: (show: boolean) => void;
  batchShareFileIds: string[];
  setBatchShareFileIds: (ids: string[]) => void;
  showBatchMove: boolean;
  setShowBatchMove: (show: boolean) => void;
  showCreateFolder: boolean;
  setShowCreateFolder: (show: boolean) => void;
  renamingFolder: Folder | null;
  setRenamingFolder: (folder: Folder | null) => void;
  deleteConfirm: { type: 'file' | 'folder' | 'batch'; id?: string; name?: string; fileCount?: number; folderCount?: number } | null;
  deleteLoading: boolean;
  executeDelete: () => void;
  setDeleteConfirm: (confirm: { type: 'file' | 'folder' | 'batch'; id?: string; name?: string; fileCount?: number; folderCount?: number } | null) => void;
  batchDownloading: boolean;
}

const FileListContent: React.FC<FileListContentProps> = ({
  files,
  selectedFiles,
  selectedFolders,
  currentFolderId,
  error,
  isLoading,
  isRevalidating,
  totalItems,
  isGroupByType,
  isGroupByTime,
  groupedFiles,
  timeGroupedFiles,
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
  // 检测是否为移动端（仅在首次挂载时检测，避免切换导致布局跳动）
  const isMobileRef = useRef(
    typeof window !== 'undefined' && window.innerWidth < MOBILE_WIDTH_THRESHOLD
  );

  // 记住是否应该使用虚拟列表（一旦决定使用，就一直使用，避免切换导致无限加载）
  const shouldUseVirtualListRef = useRef<boolean | null>(null);
  if (shouldUseVirtualListRef.current === null && files.length > 0) {
    shouldUseVirtualListRef.current = !isMobileRef.current && files.length > FILE_LIST.VIRTUAL_THRESHOLD;
  }
  const shouldUseVirtualList = shouldUseVirtualListRef.current ?? false;

  return (
    <>
      {/* 批量操作栏 */}
      <FileListBatchActions
        selectedFileCount={selectedFiles.size}
        selectedFolderCount={selectedFolders.size}
        onBatchMove={handleShowBatchMove}
        onBatchShare={handleShowBatchShare}
        onBatchDownload={handleBatchDownload}
        onBatchDelete={handleBatchDelete}
        batchDownloading={batchDownloading}
      />

      {error && (
        <ErrorMessage
          message={error}
          onClose={() => {/* 清除错误 */}}
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
              total:{
                displayFolders.length > 0 && `${displayFolders.length} folders · `
              }
              {files.length} files
            </span>
          </div>

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
                  />
                </div>
              )}
              {/* 各类型文件分组 */}
              {groupedFiles.map((group) => (
                <div key={`group-${group.key}-${files.length}`}>
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
                    key={`group-grid-${group.key}-${files.length}`}
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
          ) : isGroupByTime && timeGroupedFiles ? (
            // 按时间分组视图：文件夹单独一组 + 各月份文件分组
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
                  />
                </div>
              )}
              {/* 各月份文件分组 */}
              {timeGroupedFiles.map((group) => (
                <div key={`time-group-${group.key}-${files.length}`}>
                  <div className="mb-3 flex items-center gap-3">
                    {/* 分组全选复选框 */}
                    <GroupSelectCheckbox
                      itemIds={group.files.map(f => f.id)}
                      selectedIds={selectedFiles}
                      onToggle={(ids, selected) => {
                        ids.forEach(id => handleSelectFile(id, selected));
                      }}
                    />
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-base text-white/90" aria-hidden>
                      <i className="bi bi-calendar3" aria-hidden />
                    </span>
                    <span className="font-brand text-[clamp(0.7rem,1.4vw,0.8rem)] tracking-[0.18em] text-white/80 uppercase">
                      {group.label}
                      <span className="ml-2 text-[0.7em] text-white/60">({group.files.length})</span>
                    </span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>
                  <FileGrid
                    key={`time-group-grid-${group.key}-${files.length}`}
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
                onDelete={(folderId) => {
                  const folder = displayFolders.find(f => f.id === folderId);
                  if (folder) handleDelete(folder, 'folder');
                }}
                onDrop={handleDropOnFolder}
              />
              {shouldUseVirtualList ? (
                <VirtualizedFileGrid
                  key={`virtual-${files.length}`}
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
                  key={`grid-${files.length}`}
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
    </>
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
        <i className="bi bi-check-lg text-[0.625rem] font-bold leading-none" aria-hidden />
      ) : someSelected ? (
        <i className="bi bi-dash text-[0.625rem] font-bold leading-none" aria-hidden />
      ) : null}
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
