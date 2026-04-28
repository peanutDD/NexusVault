import { lazy, Suspense } from "react";
import "./FileListGlass.css";
import { useFileList } from "../useFileList";
import { clearFileListCache } from "../../../utils/fileListCache";
import { useThrottledCallback } from "../../../hooks/useThrottledCallback";
import { FileCardSkeleton } from "../../common/feedback/Skeleton";

interface FileListProps {
  onOpenUpload?: () => void;
}

// 懒加载重型对话框组件
const FilePreview = lazy(() => import("../preview/FilePreview"));
const FileListHeader = lazy(() => import("./FileListHeader"));
const FileListContent = lazy(() => import("./FileListContent"));
const ShareDialog = lazy(() => import("../dialogs/ShareDialog"));
const BatchShareDialog = lazy(() => import("../dialogs/BatchShareDialog"));
const BatchMoveDialog = lazy(() => import("../dialogs/BatchMoveDialog"));
const CreateFolderDialog = lazy(() => import("../dialogs/CreateFolderDialog"));
const RenameFolderDialog = lazy(() => import("../dialogs/RenameFolderDialog"));
const RenameFileDialog = lazy(() => import("../dialogs/RenameFileDialog"));
const ConfirmDialog = lazy(() => import("../../common/dialog/ConfirmDialog"));

/** 删除确认文案中显示的文件/文件夹名：过长时中间省略，最多约 19 字 */
function truncateNameForConfirm(name: string, maxLen = 19): string {
  if (!name || name.length <= maxLen) return name;
  const extMatch = name.match(/\.[^.]+$/);
  const ext = extMatch ? extMatch[0] : "";
  const base = name.slice(0, name.length - ext.length);
  const budget = maxLen - ext.length - 1;
  if (budget <= 0) return name.slice(0, maxLen - 1) + "…";
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
        fallback={<div className="h-[84px] sm:h-[96px]" data-oid="r-g:0nh" />}
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
        {previewFile && (
          <FilePreview
            key={previewFile.id}
            file={previewFile}
            files={displayFiles}
            currentIndex={displayFileIndexById.get(previewFile.id) ?? -1}
            onClose={() => setPreviewFile(null)}
            onNavigate={(file) => setPreviewFile(file)}
            data-oid="wdj1-t:"
          />
        )}

        {shareFile && (
          <ShareDialog
            fileId={shareFile.id}
            filename={shareFile.original_filename}
            onClose={() => setShareFile(null)}
            data-oid="725q.v6"
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
            data-oid="dyor7nn"
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
              void refreshListsAfterMove();
            }}
            onPartialMoved={() => {
              clearFileListCache();
              void refreshListsAfterMove();
            }}
            onApplyOptimistic={getOptimisticMoveRollback}
            data-oid="wijc1j6"
          />
        )}

        {showCreateFolder && (
          <CreateFolderDialog
            open={showCreateFolder}
            parentId={currentFolderId}
            onClose={() => setShowCreateFolder(false)}
            onCreated={() => {
              setShowCreateFolder(false);
              addFolderToList();
            }}
            data-oid="q3cg405"
          />
        )}

        {renamingFolder && (
          <RenameFolderDialog
            open={!!renamingFolder}
            folder={renamingFolder}
            onClose={() => setRenamingFolder(null)}
            onRename={handleRenameFolderSubmit}
            onRenamed={() => setRenamingFolder(null)}
            data-oid="bg6aib7"
          />
        )}

        {renamingFile && (
          <RenameFileDialog
            open={!!renamingFile}
            file={renamingFile}
            onClose={() => setRenamingFile(null)}
            onRename={handleRenameFileSubmit}
            onRenamed={() => setRenamingFile(null)}
            data-oid="wlfff9t"
          />
        )}

        {/* 删除确认对话框 */}
        {deleteConfirm && (
          <ConfirmDialog
            open={!!deleteConfirm}
            appearance="glass"
            title={
              deleteConfirm.type === "batch"
                ? "确认批量删除"
                : deleteConfirm.type === "folder"
                  ? "确认删除文件夹"
                  : "确认删除文件"
            }
            message={
              deleteConfirm.type === "batch" ? (
                <>
                  <span
                    className="text-[var(--confirm-message-text)]"
                    data-oid="zsildfw"
                  >
                    即将删除{" "}
                    {[
                      deleteConfirm.fileCount &&
                        `${deleteConfirm.fileCount} 个文件`,
                      deleteConfirm.folderCount &&
                        `${deleteConfirm.folderCount} 个文件夹`,
                    ]
                      .filter(Boolean)
                      .join(" 和 ")}
                    。
                  </span>
                  <br data-oid="at7fu0h" />
                  <br data-oid="rg6ey42" />
                  <span
                    className="text-[var(--confirm-warning-icon-text)] text-xs font-medium"
                    data-oid="9b-_hbd"
                  >
                    此操作不可撤销！
                  </span>
                </>
              ) : deleteConfirm.type === "folder" ? (
                <>
                  <span
                    className="text-[var(--confirm-message-text)] text-xs"
                    data-oid="ds-rov4"
                  >
                    确定要删除文件夹「
                  </span>
                  <span
                    className="text-[var(--confirm-danger-icon-text)] text-sm font-semibold"
                    data-oid="vhgtpiy"
                  >
                    {truncateNameForConfirm(deleteConfirm.name ?? "")}
                  </span>
                  <span
                    className="text-[var(--confirm-message-text)] text-xs"
                    data-oid="b2ibywr"
                  >
                    」吗？
                  </span>
                  <br data-oid="0zg3ojk" />
                  <br data-oid="8:hal45" />
                  <span
                    className="text-[var(--confirm-warning-icon-text)] text-xs"
                    data-oid="7fbxfgr"
                  >
                    文件夹内的所有内容也会被删除！
                  </span>
                </>
              ) : (
                <>
                  <span
                    className="text-[var(--confirm-message-text)] text-xs"
                    data-oid="pf18fn7"
                  >
                    确定要删除文件「
                  </span>
                  <span
                    className="text-[var(--confirm-danger-icon-text)] text-sm font-semibold"
                    data-oid="wtj-jcx"
                  >
                    {truncateNameForConfirm(deleteConfirm.name ?? "")}
                  </span>
                  <span
                    className="text-[var(--confirm-message-text)] text-xs"
                    data-oid="z00w1ny"
                  >
                    」吗？
                  </span>
                  <br data-oid="w0dkarx" />
                  <br data-oid=".pvcu7o" />
                  <span
                    className="text-[var(--confirm-warning-icon-text)] text-xs"
                    data-oid="cc0rw13"
                  >
                    此操作不可撤销。
                  </span>
                </>
              )
            }
            confirmText="删除"
            cancelText="取消"
            variant="danger"
            loading={deleteLoading}
            onConfirm={executeDelete}
            onCancel={() => setDeleteConfirm(null)}
            data-oid="q.3eg77"
          />
        )}
      </Suspense>
    </div>
  );
}
