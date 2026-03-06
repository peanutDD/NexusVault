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
import React, { useCallback, useEffect, useMemo, useState } from "react";
import FileGrid from "../grid/FileGrid";
import VirtualizedFileGrid from "../grid/VirtualizedFileGrid";
import FolderGrid from "../grid/FolderGrid";
import MixedGrid from "../grid/MixedGrid";
import VirtualizedMixedGrid from "../grid/VirtualizedMixedGrid";
import FileListBatchActions from "./FileListBatchActions";
import FileListPagination from "./FileListPagination";
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

  return (
    <div data-oid="5egs:n7">
      {error && (
        <ErrorMessage
          message={error}
          type="error"
          onClose={onClearError}
          autoDismissMs={5000}
          className="mb-[var(--bar-gap)]"
          data-oid="ume.f_0"
        />
      )}

      {isLoading ? (
        <div
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
          data-oid="_prh2kg"
        >
          <FileCardSkeleton count={12} data-oid="x2qf9do" />
        </div>
      ) : files.length + displayFolders.length === 0 ? (
        <EmptyState
          title={currentFolderId ? "文件夹为空" : "暂无文件"}
          description={
            currentFolderId
              ? "拖拽文件到此处或创建子文件夹"
              : "上传你的第一个文件吧"
          }
          icon={<EmptyIcon data-oid="9wj3pbi" />}
          data-oid="rqhu517"
        />
      ) : (
        <>
          {/* 全选栏 + 批量工具栏：有选择时整合为一块玻璃拟态，无选择时独立 */}
          {showBatchActions ? (
            <div
              className="sticky top-[clamp(4.75rem,7.6vw,6.25rem)] z-40 mb-[var(--bar-gap)]"
              data-oid="b4bdl7r"
            >
              <div
                className="glass-panel-soft bars-integrated flex flex-col"
                data-oid="lyrr-gh"
              >
                <div
                  className="all-files-row flex items-center justify-between gap-4"
                  data-oid="25vq23v"
                >
                  <div
                    className="flex shrink-0 items-center gap-3"
                    data-oid="t2t1n7l"
                  >
                    {isRevalidating && (
                      <span
                        className="text-[0.65rem] text-[var(--filelist-revalidating-text)]"
                        aria-live="polite"
                        data-oid="b_1s7qa"
                      >
                        更新中…
                      </span>
                    )}
                    <label
                      className="font-brand flex cursor-pointer items-center gap-2 whitespace-nowrap font-normal tracking-widest text-[var(--filelist-selection-label)] text-[0.625rem] leading-none"
                      data-oid="sctd.lb"
                    >
                      <input
                        type="checkbox"
                        checked={allFilesSelected}
                        onChange={toggleSelectAll}
                        aria-label="All Files"
                        className="sr-only"
                        data-oid="0car4h4"
                      />

                      <span
                        aria-hidden
                        className={`
                          inline-flex h-4 min-h-4 w-4 min-w-4 shrink-0 items-center justify-center overflow-hidden rounded-sm
                          border transition-all duration-200
                          ${
                            allFilesSelected
                              ? "border-[var(--filelist-check-border-checked)] bg-[var(--filelist-check-bg-checked)] text-[var(--filelist-check-text-checked)]"
                              : "border-[var(--filelist-check-border)] bg-[var(--filelist-check-bg)] text-transparent hover:border-[var(--filelist-check-border-hover)] hover:bg-[var(--filelist-check-bg-hover)]"
                          }
                        `}
                        data-oid="2:4fnnw"
                      >
                        <i
                          className={`bi bi-check-lg block text-[0.55rem] font-bold leading-none ${allFilesSelected ? "" : "invisible"}`}
                          aria-hidden
                          data-oid="vny7sax"
                        />
                      </span>
                      <span className="select-none" data-oid="e0l0iyi">
                        All Files
                      </span>
                    </label>
                    <span
                      className="font-brand font-normal tracking-widest text-[0.625rem] leading-none text-[var(--filelist-selection-count)]"
                      data-oid="ns7nrst"
                    >
                      {selectedFiles.size + selectedFolders.size} selected
                    </span>
                  </div>
                  <span
                    className="font-brand min-w-0 truncate font-normal tracking-widest text-[var(--filelist-total-text)] text-[0.625rem] leading-none"
                    data-oid="jo_-w9v"
                  >
                    total:
                    {displayFolders.length > 0 &&
                      `${displayFolders.length} folders · `}
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
                  data-oid="8x1l7mh"
                />
              </div>
            </div>
          ) : (
            <div
              className="sticky top-[clamp(4.75rem,7.6vw,6.25rem)] z-40 flex flex-col mb-[var(--bar-gap)]"
              style={{ gap: "var(--bar-gap)" }}
              data-oid="g94g219"
            >
              <div
                className="all-files-bar glass-panel-soft mb-0 flex items-center justify-between gap-4"
                data-oid="dnvgb5a"
              >
                <div
                  className="flex shrink-0 items-center gap-3"
                  data-oid="bw:-:ms"
                >
                  {isRevalidating && (
                    <span
                      className="text-[0.65rem] text-[var(--filelist-revalidating-text)]"
                      aria-live="polite"
                      data-oid="ebvk2mw"
                    >
                      更新中…
                    </span>
                  )}
                  <label
                    className="font-brand flex cursor-pointer items-center gap-2 whitespace-nowrap font-normal tracking-widest text-[var(--filelist-selection-label)] text-[0.625rem] leading-none"
                    data-oid="0wj6_v2"
                  >
                    <input
                      type="checkbox"
                      checked={allFilesSelected}
                      onChange={toggleSelectAll}
                      aria-label="All Files"
                      className="sr-only"
                      data-oid=".jtu3na"
                    />

                    <span
                      aria-hidden
                      className={`
                        inline-flex h-4 min-h-4 w-4 min-w-4 shrink-0 items-center justify-center overflow-hidden rounded-sm
                        border transition-all duration-200
                        ${
                          allFilesSelected
                            ? "border-[var(--filelist-check-border-checked)] bg-[var(--filelist-check-bg-checked)] text-[var(--filelist-check-text-checked)]"
                            : "border-[var(--filelist-check-border)] bg-[var(--filelist-check-bg)] text-transparent hover:border-[var(--filelist-check-border-hover)] hover:bg-[var(--filelist-check-bg-hover)]"
                        }
                      `}
                      data-oid="t8r.fu."
                    >
                      <i
                        className={`bi bi-check-lg block text-[0.625rem] font-bold leading-none ${allFilesSelected ? "" : "invisible"}`}
                        aria-hidden
                        data-oid="5d51fz:"
                      />
                    </span>
                    <span className="select-none" data-oid="n:vi_n.">
                      All Files
                    </span>
                  </label>
                </div>
                <span
                  className="font-brand min-w-0 truncate font-normal tracking-widest text-[var(--filelist-total-text)] text-[0.625rem] leading-none"
                  data-oid="631h2up"
                >
                  total:
                  {displayFolders.length > 0 &&
                    `${displayFolders.length} folders · `}
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
                data-oid="3g_.l0k"
              />
            </div>
          )}

          {/* 文件区域 - 按类型分组、按时间分组或普通列表 */}
          {isGroupByType && groupedFiles ? (
            // 按类型分组视图：文件夹单独一组 + 各类型文件分组
            <div className="space-y-6" data-oid=".gg92mw">
              {/* 文件夹分组 */}
              {displayFolders.length > 0 && (
                <div data-oid="dft6l3j">
                  <div
                    className="mb-3 flex items-center gap-3"
                    data-oid="4u72:1t"
                  >
                    {/* 分组全选复选框 */}
                    <GroupSelectCheckbox
                      itemIds={displayFolders.map((f) => f.id)}
                      selectedIds={selectedFolders}
                      onToggle={(ids, selected) => {
                        ids.forEach((id) => handleSelectFolder(id, selected));
                      }}
                      data-oid="6yz-9ew"
                    />

                    <span
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--glass-bg-b)] text-base text-[var(--glass-text)]"
                      aria-hidden
                      data-oid="tvfi_3u"
                    >
                      <i
                        className="bi bi-folder2"
                        aria-hidden
                        data-oid="sq5afy_"
                      />
                    </span>
                    <span
                      className="font-brand text-[clamp(0.7rem,1.4vw,0.8rem)] tracking-[0.18em] text-[var(--glass-text)] uppercase"
                      data-oid="vq8j6r-"
                    >
                      FOLDERS
                      <span
                        className="ml-2 text-[0.7em] text-[var(--glass-text-muted)]"
                        data-oid="f.06du8"
                      >
                        ({displayFolders.length})
                      </span>
                    </span>
                    <div
                      className="flex-1 h-px bg-[var(--color-border-soft)]"
                      data-oid="kfa8i8c"
                    />
                  </div>
                  <FolderGrid
                    folders={displayFolders}
                    selectedFolders={selectedFolders}
                    onSelect={handleSelectFolder}
                    onOpen={handleOpenFolder}
                    onRename={handleRenameFolder}
                    onDelete={(folderId) => {
                      const folder = displayFolders.find(
                        (f) => f.id === folderId,
                      );
                      if (folder) handleDelete(folder, "folder");
                    }}
                    onDrop={handleDropOnFolder}
                    openFolderMenuId={openFolderMenuId}
                    onToggleMenu={toggleFolderMenu}
                    onCloseMenu={closeMenu}
                    data-oid="8-aydn3"
                  />
                </div>
              )}
              {/* 各类型文件分组 */}
              {groupedFiles.map((group) => (
                <div key={`group-${group.key}`} data-oid="5s1iatm">
                  <div
                    className="mb-3 flex items-center gap-3"
                    data-oid="4q8l3z0"
                  >
                    {/* 分组全选复选框 */}
                    <GroupSelectCheckbox
                      itemIds={group.files.map((f) => f.id)}
                      selectedIds={selectedFiles}
                      onToggle={(ids, selected) => {
                        ids.forEach((id) => handleSelectFile(id, selected));
                      }}
                      data-oid="3c2:n.w"
                    />

                    {group.icon}
                    <span
                      className="font-brand text-[clamp(0.7rem,1.4vw,0.8rem)] tracking-[0.18em] text-[var(--glass-text)] uppercase"
                      data-oid="4_ewk07"
                    >
                      {group.label}
                      <span
                        className="ml-2 text-[0.7em] text-[var(--glass-text-muted)]"
                        data-oid="7z65irz"
                      >
                        ({group.files.length})
                      </span>
                    </span>
                    <div
                      className="flex-1 h-px bg-[var(--color-border-soft)]"
                      data-oid=":84e7ca"
                    />
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
                    data-oid="67jt.az"
                  />
                </div>
              ))}
            </div>
          ) : isGroupByTime && timeGroupedItems ? (
            // 按时间分组视图：文件夹单独一组 + 各月份文件分组
            <div className="space-y-6" data-oid="u_oo11d">
              {(timeGroupedItems ?? []).map((group) => (
                <div key={`time-group-${group.key}`} data-oid="vh_g4mp">
                  <div
                    className="mb-3 flex items-center gap-3"
                    data-oid="uvlhx3c"
                  >
                    <GroupSelectCheckboxMixed
                      fileIds={group.files.map((f) => f.id)}
                      folderIds={group.folders.map((f) => f.id)}
                      selectedFileIds={selectedFiles}
                      selectedFolderIds={selectedFolders}
                      onToggle={(
                        fileIds: string[],
                        folderIds: string[],
                        selected: boolean,
                      ) => {
                        fileIds.forEach((id) => handleSelectFile(id, selected));
                        folderIds.forEach((id) =>
                          handleSelectFolder(id, selected),
                        );
                      }}
                      data-oid="tn2ld8m"
                    />

                    <span
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--glass-bg-b)] text-base text-[var(--glass-text)]"
                      aria-hidden
                      data-oid="9hvnka4"
                    >
                      <i
                        className="bi bi-calendar3"
                        aria-hidden
                        data-oid="3gtqowv"
                      />
                    </span>
                    <span
                      className="font-brand text-[clamp(0.7rem,1.4vw,0.8rem)] tracking-[0.18em] text-[var(--glass-text)] uppercase"
                      data-oid="klz2d.t"
                    >
                      {group.label}
                      <span
                        className="ml-2 text-[0.7em] text-[var(--glass-text-muted)]"
                        data-oid="5vdfp6q"
                      >
                        ({group.files.length + group.folders.length})
                      </span>
                    </span>
                    <div
                      className="flex-1 h-px bg-[var(--color-border-soft)]"
                      data-oid="jx.tovz"
                    />
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
                    data-oid="dxq851i"
                  />
                </div>
              ))}
            </div>
          ) : (
            // 普通列表视图：文件夹和文件顺序展示；文件过多时用虚拟列表（基于窗口滚动，视口即浏览器窗口）
            <div className="space-y-4" data-oid="9k4:dfg">
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
                    data-oid="yg324gf"
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
                    data-oid="rqlath5"
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
                      const folder = displayFolders.find(
                        (f) => f.id === folderId,
                      );
                      if (folder) handleDelete(folder, "folder");
                    }}
                    onDrop={handleDropOnFolder}
                    openFolderMenuId={openFolderMenuId}
                    onToggleMenu={toggleFolderMenu}
                    onCloseMenu={closeMenu}
                    data-oid="i_lm36w"
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
                      data-oid="xz_wgrh"
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
                      data-oid="w_39jt:"
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
            data-oid="p_st4m3"
          />

          <FileListPagination
            page={page}
            totalPages={totalPages}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
            data-oid="huj8if1"
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

function GroupSelectCheckbox({
  itemIds,
  selectedIds,
  onToggle,
}: GroupSelectCheckboxProps) {
  const selectedCount = itemIds.filter((id) => selectedIds.has(id)).length;
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
        ${
          allSelected
            ? "border-[var(--color-border-medium)] bg-[var(--glass-bg-strong)] text-[var(--glass-text)]"
            : someSelected
              ? "border-[var(--color-border-medium)] bg-[var(--glass-bg-soft)] text-[var(--glass-text)]"
              : "border-[var(--color-border-soft)] bg-[var(--glass-bg-soft)] text-transparent hover:border-[var(--color-border-medium)] hover:bg-[var(--glass-bg-strong)]"
        }
      `}
      aria-label={allSelected ? "取消全选此分组" : "全选此分组"}
      data-oid="p0x1673"
    >
      {allSelected ? (
        <i
          className="bi bi-check-lg text-[0.5rem] font-bold leading-none"
          aria-hidden
          data-oid="_ai7oj9"
        />
      ) : someSelected ? (
        <i
          className="bi bi-dash text-[0.625rem] font-bold leading-none"
          aria-hidden
          data-oid="fkl17vv"
        />
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
        ${
          allSelected
            ? "border-[var(--color-border-medium)] bg-[var(--glass-bg-strong)] text-[var(--glass-text)]"
            : someSelected
              ? "border-[var(--color-border-medium)] bg-[var(--glass-bg-soft)] text-[var(--glass-text)]"
              : "border-[var(--color-border-soft)] bg-[var(--glass-bg-soft)] text-transparent hover:border-[var(--color-border-medium)] hover:bg-[var(--glass-bg-strong)]"
        }
      `}
      aria-label="Select group"
      data-oid="q97dtx-"
    >
      <i
        className={`block text-[0.625rem] font-bold leading-none ${allSelected ? "bi bi-check-lg" : someSelected ? "bi bi-dash" : "bi bi-check-lg invisible"}`}
        aria-hidden
        data-oid="2tt2iaq"
      />
    </button>
  );
}

// 空状态图标组件
function EmptyIcon() {
  return (
    <svg
      className="h-10 w-10 text-[var(--glass-text-muted)]"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      data-oid="v-:tbbu"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
        data-oid="1_agz01"
      />
    </svg>
  );
}

export default FileListContent;
