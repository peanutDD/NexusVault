import { memo } from 'react';
import { formatFileSize } from '../../utils/format';
import { FILE_LIST } from '../../constants';
import type { FileMetadata } from '../../services/files';
import LazyThumbnail from './LazyThumbnail';

interface FileRowProps {
  file: FileMetadata;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onPreview: (file: FileMetadata) => void;
  onShare: (file: FileMetadata) => void;
  onDownload: (file: FileMetadata) => void;
  onDelete: (id: string) => void;
}

const FileRow = memo(function FileRow({
  file,
  isSelected,
  onSelect,
  onPreview,
  onShare,
  onDownload,
  onDelete,
}: FileRowProps) {
  return (
    <div
      className="w-full grid grid-cols-[auto_72px_1fr_80px_120px_100px_100px_auto] gap-0 items-center px-6 py-2 hover:bg-gray-700/50 dark:hover:bg-gray-800/50 border-b border-gray-700/50 dark:border-gray-600/50 transition-all duration-150 cursor-pointer"
      style={{
        height: `${FILE_LIST.ROW_HEIGHT}px`,
        minWidth: 800,
      }}
    >
      <div>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelect(file.id)}
          className="rounded"
          aria-label={`选择文件 ${file.original_filename}`}
        />
      </div>
      <LazyThumbnail
        fileId={file.id}
        mimeType={file.mime_type}
        filename={file.original_filename}
        className="w-16 h-16 object-cover rounded"
      />
      <div className="truncate" title={file.original_filename}>
        {file.original_filename}
      </div>
      <div className="whitespace-nowrap text-sm text-gray-300 dark:text-gray-400 transition-colors duration-200">
        {formatFileSize(file.file_size)}
      </div>
      <div className="whitespace-nowrap text-sm text-gray-300 dark:text-gray-400 truncate transition-colors duration-200">
        {file.mime_type}
      </div>
      <div className="whitespace-nowrap text-sm text-gray-300 dark:text-gray-400 truncate transition-colors duration-200">
        {file.category || '—'}
      </div>
      <div className="whitespace-nowrap text-sm text-gray-300 dark:text-gray-400 transition-colors duration-200">
        {new Date(file.created_at).toLocaleDateString()}
      </div>
      <div className="whitespace-nowrap text-right text-sm font-medium flex justify-end gap-1">
        <button
          onClick={() => onPreview(file)}
          className="text-blue-400 dark:text-blue-500 hover:text-blue-300 dark:hover:text-blue-400 transition-colors duration-200 px-2 py-1 rounded hover:bg-blue-500/10 dark:hover:bg-blue-500/20"
          aria-label="预览文件"
        >
          预览
        </button>
        <button
          onClick={() => onDownload(file)}
          className="text-purple-400 dark:text-purple-500 hover:text-purple-300 dark:hover:text-purple-400 transition-colors duration-200 px-2 py-1 rounded hover:bg-purple-500/10 dark:hover:bg-purple-500/20"
          aria-label="下载文件"
        >
          下载
        </button>
        <button
          onClick={() => onShare(file)}
          className="text-green-400 dark:text-green-500 hover:text-green-300 dark:hover:text-green-400 transition-colors duration-200 px-2 py-1 rounded hover:bg-green-500/10 dark:hover:bg-green-500/20"
          aria-label="分享文件"
        >
          分享
        </button>
        <button
          onClick={() => onDelete(file.id)}
          className="text-red-400 dark:text-red-500 hover:text-red-300 dark:hover:text-red-400 transition-colors duration-200 px-2 py-1 rounded hover:bg-red-500/10 dark:hover:bg-red-500/20"
          aria-label="删除文件"
        >
          删除
        </button>
      </div>
    </div>
  );
});

export default FileRow;
