import { memo } from 'react';
import { MacActionIcon } from '../common/MacActionIcon';

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
    <div className="glass-panel mb-4 flex items-center justify-between gap-4 px-4 py-3 animate-fade-in transition-all duration-200">
      <div className="flex min-w-0 items-center gap-3 whitespace-nowrap">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
          <MacActionIcon variant="selected" />
        </span>
        <span className="min-w-0 text-white/85 font-medium truncate">
          Already selected {getSelectionText()}
        </span>
      </div>

      <div className="flex min-w-0 items-center justify-end gap-2 overflow-x-auto whitespace-nowrap">
        {/* 批量移动 - 文件和文件夹都支持 */}
        <button
          type="button"
          onClick={onBatchMove}
          className="glass-btn inline-flex items-center gap-2 px-4 py-2 text-sm hover:border-white/25"
        >
          <MacActionIcon variant="move" />
          Batch Move
        </button>
        {/* 批量分享 - 文件和文件夹都支持（文件夹会递归获取内部文件） */}
        <button
          type="button"
          onClick={onBatchShare}
          className="glass-btn inline-flex items-center gap-2 px-4 py-2 text-sm hover:border-white/25"
        >
          <MacActionIcon variant="share" />
          Batch Share
        </button>
        {/* 批量下载 - 文件和文件夹都支持（文件夹会递归获取内部文件） */}
        <button
          type="button"
          onClick={onBatchDownload}
          className="glass-btn inline-flex items-center gap-2 px-4 py-2 text-sm hover:border-white/25"
        >
          <MacActionIcon variant="download" />
          Batch Download ZIP
        </button>
        <button
          type="button"
          onClick={onBatchDelete}
          className="glass-btn inline-flex items-center gap-2 px-4 py-2 text-sm hover:border-white/25"
        >
          <MacActionIcon variant="delete" />
          Batch Delete
        </button>
      </div>
    </div>
  );
});

export default FileListBatchActions;
