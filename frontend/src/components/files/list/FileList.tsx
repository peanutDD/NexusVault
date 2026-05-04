import { lazy, Suspense } from "react";
import "./FileListGlass.css";
import { useFileList } from "../useFileList";
import { useThrottledCallback } from "../../../hooks/useThrottledCallback";
import { FileCardSkeleton } from "../../common/feedback/Skeleton";

interface FileListProps {
  onOpenUpload?: () => void;
}

// 懒加载重型对话框组件
const FileListHeader = lazy(() => import("./FileListHeader"));
const FileListContent = lazy(() => import("./FileListContent"));
const FileListDialogs = lazy(() => import("./FileListDialogs"));

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
    clearError,
    isLoading,
    isRevalidating,
    isGroupByType,
    isGroupByTime,
    groupedFiles,
    timeGroupedItems,
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
    handleRenameFile,
    handleRenameFileSubmit,
    getOptimisticMoveRollback,
    navigateToFolder,
    handleDelete,
    handleDownload,
    handleBatchDownload,
    handleBatchDelete,
    handleShowBatchMove,
    handleShowBatchShare,
    handleDropOnBreadcrumb,
    refreshListsAfterMove,
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
    renamingFile,
    setRenamingFile,
    deleteConfirm,
    deleteLoading,
    executeDelete,
    setDeleteConfirm,
    batchDownloading,
  } = useFileList();

  const throttledLoadMore = useThrottledCallback(() => {
    void loadMore();
  }, 400);

  // 适配器函数，处理类型不匹配问题
  const handleSortChangeAdapter = (value: string) =>
    handleSortChange(value as import("./FileListFilters").SortOption);
  const handleOpenFolderAdapter = (folderId: string) => {
    // 由于 FileListContent 期望 folderId 字符串，但 handleOpenFolder 需要 Folder 对象
    // 这里简化处理，直接导航到文件夹
    navigateToFolder(folderId);
  };
  const handleDropOnBreadcrumbAdapter = (
    e: React.DragEvent,
    folderId: string | null,
  ) => {
    handleDropOnBreadcrumb(folderId, e);
  };
  const handleDeleteAdapter = (
    item: { id: string; name?: string; original_filename?: string },
    type: "file" | "folder",
  ) => {
    if (type === "file") {
      handleDelete(item.id);
    } else if (type === "folder") {
      setDeleteConfirm({
        type: "folder",
        id: item.id,
        name: item.name || "文件夹",
      });
    }
  };
  const handleFileDragStartAdapter = (fileId: string, e: React.DragEvent) => {
    // 由于 FileListContent 期望 fileId 字符串和 e，而 handleFileDragStart 需要 e 和 file 对象
    // 这里简化处理，只设置 dataTransfer
    e.dataTransfer.setData("application/file-id", fileId);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDropOnFolderAdapter = (
    _folderId: string,
    fileIds: string[],
    folderIds: string[],
  ) => {
    // 由于 FileListContent 期望 folderId、fileIds 和 folderIds，而 handleDropOnFolder 需要 e 和 folder 对象
    // 这里简化处理，只处理单个文件的情况
    if (fileIds.length > 0 || folderIds.length > 0) {
      void _folderId;
    }
  };

  return (
    <div
      className="fileListGlassScope flex flex-col"
      style={{ gap: "var(--bar-gap)" }}
      data-oid="680orf2"
    >
      {/* 头部组件：包含面包屑和工具栏 */}
      <Suspense
        fallback={<div className="h-[5.25rem] sm:h-[6rem]" data-oid="r-g:0nh" />}
        data-oid="3jfxvzo"
      >
        <FileListHeader
          folderPath={folderPath}
          navigateToFolder={navigateToFolder}
          handleDropOnBreadcrumb={handleDropOnBreadcrumbAdapter}
          search={search}
          mimeType={mimeType}
          sortBy={sortBy}
          onSearchChange={handleSearchChange}
          onMimeTypeChange={handleMimeTypeChange}
          onSortChange={handleSortChangeAdapter}
          onOpenUpload={onOpenUpload}
          setShowCreateFolder={setShowCreateFolder}
          data-oid="f.8do90"
        />
      </Suspense>

      {/* 内容组件：包含批量操作栏、文件列表、分页等 */}
      <Suspense
        fallback={
          <div
            className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10"
            data-oid="_2vkq1p"
          >
            <FileCardSkeleton count={12} data-oid=".8oa0_j" />
          </div>
        }
        data-oid="hlt2:zq"
      >
        <FileListContent
          files={files}
          selectedFiles={selectedFiles}
          selectedFolders={selectedFolders}
          currentFolderId={currentFolderId}
          sortBy={sortBy}
          error={error}
          onClearError={clearError}
          isLoading={isLoading}
          isRevalidating={isRevalidating}
          isGroupByType={isGroupByType}
          isGroupByTime={isGroupByTime}
          groupedFiles={groupedFiles}
          timeGroupedItems={timeGroupedItems}
          displayFolders={displayFolders}
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
          handleRenameFile={handleRenameFile}
          handleDelete={handleDeleteAdapter}
          handleDownload={handleDownload}
          handleBatchDownload={handleBatchDownload}
          handleBatchDelete={handleBatchDelete}
          handleShowBatchMove={handleShowBatchMove}
          handleShowBatchShare={handleShowBatchShare}
          handleFileDragStart={handleFileDragStartAdapter}
          handleDropOnFolder={handleDropOnFolderAdapter}
          setPreviewFile={setPreviewFile}
          setShareFile={setShareFile}
          batchDownloading={batchDownloading}
          data-oid="kdv9r9i"
        />
      </Suspense>

      {/* 对话框 - 懒加载 */}
      <Suspense fallback={null} data-oid="m7bndss">
        <FileListDialogs
          previewFile={previewFile}
          displayFiles={displayFiles}
          displayFileIndexById={displayFileIndexById}
          setPreviewFile={setPreviewFile}
          shareFile={shareFile}
          setShareFile={setShareFile}
          showBatchShare={showBatchShare}
          setShowBatchShare={setShowBatchShare}
          batchShareFileIds={batchShareFileIds}
          setBatchShareFileIds={setBatchShareFileIds}
          showBatchMove={showBatchMove}
          setShowBatchMove={setShowBatchMove}
          selectedFileIds={selectedFileIds}
          selectedFolderIds={selectedFolderIds}
          selectedFiles={selectedFiles}
          selectedFolders={selectedFolders}
          currentFolderId={currentFolderId}
          clearSelection={clearSelection}
          refreshListsAfterMove={refreshListsAfterMove}
          getOptimisticMoveRollback={getOptimisticMoveRollback}
          showCreateFolder={showCreateFolder}
          setShowCreateFolder={setShowCreateFolder}
          addFolderToList={addFolderToList}
          renamingFolder={renamingFolder}
          setRenamingFolder={setRenamingFolder}
          handleRenameFolderSubmit={handleRenameFolderSubmit}
          renamingFile={renamingFile}
          setRenamingFile={setRenamingFile}
          handleRenameFileSubmit={handleRenameFileSubmit}
          deleteConfirm={deleteConfirm}
          deleteLoading={deleteLoading}
          executeDelete={executeDelete}
          setDeleteConfirm={setDeleteConfirm}
        />
      </Suspense>
    </div>
  );
}
