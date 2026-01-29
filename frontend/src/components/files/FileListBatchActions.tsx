import { memo } from 'react';

interface FileListBatchActionsProps {
  selectedFileCount: number;
  selectedFolderCount: number;
  onBatchMove: () => void;
  onBatchShare: () => void;
  onBatchDownload: () => void;
  onBatchDelete: () => void;
}

const FileListBatchActions = memo(function FileListBatchActions({
  selectedFileCount,
  selectedFolderCount,
  onBatchMove,
  onBatchShare,
  onBatchDownload,
  onBatchDelete,
}: FileListBatchActionsProps) {
  const totalCount = selectedFileCount + selectedFolderCount;
  if (totalCount === 0) return null;

  // 构建选择描述文本
  const getSelectionText = () => {
    const parts: string[] = [];
    if (selectedFileCount > 0) {
      parts.push(`${selectedFileCount} file${selectedFileCount === 1 ? '' : 's'}`);
    }
    if (selectedFolderCount > 0) {
      parts.push(`${selectedFolderCount} folder${selectedFolderCount === 1 ? '' : 's'}`);
    }
    return parts.join(', ');
  };

  return (
    <div className="batch-actions-bar glass-panel mb-4 flex items-center justify-between gap-3 px-3 py-2 animate-fade-in transition-all duration-200">
      <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
        <i className="bi bi-check-circle-fill shrink-0 text-base text-white/90" aria-hidden />
        <span className="min-w-0 truncate text-xs font-medium text-white/85">
          Already selected {getSelectionText()}
        </span>
      </div>

      <div className="flex min-w-0 items-center justify-end gap-1.5 overflow-x-auto whitespace-nowrap">
        <button
          type="button"
          onClick={onBatchMove}
          className="glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-xs hover:border-white/25"
        >
          <i className="bi bi-arrow-left-right text-white/90" aria-hidden />
          Batch Move
        </button>
        <button
          type="button"
          onClick={onBatchShare}
          className="glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-xs hover:border-white/25"
        >
          <i className="bi bi-share-fill text-white/90" aria-hidden />
          Batch Share
        </button>
        <button
          type="button"
          onClick={onBatchDownload}
          className="glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-xs hover:border-white/25"
        >
          <i className="bi bi-download text-white/90" aria-hidden />
          Batch Download ZIP
        </button>
        <button
          type="button"
          onClick={onBatchDelete}
          className="glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-xs hover:border-white/25"
        >
          <i className="bi bi-trash-fill text-white/90" aria-hidden />
          Batch Delete
        </button>
      </div>
    </div>
  );
});

export default FileListBatchActions;
