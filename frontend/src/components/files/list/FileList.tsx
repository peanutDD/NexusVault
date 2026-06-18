import { lazy, Suspense, useCallback, useEffect } from "react";
import "./FileListGlass.css";
import { useFileList } from "../useFileList";
import { useThrottledCallback } from "../../../hooks/useThrottledCallback";
import { stopDragAutoScroll, updateDragAutoScroll } from "../../../utils/dragAutoScroll";
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
    searchMetadata,
    mimeType,
    sortBy,
    activeCollection,
    activeTagId,
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
    handleCollectionChange,
    handleResetFilters,
    handleTagChange,
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
    handleDropOnFolder,
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

  useEffect(() => {
    const handleDragOver = (event: DragEvent) => {
      const types = Array.from(event.dataTransfer?.types ?? []);
      if (
        types.includes("application/file-id") ||
        types.includes("application/folder-id")
      ) {
        updateDragAutoScroll(event.clientY);
      }
    };

    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", stopDragAutoScroll);
    window.addEventListener("dragend", stopDragAutoScroll);
    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", stopDragAutoScroll);
      window.removeEventListener("dragend", stopDragAutoScroll);
      stopDragAutoScroll();
    };
  }, []);

  // 适配器函数，处理类型不匹配问题
  const handleSortChangeAdapter = useCallback(
    (value: string) =>
      handleSortChange(value as import("./FileListFilters").SortOption),
    [handleSortChange],
  );
  const handleOpenFolderAdapter = useCallback((folderId: string) => {
    // 由于 FileListContent 期望 folderId 字符串，但 handleOpenFolder 需要 Folder 对象
    // 这里简化处理，直接导航到文件夹
    navigateToFolder(folderId);
  }, [navigateToFolder]);
  const handleDropOnBreadcrumbAdapter = useCallback((
    e: React.DragEvent,
    folderId: string | null,
  ) => {
    handleDropOnBreadcrumb(folderId, e);
  }, [handleDropOnBreadcrumb]);
  const handleDeleteAdapter = useCallback((
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
  }, [handleDelete, setDeleteConfirm]);
  const handleFileDragStartAdapter = useCallback((fileId: string, e: React.DragEvent) => {
    // 由于 FileListContent 期望 fileId 字符串和 e，而 handleFileDragStart 需要 e 和 file 对象
    // 这里简化处理，只设置 dataTransfer
    e.dataTransfer.setData("application/file-id", fileId);
    e.dataTransfer.effectAllowed = "move";
  }, []);
  const handleDropOnFolderAdapter = useCallback((
    folderId: string,
    fileIds: string[],
    folderIds: string[],
  ) => {
    if (fileIds.length > 0 || folderIds.length > 0) {
      void handleDropOnFolder(folderId, fileIds, folderIds);
    }
  }, [handleDropOnFolder]);

  return (
    <div
      className="fileListGlassScope flex flex-col"
      style={{ gap: "var(--bar-gap)" }}
      data-oid="680orf2"
    >
      {/* 头部组件：包含面包屑和工具栏 */}
      <Suspense
        fallback={<div className="h-[var(--filelist-header-skeleton-height)]" data-oid="r-g:0nh" />}
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
            className="grid grid-cols-3 gap-[clamp(0.6rem,1.4vw,0.75rem)] sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10"
            data-oid="_2vkq1p"
          >
            <FileCardSkeleton count={12} data-oid=".8oa0_j" />
          </div>
        }
        data-oid="hlt2:zq"
      >
        <FileListContent
          files={files}
          searchQuery={search}
          searchMetadata={searchMetadata}
          mimeType={mimeType}
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
          activeCollection={activeCollection}
          activeTagId={activeTagId}
          onCollectionChange={handleCollectionChange}
          onResetFilters={handleResetFilters}
          onTagChange={handleTagChange}
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
