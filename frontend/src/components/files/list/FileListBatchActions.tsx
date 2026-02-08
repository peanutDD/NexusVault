import { memo } from 'react';
import { Circle, Download, MoveRight, Share2, Trash2 } from 'lucide-react';

interface FileListBatchActionsProps {
  selectedFileCount: number;
  selectedFolderCount: number;
  onBatchMove: () => void;
  onBatchShare: () => void;
  onBatchDownload: () => void;
  onBatchDelete: () => void;
  /** 批量下载 ZIP 进行中（后端打包 + 传输完成前保存框不会弹出） */
  batchDownloading?: boolean;
  /** 整合模式：不包玻璃拟态容器，由父级统一包裹 */
  bare?: boolean;
}

const FileListBatchActions = memo(function FileListBatchActions({
  selectedFileCount,
  selectedFolderCount,
  onBatchMove,
  onBatchShare,
  onBatchDownload,
  onBatchDelete,
  batchDownloading = false,
  bare = false,
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

  /* 与 ALL FILES 栏一致：text-[0.625rem] leading-none */
  const rowClass =
    'font-brand font-normal tracking-widest text-[0.625rem] leading-none';
  const btnClass =
    'glass-btn inline-flex items-center justify-center sm:justify-start gap-2 px-2 py-1 hover:border-white/25 ' +
    rowClass;

  const wrapperClass = bare
    ? 'batch-actions-row flex items-center justify-between gap-4 animate-fade-in transition-all duration-200'
    : 'batch-actions-bar glass-panel-soft flex items-center justify-between gap-4 animate-fade-in transition-all duration-200';

  return (
    <div className={wrapperClass}>
      <div className="flex min-w-0 items-center gap-2 whitespace-nowrap text-[0.625rem]">
        <span className="inline-block h-4 w-4 shrink-0 rounded-sm" aria-hidden />
        <span className="font-brand min-w-0 shrink truncate font-normal tracking-widest leading-none text-gray-300 text-[clamp(0.5rem,1.2vw,0.625rem)]">
          Already selected {getSelectionText()}
        </span>
      </div>

      <div className="flex min-w-0 items-center justify-end gap-1.5 overflow-x-auto whitespace-nowrap text-[0.625rem]">
        <button type="button" onClick={onBatchMove} className={btnClass}>
          <span
            className="relative inline-flex h-[1em] w-[1em] shrink-0 items-center justify-center"
            aria-hidden
          >
            <Circle
              fill="currentColor"
              strokeWidth={0}
              className="absolute inset-0 h-full w-full text-white/90"
            />
            <MoveRight
              strokeWidth={2}
              className="relative h-[0.65em] w-[0.65em] text-slate-600"
            />
          </span>
          <span className="hidden sm:inline">Batch Move</span>
        </button>
        <button type="button" onClick={onBatchShare} className={btnClass}>
          <span
            className="relative inline-flex h-[1em] w-[1em] shrink-0 items-center justify-center"
            aria-hidden
          >
            <Circle
              fill="currentColor"
              strokeWidth={0}
              className="absolute inset-0 h-full w-full text-white/90"
            />
            <Share2
              strokeWidth={2}
              className="relative h-[0.65em] w-[0.65em] text-slate-600"
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
            className="relative inline-flex h-[1em] w-[1em] shrink-0 items-center justify-center"
            aria-hidden
          >
            <Circle
              fill="currentColor"
              strokeWidth={0}
              className="absolute inset-0 h-full w-full text-white/90"
            />
            <Download
              strokeWidth={2.5}
              className="relative h-[0.65em] w-[0.65em] text-slate-600"
            />
          </span>
          <span className="hidden sm:inline">
            {batchDownloading ? '打包中…' : 'Batch Download ZIP'}
          </span>
        </button>
        <button type="button" onClick={onBatchDelete} className={btnClass}>
          <span
            className="relative inline-flex h-[1em] w-[1em] shrink-0 items-center justify-center"
            aria-hidden
          >
            <Circle
              fill="currentColor"
              strokeWidth={0}
              className="absolute inset-0 h-full w-full text-white/90"
            />
            <Trash2
              strokeWidth={2}
              className="relative h-[0.65em] w-[0.65em] text-slate-600"
            />
          </span>
          <span className="hidden sm:inline">Batch Delete</span>
        </button>
      </div>
    </div>
  );
});

export default FileListBatchActions;
