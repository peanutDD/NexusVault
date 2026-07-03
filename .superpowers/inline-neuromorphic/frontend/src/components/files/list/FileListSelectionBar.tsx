import { useMemo } from "react";
import FileListBatchActions from "./FileListBatchActions";
import FileListCollectionChips from "./FileListCollectionChips";
import FileListRow from "./FileListRow";

interface FileListSelectionBarProps {
  showBatchActions: boolean;
  isRevalidating: boolean;
  allFilesSelected: boolean;
  selectedFileCount: number;
  selectedFolderCount: number;
  totalText: string;
  batchDownloading: boolean;
  onToggleSelectAll: () => void;
  onBatchMove: () => void;
  onBatchShare: () => void;
  onBatchDownload: () => void;
  onBatchDelete: () => void;
  activeCollection?: string;
  activeTagId?: string;
  collectionsExpanded?: boolean;
  currentFolderId?: string | null;
  searchQuery?: string;
  mimeType?: string;
  onCollectionsExpandedChange?: (value: boolean) => void;
  onCollectionChange?: (value: string) => void;
  onResetFilters?: () => void;
  onTagChange?: (value: string) => void;
}

export default function FileListSelectionBar({
  showBatchActions,
  isRevalidating,
  allFilesSelected,
  selectedFileCount,
  selectedFolderCount,
  totalText,
  batchDownloading,
  onToggleSelectAll,
  onBatchMove,
  onBatchShare,
  onBatchDownload,
  onBatchDelete,
  activeCollection,
  activeTagId,
  collectionsExpanded,
  currentFolderId,
  searchQuery,
  mimeType,
  onCollectionsExpandedChange,
  onCollectionChange,
  onResetFilters,
  onTagChange,
}: FileListSelectionBarProps) {
  const selectedCount = selectedFileCount + selectedFolderCount;
  const countQuery = useMemo(
    () => ({
      folder_id: currentFolderId ?? "root",
      search: searchQuery,
      mime_type: mimeType,
    }),
    [currentFolderId, searchQuery, mimeType],
  );
  const row = (
    <FileListRow
      isRevalidating={isRevalidating}
      allFilesSelected={allFilesSelected}
      selectedCount={selectedCount}
      totalText={totalText}
      selectionScopeLabel={currentFolderId ? "当前文件夹" : "All Files"}
      onToggleSelectAll={onToggleSelectAll}
    />
  );
  const hasBatchActions = showBatchActions && selectedCount > 0;
  const groupClassName = hasBatchActions
    ? "neu-raised fileListSelectionGroup fileListSelectionUnifiedSurface fileListSelectionFusionGroup fileListSelectionShell flex flex-col mb-3"
    : "neu-raised fileListSelectionGroup fileListSelectionUnifiedSurface fileListSelectionShell flex flex-col mb-3";

  return (
    <div className="sticky top-[calc(clamp(4.75rem,7.6vw,6.25rem)+env(safe-area-inset-top))] z-40 mb-[var(--bar-gap)]">
      <div className={groupClassName}>
        <div className="all-files-bar fileListSelectionSegment mb-0">{row}</div>
        <FileListCollectionChips
          activeCollection={activeCollection}
          activeTagId={activeTagId}
          collectionsExpanded={collectionsExpanded}
          countQuery={countQuery}
          onCollectionsExpandedChange={onCollectionsExpandedChange}
          onCollectionChange={onCollectionChange}
          onResetFilters={onResetFilters}
          onTagChange={onTagChange}
        />
        <FileListBatchActions
          bare={hasBatchActions}
          selectedFileCount={selectedFileCount}
          selectedFolderCount={selectedFolderCount}
          onBatchMove={onBatchMove}
          onBatchShare={onBatchShare}
          onBatchDownload={onBatchDownload}
          onBatchDelete={onBatchDelete}
          batchDownloading={batchDownloading}
        />
      </div>
    </div>
  );
}
