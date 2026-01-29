import { memo } from 'react';
import { CheckCircle2, Circle, Download, MoveRight, Share2, Trash2 } from 'lucide-react';

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

  const rowClass =
    'font-brand font-normal tracking-widest text-[0.625rem] leading-none';
  const btnClass =
    'glass-btn inline-flex items-center gap-1.5 px-2 py-1.5 hover:border-white/25 ' + rowClass;

  return (
    <div className="batch-actions-bar glass-panel-soft mb-4 flex items-center justify-between gap-4 px-4 py-3 animate-fade-in transition-all duration-200">
      <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
        <CheckCircle2 size={10} strokeWidth={2} className="shrink-0 text-gray-300" aria-hidden />
        <span className={`min-w-0 truncate text-gray-300 ${rowClass}`}>
          Already selected {getSelectionText()}
        </span>
      </div>

      <div className="flex min-w-0 items-center justify-end gap-1.5 overflow-x-auto whitespace-nowrap">
        <button type="button" onClick={onBatchMove} className={btnClass}>
          <MoveRight size={10} strokeWidth={2} className="shrink-0 text-white/90" aria-hidden />
          Batch Move
        </button>
        <button type="button" onClick={onBatchShare} className={btnClass}>
          <Share2 size={10} strokeWidth={2} className="shrink-0 text-white/90" aria-hidden />
          Batch Share
        </button>
        <button type="button" onClick={onBatchDownload} className={btnClass}>
          <span className="relative inline-flex h-2.5 w-2.5 shrink-0 items-center justify-center" aria-hidden>
            <Circle size={10} fill="currentColor" strokeWidth={0} className="absolute inset-0 h-full w-full text-white/90" />
            <Download size={6} strokeWidth={2.5} className="relative text-slate-600" />
          </span>
          Batch Download ZIP
        </button>
        <button type="button" onClick={onBatchDelete} className={btnClass}>
          <Trash2 size={10} strokeWidth={2} className="shrink-0 text-white/90" aria-hidden />
          Batch Delete
        </button>
      </div>
    </div>
  );
});

export default FileListBatchActions;
