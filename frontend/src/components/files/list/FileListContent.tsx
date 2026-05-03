import React, { useCallback, useEffect, useMemo, useState } from "react";
import FileListPagination from "./FileListPagination";
import FileListVirtualScroller from "./FileListVirtualScroller";
import FileListSelectionBar from "./FileListSelectionBar";
import FileListGroupedView from "./FileListGroupedView";
import ErrorMessage from "../../common/feedback/ErrorMessage";
import { FileCardSkeleton } from "../../common/feedback/Skeleton";
import { FILE_LIST } from "../../../constants";
import InfiniteScrollSentinel from "../InfiniteScrollSentinel";
import { EmptyState } from "../../common/EmptyState";
import type { FileMetadata } from "../../../types/files";
import type { Folder } from "../../../types/folders";
import type { SortOption } from "../../../hooks/files/useFileFilters";

/** 移动端宽度阈值：小于此宽度禁用虚拟列表 */
const MOBILE_WIDTH_THRESHOLD = 768;

interface MenuState {
  type: "file" | "folder";
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
  groupedFiles:
    | {
        key: string;
        files: FileMetadata[];
        icon: React.ReactNode;
        label: string;
      }[]
    | null;
  timeGroupedItems:
    | {
        key: string;
        label: string;
        sortKey: number;
        files: FileMetadata[];
        folders: Folder[];
        items: Array<
          | { type: "file"; file: FileMetadata }
          | { type: "folder"; folder: Folder }
        >;
      }[]
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
  handleDelete: (file: FileMetadata | Folder, type: "file" | "folder") => void;
  handleDownload: (file: FileMetadata) => void;
  handleBatchDownload: () => void;
  handleBatchDelete: () => void;
  handleShowBatchMove: () => void;
  handleShowBatchShare: () => void;
  handleFileDragStart: (fileId: string, e: React.DragEvent) => void;
  handleDropOnFolder: (
    folderId: string,
    fileIds: string[],
    folderIds: string[],
  ) => void;
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
    () =>
      typeof window !== "undefined" &&
      window.innerWidth < MOBILE_WIDTH_THRESHOLD,
  );
  const isPlainSort = sortBy !== "type_group" && sortBy !== "time_group";
  const mixedItems = useMemo(() => {
    if (!isPlainSort) return [];

    const folderItems = displayFolders.map((folder) => ({
      type: "folder" as const,
      folder,
    }));
    const fileItems = files.map((file) => ({ type: "file" as const, file }));
    const items = [...folderItems, ...fileItems];

    const compareName = (a: string, b: string) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

    const getCreatedAt = (item: (typeof items)[number]) =>
      item.type === "folder" ? item.folder.created_at : item.file.created_at;
    const getName = (item: (typeof items)[number]) =>
      item.type === "folder" ? item.folder.name : item.file.original_filename;
    const getSize = (item: (typeof items)[number]) =>
      item.type === "folder" ? 0 : item.file.file_size;

    const getTime = (v: string) => {
      const t = Date.parse(v);
      return Number.isFinite(t) ? t : 0;
    };

    const cmp = (a: (typeof items)[number], b: (typeof items)[number]) => {
      if (sortBy.startsWith("filename_")) {
        const dir = sortBy.endsWith("_asc") ? 1 : -1;
        const r = compareName(getName(a), getName(b));
        if (r !== 0) return r * dir;
      } else if (sortBy.startsWith("created_at_")) {
        const dir = sortBy.endsWith("_asc") ? 1 : -1;
        const r = getTime(getCreatedAt(a)) - getTime(getCreatedAt(b));
        if (r !== 0) return r * dir;
      } else if (sortBy.startsWith("file_size_")) {
        const dir = sortBy.endsWith("_asc") ? 1 : -1;
        const r = getSize(a) - getSize(b);
        if (r !== 0) return r * dir;
      }

      const tie = compareName(getName(a), getName(b));
      if (tie !== 0) return tie;
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return 0;
    };

    return items.sort(cmp);
  }, [displayFolders, files, sortBy, isPlainSort]);

  const itemCountForVirtual = isPlainSort ? mixedItems.length : files.length;
  const shouldUseVirtualList =
    !isMobile && itemCountForVirtual > FILE_LIST.VIRTUAL_THRESHOLD;
  const [openMenu, setOpenMenu] = useState<MenuState | null>(null);
  const openFileMenuId = openMenu?.type === "file" ? openMenu.id : null;
  const openFolderMenuId = openMenu?.type === "folder" ? openMenu.id : null;
  const listKey = currentFolderId ?? "root";

  const closeMenu = useCallback(() => {
    setOpenMenu(null);
  }, []);

  const toggleFileMenu = useCallback((id: string) => {
    setOpenMenu((prev) =>
      prev?.type === "file" && prev.id === id ? null : { type: "file", id },
    );
  }, []);

  const toggleFolderMenu = useCallback((id: string) => {
    setOpenMenu((prev) =>
      prev?.type === "folder" && prev.id === id ? null : { type: "folder", id },
    );
  }, []);

  useEffect(() => {
    if (!openMenu) return;
    const exists =
      openMenu.type === "file"
        ? files.some((f) => f.id === openMenu.id)
        : displayFolders.some((f) => f.id === openMenu.id);
    if (!exists) {
      queueMicrotask(() => setOpenMenu(null));
    }
  }, [openMenu, files, displayFolders]);

  const showBatchActions = selectedFiles.size + selectedFolders.size > 0;
  const totalText = `total:${displayFolders.length > 0 ? `${displayFolders.length} folders · ` : ""}${files.length} files`;

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
          title={currentFolderId ? "文件夹为空" : "暂无文件"}
          description={
            currentFolderId
              ? "拖拽文件到此处或创建子文件夹"
              : "上传你的第一个文件吧"
          }
          icon={<EmptyIcon />}
        />
      ) : (
        <>
          <FileListSelectionBar
            showBatchActions={showBatchActions}
            isRevalidating={isRevalidating}
            allFilesSelected={allFilesSelected}
            selectedFileCount={selectedFiles.size}
            selectedFolderCount={selectedFolders.size}
            totalText={totalText}
            batchDownloading={batchDownloading}
            onToggleSelectAll={toggleSelectAll}
            onBatchMove={handleShowBatchMove}
            onBatchShare={handleShowBatchShare}
            onBatchDownload={handleBatchDownload}
            onBatchDelete={handleBatchDelete}
          />
          {isGroupByType && groupedFiles ? (
            <FileListGroupedView
              mode="type"
              groupedFiles={groupedFiles}
              timeGroupedItems={timeGroupedItems}
              displayFolders={displayFolders}
              selectedFiles={selectedFiles}
              selectedFolders={selectedFolders}
              openFileMenuId={openFileMenuId}
              openFolderMenuId={openFolderMenuId}
              onSelectFile={handleSelectFile}
              onSelectFolder={handleSelectFolder}
              onOpenFolder={handleOpenFolder}
              onRenameFolder={handleRenameFolder}
              onRenameFile={handleRenameFile}
              onDelete={handleDelete}
              onDownload={handleDownload}
              onFileDragStart={handleFileDragStart}
              onDropOnFolder={handleDropOnFolder}
              onPreviewFile={setPreviewFile}
              onShareFile={setShareFile}
              onToggleFileMenu={toggleFileMenu}
              onToggleFolderMenu={toggleFolderMenu}
              onCloseMenu={closeMenu}
            />
          ) : isGroupByTime && timeGroupedItems ? (
            <FileListGroupedView
              mode="time"
              groupedFiles={groupedFiles}
              timeGroupedItems={timeGroupedItems}
              displayFolders={displayFolders}
              selectedFiles={selectedFiles}
              selectedFolders={selectedFolders}
              openFileMenuId={openFileMenuId}
              openFolderMenuId={openFolderMenuId}
              onSelectFile={handleSelectFile}
              onSelectFolder={handleSelectFolder}
              onOpenFolder={handleOpenFolder}
              onRenameFolder={handleRenameFolder}
              onRenameFile={handleRenameFile}
              onDelete={handleDelete}
              onDownload={handleDownload}
              onFileDragStart={handleFileDragStart}
              onDropOnFolder={handleDropOnFolder}
              onPreviewFile={setPreviewFile}
              onShareFile={setShareFile}
              onToggleFileMenu={toggleFileMenu}
              onToggleFolderMenu={toggleFolderMenu}
              onCloseMenu={closeMenu}
            />
          ) : (
            <div className="space-y-4 pt-1">
              <FileListVirtualScroller
                isPlainSort={isPlainSort}
                shouldUseVirtualList={shouldUseVirtualList}
                listKey={listKey}
                mixedItems={mixedItems}
                files={files}
                displayFolders={displayFolders}
                selectedFiles={selectedFiles}
                selectedFolders={selectedFolders}
                openFileMenuId={openFileMenuId}
                openFolderMenuId={openFolderMenuId}
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
                onToggleFileMenu={toggleFileMenu}
                onToggleFolderMenu={toggleFolderMenu}
                onCloseMenu={closeMenu}
              />
            </div>
          )}

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

// 空状态图标组件
function EmptyIcon() {
  return (
    <svg
      className="h-10 w-10 text-[var(--glass-text-muted)]"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
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
