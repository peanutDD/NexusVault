import { memo } from "react";
import { Download, MoveRight, Share2, Trash2 } from "lucide-react";

interface FileListBatchActionsProps {
  selectedFileCount: number;
  selectedFolderCount: number;
  onBatchMove: () => void;
  onBatchShare: () => void;
  onBatchDownload: () => void;
  onBatchDelete: () => void;
  /** 批量下载 ZIP 进行中（后端打包 + 传输完成前保存框不会弹出） */
  batchDownloading?: boolean;
  /** Legacy inline mode for callers that provide their own visual shell. */
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

  /* 与 ALL FILES 栏一致：tiny fluid label scale */
  const rowClass =
    "font-brand font-normal tracking-widest text-[length:var(--font-size-ui-5xs)] leading-none";
  const btnClass =
    "neu-raised-sm batchActionBtn inline-flex items-center justify-center sm:justify-start gap-[clamp(0.4rem,1vw,0.5rem)] px-[clamp(0.4rem,1vw,0.5rem)] py-[clamp(0.2rem,0.7vw,0.25rem)] active:shadow-[var(--neu-pressed-shadow)] " +
    rowClass;

  const wrapperClass = bare
    ? "batch-actions-bar batch-actions-row fileListSelectionSegment flex items-center justify-end gap-[clamp(0.75rem,2vw,1rem)] animate-fade-in transition-all duration-200"
    : "batch-actions-bar batch-actions-row neu-raised fileListSelectionShell flex items-center justify-end gap-[clamp(0.75rem,2vw,1rem)] animate-fade-in transition-all duration-200";

  return (
    <div className={wrapperClass} data-oid="4faqf4j">
      <div
        className="batchActionButtonsRow flex min-w-0 items-center justify-end gap-[clamp(0.3rem,0.8vw,0.375rem)] overflow-visible whitespace-nowrap text-[length:var(--font-size-ui-5xs)]"
        data-oid=":7zr0ik"
      >
        <button
          type="button"
          onClick={onBatchMove}
          className={btnClass}
          data-oid="v6ltkew"
        >
          <MoveRight
            strokeWidth={2}
            className="h-[1em] w-[1em] shrink-0 text-[var(--filelist-btn-text)] opacity-90"
            aria-hidden
            data-oid=".:4i8.8"
          />
          <span className="hidden sm:inline" data-oid="ndudl2d">
            Batch Move
          </span>
        </button>
        <button
          type="button"
          onClick={onBatchShare}
          className={btnClass}
          data-oid="kpmxorg"
        >
          <Share2
            strokeWidth={2}
            className="h-[1em] w-[1em] shrink-0 text-[var(--filelist-btn-text)] opacity-90"
            aria-hidden
            data-oid="hcdh6lw"
          />
          <span className="hidden sm:inline" data-oid="8n9.0-c">
            Batch Share
          </span>
        </button>
        <button
          type="button"
          onClick={onBatchDownload}
          disabled={batchDownloading}
          className={
            btnClass + (batchDownloading ? " cursor-wait opacity-70" : "")
          }
          title={batchDownloading ? "正在打包 ZIP，请稍候…" : undefined}
          data-oid="m4pbcwk"
        >
          <Download
            strokeWidth={2.5}
            className="h-[1em] w-[1em] shrink-0 text-[var(--filelist-btn-text)] opacity-90"
            aria-hidden
            data-oid=".x9tmcw"
          />
          <span className="hidden sm:inline" data-oid="w6k92kx">
            {batchDownloading ? "打包中…" : "Batch Download ZIP"}
          </span>
        </button>
        <button
          type="button"
          onClick={onBatchDelete}
          className={btnClass}
          data-oid="q64jv5u"
        >
          <Trash2
            strokeWidth={2}
            className="h-[1em] w-[1em] shrink-0 text-[var(--filelist-btn-text)] opacity-90"
            aria-hidden
            data-oid="385v02v"
          />
          <span className="hidden sm:inline" data-oid="uu21om_">
            Batch Delete
          </span>
        </button>
      </div>
    </div>
  );
});

export default FileListBatchActions;
