import { memo } from 'react';
import { CheckCircle2, Circle, Download, MoveRight, Share2, Trash2 } from 'lucide-react';

interface FileListBatchActionsProps {
  selectedFileCount: number;
  selectedFolderCount: number;
  onBatchMove: () => void;
  onBatchShare: () => void;
  onBatchDownload: () => void;
  onBatchDelete: () => void;
  /** 批量下载 ZIP 进行中（后端打包 + 传输完成前保存框不会弹出） */
  batchDownloading?: boolean;
}

const FileListBatchActions = memo(function FileListBatchActions({
  selectedFileCount,
  selectedFolderCount,
  onBatchMove,
  onBatchShare,
  onBatchDownload,
  onBatchDelete,
  batchDownloading = false,
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

  const rowClass =
    'font-brand font-normal tracking-widest text-[clamp(0.45rem,1.1vw,0.6rem)] leading-none';
  const btnClass =
    'glass-btn inline-flex items-center justify-center sm:justify-start gap-[clamp(0.25rem,0.8vw,0.375rem)] px-[clamp(0.375rem,1vw,0.5rem)] py-[clamp(0.25rem,0.8vw,0.375rem)] hover:border-white/25 ' +
    rowClass;

  return (
    <div className="batch-actions-bar glass-panel-soft mb-4 flex items-center justify-between gap-4 px-4 py-3 animate-fade-in transition-all duration-200">
      <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
        <CheckCircle2
          strokeWidth={2}
          className="shrink-0 text-gray-300 scale-[clamp(0.7,2vw,1)]"
          aria-hidden
        />
        <span className={`min-w-0 truncate text-gray-300 ${rowClass} hidden sm:inline`}>
          Already selected {getSelectionText()}
        </span>
      </div>

      <div className="flex min-w-0 items-center justify-end gap-1.5 overflow-x-auto whitespace-nowrap">
        <button type="button" onClick={onBatchMove} className={btnClass}>
          <span
            className="relative inline-flex h-[clamp(0.65rem,2vw,0.85rem)] w-[clamp(0.65rem,2vw,0.85rem)] shrink-0 items-center justify-center"
            aria-hidden
          >
            <Circle
              fill="currentColor"
              strokeWidth={0}
              className="absolute inset-0 h-full w-full text-white/90"
            />
            <MoveRight
              strokeWidth={2}
              className="relative h-[clamp(0.45rem,1.4vw,0.65rem)] w-[clamp(0.45rem,1.4vw,0.65rem)] text-slate-600"
            />
          </span>
          <span className="hidden sm:inline">Batch Move</span>
        </button>
        <button type="button" onClick={onBatchShare} className={btnClass}>
          <span
            className="relative inline-flex h-[clamp(0.65rem,2vw,0.85rem)] w-[clamp(0.65rem,2vw,0.85rem)] shrink-0 items-center justify-center"
            aria-hidden
          >
            <Circle
              fill="currentColor"
              strokeWidth={0}
              className="absolute inset-0 h-full w-full text-white/90"
            />
            <Share2
              strokeWidth={2}
              className="relative h-[clamp(0.45rem,1.4vw,0.65rem)] w-[clamp(0.45rem,1.4vw,0.65rem)] text-slate-600"
            />
          </span>
          <span className="hidden sm:inline">Batch Share</span>
        </button>
        <button
          type="button"
          onClick={onBatchDownload}
          disabled={batchDownloading}
          className={btnClass + (batchDownloading ? ' cursor-wait opacity-70' : '')}
          title={batchDownloading ? '正在打包 ZIP，请稍候…' : undefined}
        >
          <span
            className="relative inline-flex h-[clamp(0.65rem,2vw,0.85rem)] w-[clamp(0.65rem,2vw,0.85rem)] shrink-0 items-center justify-center"
            aria-hidden
          >
            <Circle
              fill="currentColor"
              strokeWidth={0}
              className="absolute inset-0 h-full w-full text-white/90"
            />
            <Download
              strokeWidth={2.5}
              className="relative h-[clamp(0.45rem,1.4vw,0.65rem)] w-[clamp(0.45rem,1.4vw,0.65rem)] text-slate-600"
            />
          </span>
          <span className="hidden sm:inline">
            {batchDownloading ? '打包中…' : 'Batch Download ZIP'}
          </span>
        </button>
        <button type="button" onClick={onBatchDelete} className={btnClass}>
          <span
            className="relative inline-flex h-[clamp(0.65rem,2vw,0.85rem)] w-[clamp(0.65rem,2vw,0.85rem)] shrink-0 items-center justify-center"
            aria-hidden
          >
            <Circle
              fill="currentColor"
              strokeWidth={0}
              className="absolute inset-0 h-full w-full text-white/90"
            />
            <Trash2
              strokeWidth={2}
              className="relative h-[clamp(0.45rem,1.4vw,0.65rem)] w-[clamp(0.45rem,1.4vw,0.65rem)] text-slate-600"
            />
          </span>
          <span className="hidden sm:inline">Batch Delete</span>
        </button>
      </div>
    </div>
  );
});

export default FileListBatchActions;
