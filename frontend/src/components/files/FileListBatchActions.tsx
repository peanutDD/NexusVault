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
    if (selectedFileCount > 0) parts.push(`${selectedFileCount} 个文件`);
    if (selectedFolderCount > 0) parts.push(`${selectedFolderCount} 个文件夹`);
    return parts.join('、');
  };

  return (
    <div className="glass-panel mb-4 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in transition-all duration-200">
      <span className="text-white/85 font-medium">
        已选择 {getSelectionText()}
      </span>
      <div className="flex flex-wrap gap-2">
        {/* 批量移动 - 文件和文件夹都支持 */}
        <button
          onClick={onBatchMove}
          className="glass-btn px-3 sm:px-4 py-2 text-sm hover:border-white/25"
        >
          批量移动
        </button>
        {/* 批量分享 - 文件和文件夹都支持（文件夹会递归获取内部文件） */}
        <button
          onClick={onBatchShare}
          className="glass-btn px-3 sm:px-4 py-2 text-sm hover:border-white/25"
        >
          批量分享
        </button>
        {/* 批量下载 - 文件和文件夹都支持（文件夹会递归获取内部文件） */}
        <button
          onClick={onBatchDownload}
          className="glass-btn px-3 sm:px-4 py-2 text-sm hover:border-white/25"
        >
          批量下载 ZIP
        </button>
        <button
          onClick={onBatchDelete}
          className="glass-btn px-3 sm:px-4 py-2 text-sm hover:border-white/25"
        >
          批量删除
        </button>
      </div>
    </div>
  );
});

export default FileListBatchActions;
