import { lazy, Suspense } from 'react';
import './FileListGlass.css';
import { Folder as FolderIcon, FilePlus2 } from 'lucide-react';
import { MacFolderIcon } from '../common/MacFolderIcon';
import ErrorMessage from '../common/ErrorMessage';
import FileGrid from './FileGrid';
import FolderGrid from './FolderGrid';
import FolderBreadcrumb from './FolderBreadcrumb';
import FileListFilters from './FileListFilters';
import FileListPagination from './FileListPagination';
import FileListBatchActions from './FileListBatchActions';
import { FileCardSkeleton } from '../common/Skeleton';
import { useFileList } from './useFileList';

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

export default function FileList({ onOpenUpload }: FileListProps) {
  const {
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
    isLoading,
    totalItems,
    isGroupByType,
    groupedFiles,
    displayFiles,
    displayFileIndexById,
    totalPages,
    page,
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
    handlePageChange,
    handleDownload,
    handleBatchDownload,
    handleBatchDelete,
    handleShowBatchMove,
    handleShowBatchShare,
    handleFileDragStart,
    handleDropOnFolder,
    handleDropOnBreadcrumb,
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

  return (
    <div className="fileListGlassScope space-y-4">
      {/* 顶部工具区（复刻截图布局） */}
      <div className="glass-panel glass-panel-toolbar p-4">
        <FileListFilters
          layout="screenshot"
          search={search}
          mimeType={mimeType}
          sortBy={sortBy}
          onSearchChange={handleSearchChange}
          onMimeTypeChange={handleMimeTypeChange}
          onSortChange={handleSortChange}
          actions={
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigateToFolder(null)}
                className="glass-btn toolbarActionBtn flex items-center gap-2 px-4 py-2 text-sm text-white/90 hover:border-white/25"
                aria-label="All Files"
              >
                <MacFolderIcon className="h-[0.95rem] w-[0.95rem]" />
                <span>All Files</span>
              </button>
              {onOpenUpload && (
                <button
                  type="button"
                  onClick={onOpenUpload}
                  className="glass-btn toolbarActionBtn flex items-center gap-2 px-4 py-2 text-sm text-white/90 hover:border-white/25"
                  aria-label="Add File"
                >
                  <FilePlus2 className="h-[0.95rem] w-[0.95rem] text-white/90" aria-hidden="true" />
                  <span>Add File</span>
                </button>
              )}
            </div>
          }
        />

        {/* 路径（页面优化：保留可用性，弱化显示，不打断截图主布局） */}
        {folderPath.length > 0 && (
          <div className="mt-3">
            <FolderBreadcrumb
              path={folderPath}
              onNavigate={navigateToFolder}
              onDrop={handleDropOnBreadcrumb}
            />
          </div>
        )}
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
          {/* 全选栏 */}
          <div className="glass-panel-soft mb-4 flex items-center justify-between gap-4 px-4 py-3">
            <label className="flex min-w-0 items-center gap-2 whitespace-nowrap text-sm text-gray-300">
              <input
                type="checkbox"
                checked={allFilesSelected}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-white/25 bg-white/5 text-purple-300 focus:ring-0 focus:ring-offset-0"
                aria-label="All Files"
              />
              All Files
            </label>
            <span className="min-w-0 truncate text-sm text-gray-400">
              {selectedFiles.size + selectedFolders.size > 0 &&
                `${selectedFiles.size + selectedFolders.size} selected · `}
              {folders.length > 0 && `${folders.length} folders · `}
              {files.length} files
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
                    <div className="flex-1 h-px bg-white/10" />
                  </div>
                  <FolderGrid
                    folders={folders}
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
                <div key={group.key}>
                  <div className="mb-3 flex items-center gap-2">
                    {group.icon}
                    <span className="text-sm font-medium text-gray-400">{group.label}</span>
                    <span className="text-xs text-gray-500">({group.files.length})</span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>
                  <FileGrid
                    files={group.files}
                    selectedFiles={selectedFiles}
                    onSelect={handleSelectFile}
                    onPreview={setPreviewFile}
                    onShare={setShareFile}
                    onDownload={handleDownload}
                    onDelete={handleBatchDelete}
                    onDragStart={handleFileDragStart}
                  />
                </div>
              ))}
            </div>
          ) : (
            // 普通列表视图：文件夹和文件顺序展示（各自内部管理网格布局）
            <div className="space-y-4">
              <FolderGrid
                folders={folders}
                selectedFolders={selectedFolders}
                onSelect={handleSelectFolder}
                onOpen={handleOpenFolder}
                onRename={handleRenameFolder}
                onDelete={() => {}}
                onDrop={handleDropOnFolder}
              />
              <FileGrid
                files={files}
                selectedFiles={selectedFiles}
                onSelect={handleSelectFile}
                onPreview={setPreviewFile}
                onShare={setShareFile}
                onDownload={handleDownload}
                onDelete={handleBatchDelete}
                onDragStart={handleFileDragStart}
              />
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
            }}
          />
        )}

        {showCreateFolder && (
          <CreateFolderDialog
            open={showCreateFolder}
            parentId={currentFolderId}
            onClose={() => setShowCreateFolder(false)}
            onCreated={() => {
              setShowCreateFolder(false);
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
            appearance={deleteConfirm.type === 'file' ? 'glass' : 'default'}
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

// PlusIcon 已废弃：改用 lucide 的 FolderPlus/Upload
