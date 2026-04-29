import FileListBatchActions from "./FileListBatchActions";
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
}: FileListSelectionBarProps) {
  const row = (
    <FileListRow
      isRevalidating={isRevalidating}
      allFilesSelected={allFilesSelected}
      selectedCount={selectedFileCount + selectedFolderCount}
      totalText={totalText}
      onToggleSelectAll={onToggleSelectAll}
    />
  );

  return (
    <div className="sticky top-[calc(clamp(4.75rem,7.6vw,6.25rem)+env(safe-area-inset-top))] z-40 mb-[var(--bar-gap)]">
      {showBatchActions ? (
        <div className="glass-panel-soft bars-integrated flex flex-col">
          {row}
          <FileListBatchActions
            bare
            selectedFileCount={selectedFileCount}
            selectedFolderCount={selectedFolderCount}
            onBatchMove={onBatchMove}
            onBatchShare={onBatchShare}
            onBatchDownload={onBatchDownload}
            onBatchDelete={onBatchDelete}
            batchDownloading={batchDownloading}
          />
        </div>
      ) : (
        <div className="flex flex-col" style={{ gap: "var(--bar-gap)" }}>
          <div className="all-files-bar glass-panel-soft mb-0">{row}</div>
          <FileListBatchActions
            selectedFileCount={selectedFileCount}
            selectedFolderCount={selectedFolderCount}
            onBatchMove={onBatchMove}
            onBatchShare={onBatchShare}
            onBatchDownload={onBatchDownload}
            onBatchDelete={onBatchDelete}
            batchDownloading={batchDownloading}
          />
        </div>
      )}
    </div>
  );
}
