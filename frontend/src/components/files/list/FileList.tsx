import { lazy, Suspense } from 'react';
import './FileListGlass.css';
import FileListHeader from './FileListHeader';
import FileListContent from './FileListContent';
import { useFileList } from '../useFileList';
import { clearFileListCache } from '../../../utils/fileListCache';
import { useThrottledCallback } from '../../../hooks/useThrottledCallback';

interface FileListProps {
  onOpenUpload?: () => void;
}

// 懒加载重型对话框组件
const FilePreview = lazy(() => import('../preview/FilePreview'));
const ShareDialog = lazy(() => import('../dialogs/ShareDialog'));
const BatchShareDialog = lazy(() => import('../dialogs/BatchShareDialog'));
const BatchMoveDialog = lazy(() => import('../dialogs/BatchMoveDialog'));
const CreateFolderDialog = lazy(() => import('../dialogs/CreateFolderDialog'));
const RenameFolderDialog = lazy(() => import('../dialogs/RenameFolderDialog'));
const ConfirmDialog = lazy(() => import('../../common/dialog/ConfirmDialog'));

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
    isLoading,
    isRevalidating,
    totalItems,
    isGroupByType,
    isGroupByTime,
    groupedFiles,
    timeGroupedFiles,
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
    handleRenameFolder,
    handleRenameFolderSubmit,
    getOptimisticMoveRollback,
    navigateToFolder,
    handleDelete,
    handleDownload,
    handleBatchDownload,
    handleBatchDelete,
    handleShowBatchMove,
    handleShowBatchShare,
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
    batchDownloading,
  } = useFileList();

  const throttledLoadMore = useThrottledCallback(loadMore, 400);

  // 适配器函数，处理类型不匹配问题
  const handleSortChangeAdapter = (value: string) => handleSortChange(value as import('./FileListFilters').SortOption);
  const handleOpenFolderAdapter = (folderId: string) => {
    // 由于 FileListContent 期望 folderId 字符串，但 handleOpenFolder 需要 Folder 对象
    // 这里简化处理，直接导航到文件夹
    navigateToFolder(folderId);
  };
  const handleDeleteAdapter = (item: { id: string; name?: string; original_filename?: string }, type: 'file' | 'folder') => {
    if (type === 'file') {
      handleDelete(item.id);
    } else if (type === 'folder') {
      setDeleteConfirm({
        type: 'folder',
        id: item.id,
        name: item.name || '文件夹',
      });
    }
  };
  const handleFileDragStartAdapter = (fileId: string, e: React.DragEvent) => {
    // 由于 FileListContent 期望 fileId 字符串和 e，而 handleFileDragStart 需要 e 和 file 对象
    // 这里简化处理，只设置 dataTransfer
    e.dataTransfer.setData('application/file-id', fileId);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDropOnFolderAdapter = (_folderId: string, fileIds: string[], folderIds: string[]) => {
    // 由于 FileListContent 期望 folderId、fileIds 和 folderIds，而 handleDropOnFolder 需要 e 和 folder 对象
    // 这里简化处理，只处理单个文件的情况
    if (fileIds.length > 0 || folderIds.length > 0) {
      // 这里需要实际的 folder 对象，暂时跳过
      console.log('Drop on folder:', _folderId, 'Files:', fileIds, 'Folders:', folderIds);
    }
  };

  return (
    <div className="fileListGlassScope space-y-4">
      {/* 头部组件：包含面包屑和工具栏 */}
      <FileListHeader
        folderPath={folderPath}
        navigateToFolder={navigateToFolder}
        handleDropOnBreadcrumb={handleDropOnBreadcrumb}
        search={search}
        mimeType={mimeType}
        sortBy={sortBy}
        onSearchChange={handleSearchChange}
        onMimeTypeChange={handleMimeTypeChange}
        onSortChange={handleSortChangeAdapter}
        onOpenUpload={onOpenUpload}
        setShowCreateFolder={setShowCreateFolder}
      />

      {/* 内容组件：包含批量操作栏、文件列表、分页等 */}
      <FileListContent
        files={files}
        folderPath={folderPath}
        selectedFiles={selectedFiles}
        selectedFolders={selectedFolders}
        selectedFileIds={selectedFileIds}
        selectedFolderIds={selectedFolderIds}
        currentFolderId={currentFolderId}
        error={error}
        isLoading={isLoading}
        isRevalidating={isRevalidating}
        totalItems={totalItems}
        isGroupByType={isGroupByType}
        isGroupByTime={isGroupByTime}
        groupedFiles={groupedFiles}
        timeGroupedFiles={timeGroupedFiles}
        displayFolders={displayFolders}
        displayFiles={displayFiles}
        displayFileIndexById={displayFileIndexById}
        totalPages={totalPages}
        page={page}
        hasMore={hasMore}
        loadingMore={loadingMore}
        loadMore={throttledLoadMore}
        allFilesSelected={allFilesSelected}
        toggleSelectAll={toggleSelectAll}
        handleSelectFile={handleSelectFile}
        handleSelectFolder={handleSelectFolder}
        handleOpenFolder={handleOpenFolderAdapter}
        handleRenameFolder={handleRenameFolder}
        handleRenameFolderSubmit={handleRenameFolderSubmit}
        getOptimisticMoveRollback={getOptimisticMoveRollback}
        navigateToFolder={navigateToFolder}
        handleDelete={handleDeleteAdapter}
        handleDownload={handleDownload}
        handleBatchDownload={handleBatchDownload}
        handleBatchDelete={handleBatchDelete}
        handleShowBatchMove={handleShowBatchMove}
        handleShowBatchShare={handleShowBatchShare}
        handleFileDragStart={handleFileDragStartAdapter}
        handleDropOnFolder={handleDropOnFolderAdapter}
        loadFiles={loadFiles}
        loadFolders={loadFolders}
        clearSelection={clearSelection}
        addFolderToList={addFolderToList}
        previewFile={previewFile}
        setPreviewFile={setPreviewFile}
        shareFile={shareFile}
        setShareFile={setShareFile}
        showBatchShare={showBatchShare}
        setShowBatchShare={setShowBatchShare}
        batchShareFileIds={batchShareFileIds}
        setBatchShareFileIds={setBatchShareFileIds}
        showBatchMove={showBatchMove}
        setShowBatchMove={setShowBatchMove}
        showCreateFolder={showCreateFolder}
        setShowCreateFolder={setShowCreateFolder}
        renamingFolder={renamingFolder}
        setRenamingFolder={setRenamingFolder}
        deleteConfirm={deleteConfirm}
        deleteLoading={deleteLoading}
        executeDelete={executeDelete}
        setDeleteConfirm={setDeleteConfirm}
        batchDownloading={batchDownloading}
      />

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
            onApplyOptimistic={getOptimisticMoveRollback}
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
            onRename={handleRenameFolderSubmit}
            onRenamed={() => setRenamingFolder(null)}
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
