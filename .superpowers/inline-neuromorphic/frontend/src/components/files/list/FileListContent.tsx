import React, { useCallback, useEffect, useMemo, useState } from "react";
import FileListPagination from "./FileListPagination";
import FileListVirtualScroller from "./FileListVirtualScroller";
import FileListSelectionBar from "./FileListSelectionBar";
import FileListGroupedView from "./FileListGroupedView";
import { FILE_TYPE_LABELS } from "../fileTypeLabels";
import ErrorMessage from "../../common/feedback/ErrorMessage";
import { FileCardSkeleton } from "../../common/feedback/Skeleton";
import { FILE_LIST } from "../../../constants";
import InfiniteScrollSentinel from "../InfiniteScrollSentinel";
import { EmptyState } from "../../common/EmptyState";
import type {
  FileListResponse,
  FileMetadata,
  FulltextSearchMetadata,
} from "../../../types/files";
import type { Folder } from "../../../types/folders";
import type { SortOption } from "../../../hooks/files/useFileFilters";
import { tagsService } from "../../../services/tags";
import { FILE_COLLECTION_COUNTS_QUERY_KEY } from "../../../services/fileListService";
import { appQueryClient } from "../../../providers/queryClient";
import VersionHistoryDialog from "../dialogs/VersionHistoryDialog";
import ManageTagsDialog from "../dialogs/ManageTagsDialog";
import FileActivityDialog from "../dialogs/FileActivityDialog";

/** 移动端宽度阈值：小于此宽度禁用虚拟列表 */
const MOBILE_WIDTH_THRESHOLD = 768;
const PINNED_COLLECTION_KEY = "pinned";

interface MenuState {
  type: "file" | "folder";
  id: string;
}

type FileFlagPatch = Partial<Pick<FileMetadata, "is_favorite" | "is_pinned">>;

type FilesInfiniteQueryData = {
  pages: FileListResponse[];
  pageParams: unknown[];
};

function patchFileFlags(
  file: FileMetadata,
  patches: Record<string, FileFlagPatch>,
) {
  const patch = patches[file.id];
  return patch ? { ...file, ...patch } : file;
}

function patchFilesQueryData(
  data: FilesInfiniteQueryData | undefined,
  fileId: string,
  patch: FileFlagPatch,
): FilesInfiniteQueryData | undefined {
  if (!data?.pages) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      files: page.files.map((item) =>
        item.id === fileId ? { ...item, ...patch } : item,
      ),
    })),
  };
}

function isPinnedCollectionActive(activeCollection = "") {
  return activeCollection
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .includes(PINNED_COLLECTION_KEY);
}

interface FileListContentProps {
  files: FileMetadata[];
  searchQuery?: string;
  searchMetadata?: FulltextSearchMetadata | null;
  mimeType?: string;
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
  activeCollection?: string;
  activeTagId?: string;
  onCollectionChange?: (value: string) => void;
  onResetFilters?: () => void;
  onTagChange?: (value: string) => void;
}

const FileListContent: React.FC<FileListContentProps> = ({
  files,
  searchQuery,
  searchMetadata,
  mimeType,
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
  activeCollection,
  activeTagId,
  onCollectionChange,
  onResetFilters,
  onTagChange,
}) => {
  const [flagPatches, setFlagPatches] = useState<Record<string, FileFlagPatch>>(
    {},
  );
  const [collectionsExpanded, setCollectionsExpanded] = useState(false);
  const [isMobile] = useState(
    () =>
      typeof window !== "undefined" &&
      window.innerWidth < MOBILE_WIDTH_THRESHOLD,
  );
  const isPlainSort = sortBy !== "type_group" && sortBy !== "time_group";
  const visibleFiles = useMemo(
    () => files.map((file) => patchFileFlags(file, flagPatches)),
    [files, flagPatches],
  );
  const shouldLiftPinnedStandaloneFiles =
    (isPlainSort || isGroupByTime) &&
    !isPinnedCollectionActive(activeCollection);
  const pinnedStandaloneFiles = useMemo(
    () =>
      shouldLiftPinnedStandaloneFiles
        ? visibleFiles.filter((file) => file.is_pinned)
        : [],
    [shouldLiftPinnedStandaloneFiles, visibleFiles],
  );
  const hasPinnedStandaloneFiles = pinnedStandaloneFiles.length > 0;
  const plainScrollerFiles = useMemo(
    () =>
      isPlainSort && hasPinnedStandaloneFiles
        ? visibleFiles.filter((file) => !file.is_pinned)
        : visibleFiles,
    [hasPinnedStandaloneFiles, isPlainSort, visibleFiles],
  );
  const pinnedStandaloneGroupedFiles = useMemo(
    () =>
      hasPinnedStandaloneFiles
        ? [
            {
              key: PINNED_COLLECTION_KEY,
              ...FILE_TYPE_LABELS.pinned,
              files: pinnedStandaloneFiles,
            },
          ]
        : null,
    [hasPinnedStandaloneFiles, pinnedStandaloneFiles],
  );
  const visibleGroupedFiles = useMemo(
    () =>
      groupedFiles?.map((group) => ({
        ...group,
        files: group.files.map((file) => patchFileFlags(file, flagPatches)),
      })) ?? null,
    [groupedFiles, flagPatches],
  );
  const visibleTimeGroupedItems = useMemo(
    () =>
      timeGroupedItems
        ?.map((group) => {
          const files = group.files
            .map((file) => patchFileFlags(file, flagPatches))
            .filter((file) => !(hasPinnedStandaloneFiles && file.is_pinned));
          const items = group.items
            .map((item) =>
              item.type === "file"
                ? { ...item, file: patchFileFlags(item.file, flagPatches) }
                : item,
            )
            .filter(
              (item) =>
                item.type !== "file" ||
                !(hasPinnedStandaloneFiles && item.file.is_pinned),
            );
          return {
            ...group,
            files,
            items,
          };
        })
        .filter((group) => group.items.length > 0) ?? null,
    [timeGroupedItems, flagPatches, hasPinnedStandaloneFiles],
  );
  const mixedItems = useMemo(() => {
    if (!isPlainSort) return [];

    const folderItems = displayFolders.map((folder) => ({
      type: "folder" as const,
      folder,
    }));
    const fileItems = plainScrollerFiles.map((file) => ({
      type: "file" as const,
      file,
    }));
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
  }, [displayFolders, plainScrollerFiles, sortBy, isPlainSort]);

  const itemCountForVirtual = isPlainSort
    ? mixedItems.length
    : visibleFiles.length;
  const shouldUseVirtualList =
    !isMobile && itemCountForVirtual > FILE_LIST.VIRTUAL_THRESHOLD;
  const [openMenu, setOpenMenu] = useState<MenuState | null>(null);
  const [activityFile, setActivityFile] = useState<FileMetadata | null>(null);
  const [versionFile, setVersionFile] = useState<FileMetadata | null>(null);
  const [tagFile, setTagFile] = useState<FileMetadata | null>(null);
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

  const toggleFavorite = useCallback(async (file: FileMetadata) => {
    const patch = { is_favorite: !file.is_favorite };
    const previous = appQueryClient.getQueriesData<FilesInfiniteQueryData>({
      queryKey: ["files"],
    });
    setFlagPatches((current) => ({
      ...current,
      [file.id]: { ...current[file.id], ...patch },
    }));
    appQueryClient.setQueriesData<FilesInfiniteQueryData>(
      { queryKey: ["files"] },
      (data) => patchFilesQueryData(data, file.id, patch),
    );
    try {
      await tagsService.updateFlags(file.id, patch);
    } catch (error) {
      previous.forEach(([key, data]) => appQueryClient.setQueryData(key, data));
      setFlagPatches((current) => ({
        ...current,
        [file.id]: { ...current[file.id], is_favorite: file.is_favorite },
      }));
      throw error;
    } finally {
      await Promise.all([
        appQueryClient.invalidateQueries({ queryKey: ["files"] }),
        appQueryClient.invalidateQueries({
          queryKey: FILE_COLLECTION_COUNTS_QUERY_KEY,
        }),
      ]);
    }
  }, []);

  const togglePinned = useCallback(async (file: FileMetadata) => {
    const patch = { is_pinned: !file.is_pinned };
    const previous = appQueryClient.getQueriesData<FilesInfiniteQueryData>({
      queryKey: ["files"],
    });
    setFlagPatches((current) => ({
      ...current,
      [file.id]: { ...current[file.id], ...patch },
    }));
    appQueryClient.setQueriesData<FilesInfiniteQueryData>(
      { queryKey: ["files"] },
      (data) => patchFilesQueryData(data, file.id, patch),
    );
    try {
      await tagsService.updateFlags(file.id, patch);
    } catch (error) {
      previous.forEach(([key, data]) => appQueryClient.setQueryData(key, data));
      setFlagPatches((current) => ({
        ...current,
        [file.id]: { ...current[file.id], is_pinned: file.is_pinned },
      }));
      throw error;
    } finally {
      await Promise.all([
        appQueryClient.invalidateQueries({ queryKey: ["files"] }),
        appQueryClient.invalidateQueries({
          queryKey: FILE_COLLECTION_COUNTS_QUERY_KEY,
        }),
      ]);
    }
  }, []);

  useEffect(() => {
    if (!openMenu) return;
    const exists =
      openMenu.type === "file"
        ? visibleFiles.some((f) => f.id === openMenu.id)
        : displayFolders.some((f) => f.id === openMenu.id);
    if (!exists) {
      queueMicrotask(() => setOpenMenu(null));
    }
  }, [openMenu, visibleFiles, displayFolders]);

  const showBatchActions = selectedFiles.size + selectedFolders.size > 0;
  const totalText = `total:${displayFolders.length > 0 ? `${displayFolders.length} folders · ` : ""}${visibleFiles.length} files`;
  const activeSearch = searchQuery?.trim() ?? "";
  const showSearchStatus = activeSearch.length > 0 && Boolean(searchMetadata);
  const usesFilenameFallback = searchMetadata?.index_status === "fallback";
  const searchStatusText = usesFilenameFallback
    ? "Filename matches only"
    : "Fulltext search";
  const ocrReady =
    Boolean(searchMetadata?.ocr.enabled) &&
    Boolean(searchMetadata?.ocr.tesseract_available) &&
    Boolean(searchMetadata?.ocr.poppler_available);
  const isSingleCharacterSearch = activeSearch.length === 1;
  const hasSearchMatches = (searchMetadata?.count ?? 0) > 0;
  const searchStatusDescription = !searchMetadata
    ? ""
    : usesFilenameFallback
      ? !hasSearchMatches
        ? `${searchMetadata.count} results for "${activeSearch}" · No filename matches were found for this query. Try a different keyword.`
        : isSingleCharacterSearch
          ? `${searchMetadata.count} results for "${activeSearch}" · Single-character searches currently match filenames only so results stay fast. Type 2 or more characters to search OCR and file text.`
          : `${searchMetadata.count} results for "${activeSearch}" · These matches currently come from filenames${ocrReady ? " because the fulltext index did not return a text match for this query." : " because OCR text indexing is not fully available yet."}`
      : `${searchMetadata.count} results for "${activeSearch}"${!ocrReady ? " · OCR text indexing is not fully available yet." : ""}`;
  const hasVisibleItems = visibleFiles.length + displayFolders.length > 0;
  const hasActiveListFilter =
    activeSearch.length > 0 ||
    Boolean(activeCollection) ||
    Boolean(activeTagId);
  const emptyStateTitle = hasActiveListFilter
    ? "没有匹配的文件"
    : currentFolderId
      ? "文件夹为空"
      : "暂无文件";
  const emptyStateDescription = hasActiveListFilter
    ? "调整筛选条件后再试"
    : currentFolderId
      ? "拖拽文件到此处或创建子文件夹"
      : "上传你的第一个文件吧";
  const selectionBar = (
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
      activeCollection={activeCollection}
      activeTagId={activeTagId}
      collectionsExpanded={collectionsExpanded}
      currentFolderId={currentFolderId}
      searchQuery={searchQuery}
      mimeType={mimeType}
      onCollectionsExpandedChange={setCollectionsExpanded}
      onCollectionChange={onCollectionChange}
      onResetFilters={onResetFilters}
      onTagChange={onTagChange}
    />
  );

  return (
    <div>
      {versionFile && (
        <VersionHistoryDialog
          file={versionFile}
          onClose={() => setVersionFile(null)}
        />
      )}
      {activityFile && (
        <FileActivityDialog
          file={activityFile}
          onClose={() => setActivityFile(null)}
        />
      )}
      {tagFile && (
        <ManageTagsDialog file={tagFile} onClose={() => setTagFile(null)} />
      )}

      {error && (
        <ErrorMessage
          message={error}
          type="error"
          onClose={onClearError}
          autoDismissMs={5000}
          className="mb-[clamp(0.6rem,1.4vw,0.75rem)]"
        />
      )}

      {showSearchStatus && searchMetadata && (
        <div
          className="neu-raised fileListSearchStatusSurface mb-3"
          data-testid="search-status-surface"
        >
          <div className="fileListSearchStatusShell">
            <div
              className="neu-inset fileListSearchStatusWell"
              data-testid="search-status-copy"
            >
              <p className="fileListSearchStatusTitle">{searchStatusText}</p>
              <p className="fileListSearchStatusDescription">
                {searchStatusDescription}
              </p>
            </div>
            <div
              className="neu-inset fileListSearchStatusRail"
              data-testid="search-status-sources"
            >
              <p className="fileListSearchStatusCaption">Search can match in</p>
              <div className="fileListSearchStatusChips">
                {["Name", "Text", "OCR", "Tag"].map((label) => (
                  <span
                    key={label}
                    className="neu-raised-sm fileListSearchStatusChip"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-[clamp(0.75rem,2vw,1rem)] sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          <FileCardSkeleton count={12} />
        </div>
      ) : !hasVisibleItems ? (
        <>
          {hasActiveListFilter && selectionBar}
          <EmptyState
            title={emptyStateTitle}
            description={emptyStateDescription}
            icon={<EmptyIcon />}
          />
        </>
      ) : (
        <>
          {selectionBar}
          {isGroupByType && groupedFiles ? (
            <FileListGroupedView
              mode="type"
              groupedFiles={visibleGroupedFiles}
              timeGroupedItems={visibleTimeGroupedItems}
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
              onShowActivity={setActivityFile}
              onShowVersions={setVersionFile}
              onManageTags={setTagFile}
              onToggleFavorite={toggleFavorite}
              onTogglePinned={togglePinned}
              onFileDragStart={handleFileDragStart}
              onDropOnFolder={handleDropOnFolder}
              onPreviewFile={setPreviewFile}
              onShareFile={setShareFile}
              onToggleFileMenu={toggleFileMenu}
              onToggleFolderMenu={toggleFolderMenu}
              onCloseMenu={closeMenu}
            />
          ) : isGroupByTime && timeGroupedItems ? (
            <div className="space-y-[clamp(0.75rem,2vw,1rem)] pt-[clamp(0.2rem,0.7vw,0.25rem)]">
              {pinnedStandaloneGroupedFiles ? (
                <FileListGroupedView
                  mode="type"
                  groupedFiles={pinnedStandaloneGroupedFiles}
                  timeGroupedItems={null}
                  displayFolders={[]}
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
                  onShowActivity={setActivityFile}
                  onShowVersions={setVersionFile}
                  onManageTags={setTagFile}
                  onToggleFavorite={toggleFavorite}
                  onTogglePinned={togglePinned}
                  onFileDragStart={handleFileDragStart}
                  onDropOnFolder={handleDropOnFolder}
                  onPreviewFile={setPreviewFile}
                  onShareFile={setShareFile}
                  onToggleFileMenu={toggleFileMenu}
                  onToggleFolderMenu={toggleFolderMenu}
                  onCloseMenu={closeMenu}
                />
              ) : null}
              {visibleTimeGroupedItems && visibleTimeGroupedItems.length > 0 ? (
                <FileListGroupedView
                  mode="time"
                  groupedFiles={visibleGroupedFiles}
                  timeGroupedItems={visibleTimeGroupedItems}
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
                  onShowActivity={setActivityFile}
                  onShowVersions={setVersionFile}
                  onManageTags={setTagFile}
                  onToggleFavorite={toggleFavorite}
                  onTogglePinned={togglePinned}
                  onFileDragStart={handleFileDragStart}
                  onDropOnFolder={handleDropOnFolder}
                  onPreviewFile={setPreviewFile}
                  onShareFile={setShareFile}
                  onToggleFileMenu={toggleFileMenu}
                  onToggleFolderMenu={toggleFolderMenu}
                  onCloseMenu={closeMenu}
                />
              ) : null}
            </div>
          ) : (
            <div className="space-y-[clamp(0.75rem,2vw,1rem)] pt-[clamp(0.2rem,0.7vw,0.25rem)]">
              {pinnedStandaloneGroupedFiles ? (
                <FileListGroupedView
                  mode="type"
                  groupedFiles={pinnedStandaloneGroupedFiles}
                  timeGroupedItems={null}
                  displayFolders={[]}
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
                  onShowActivity={setActivityFile}
                  onShowVersions={setVersionFile}
                  onManageTags={setTagFile}
                  onToggleFavorite={toggleFavorite}
                  onTogglePinned={togglePinned}
                  onFileDragStart={handleFileDragStart}
                  onDropOnFolder={handleDropOnFolder}
                  onPreviewFile={setPreviewFile}
                  onShareFile={setShareFile}
                  onToggleFileMenu={toggleFileMenu}
                  onToggleFolderMenu={toggleFolderMenu}
                  onCloseMenu={closeMenu}
                />
              ) : null}
              {plainScrollerFiles.length + displayFolders.length > 0 ? (
                <FileListVirtualScroller
                  isPlainSort={isPlainSort}
                  shouldUseVirtualList={shouldUseVirtualList}
                  listKey={listKey}
                  mixedItems={mixedItems}
                  files={plainScrollerFiles}
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
                  onShowActivity={setActivityFile}
                  onFileDragStart={handleFileDragStart}
                  onDropOnFolder={handleDropOnFolder}
                  onShowVersions={setVersionFile}
                  onManageTags={setTagFile}
                  onToggleFavorite={toggleFavorite}
                  onTogglePinned={togglePinned}
                  onToggleFileMenu={toggleFileMenu}
                  onToggleFolderMenu={toggleFolderMenu}
                  onCloseMenu={closeMenu}
                />
              ) : null}
            </div>
          )}

          <InfiniteScrollSentinel
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
            requireUserScroll
            listSize={visibleFiles.length}
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
      className="h-[clamp(2rem,5vw,2.5rem)] w-[clamp(2rem,5vw,2.5rem)] text-[var(--color-text-muted)]"
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
