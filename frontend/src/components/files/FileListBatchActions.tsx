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
    <div className="mb-4 p-3 bg-purple-500/20 dark:bg-purple-600/20 border border-purple-500/50 dark:border-purple-600/50 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in transition-all duration-200">
      <span className="text-purple-200 dark:text-purple-300 font-medium">
        已选择 {getSelectionText()}
      </span>
      <div className="flex flex-wrap gap-2">
        {/* 只有选中文件时才显示移动按钮 */}
        {selectedFileCount > 0 && (
          <button
            onClick={onBatchMove}
            className="px-3 sm:px-4 py-2 bg-amber-600 dark:bg-amber-700 text-white rounded-lg hover:bg-amber-700 dark:hover:bg-amber-600 transition-all duration-200 text-sm"
          >
            批量移动
          </button>
        )}
        {/* 分享和下载只对文件有效 */}
        {selectedFileCount > 0 && selectedFolderCount === 0 && (
          <>
            <button
              onClick={onBatchShare}
              className="px-3 sm:px-4 py-2 bg-green-600 dark:bg-green-700 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition-all duration-200 text-sm"
            >
              批量分享
            </button>
            <button
              onClick={onBatchDownload}
              className="px-3 sm:px-4 py-2 bg-purple-600 dark:bg-purple-700 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 transition-all duration-200 text-sm"
            >
              批量下载 ZIP
            </button>
          </>
        )}
        <button
          onClick={onBatchDelete}
          className="px-3 sm:px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-all duration-200 text-sm"
        >
          批量删除
        </button>
      </div>
    </div>
  );
});

export default FileListBatchActions;
