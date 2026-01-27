import { memo, useMemo } from 'react';
import { formatFileSize } from '../../utils/format';
import type { FileMetadata } from '../../services/files';
import LazyThumbnail from './LazyThumbnail';
import { cn } from '../../utils/cn';
import { getMimeTypeLabel } from '../../utils/mimeType';

interface FileCardProps {
  file: FileMetadata;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onPreview: (file: FileMetadata) => void;
  onShare: (file: FileMetadata) => void;
  onDownload: (file: FileMetadata) => void;
  onDelete: (id: string) => void;
  onDragStart?: (e: React.DragEvent, file: FileMetadata) => void;
}

/**
 * 文件卡片组件
 * 以缩略图形式展示文件信息，支持拖拽
 */
const FileCard = memo(function FileCard({
  file,
  isSelected,
  onSelect,
  onPreview,
  onShare,
  onDownload,
  onDelete,
  onDragStart,
}: FileCardProps) {
  // 使用 useMemo 缓存格式化结果
  const formattedDate = useMemo(() => {
    return new Date(file.created_at).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [file.created_at]);

  const mimeTypeLabel = useMemo(() => getMimeTypeLabel(file.mime_type), [file.mime_type]);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/file-id', file.id);
    e.dataTransfer.effectAllowed = 'move';
    onDragStart?.(e, file);
  };

  return (
    <div
      className={cn(
        'group relative rounded-xl bg-gray-800/80 p-3 transition-all duration-200 hover:bg-gray-800 hover:shadow-lg hover:shadow-purple-500/10',
        isSelected && 'ring-2 ring-purple-500 bg-purple-500/10'
      )}
      draggable
      onDragStart={handleDragStart}
    >
      {/* 缩略图 */}
      <div
        className="relative mb-3 aspect-square cursor-pointer overflow-hidden rounded-lg bg-gray-700"
        onClick={() => onPreview(file)}
      >
        {/* 选择框 - 带背景，悬浮或选中时显示 */}
        <div
          className={cn(
            'absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-md transition-all cursor-pointer',
            isSelected
              ? 'bg-purple-500'
              : 'bg-black/40 opacity-0 group-hover:opacity-100'
          )}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(file.id);
          }}
        >
          {isSelected ? (
            <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <div className="h-4 w-4 rounded border-2 border-white/60" />
          )}
        </div>
        <LazyThumbnail
          fileId={file.id}
          mimeType={file.mime_type}
          filename={file.original_filename}
          className="h-full w-full"
        />
        {/* 悬浮预览按钮 */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPreview(file);
            }}
            aria-label="预览"
            className="rounded-full bg-white/20 p-3 backdrop-blur-sm transition-colors hover:bg-white/30"
          >
            <EyeIcon />
          </button>
        </div>
      </div>

      {/* 文件信息 */}
      <div className="space-y-1.5">
        {/* 文件名 */}
        <h3
          className="truncate text-sm font-medium text-white"
          title={file.original_filename}
        >
          {file.original_filename}
        </h3>

        {/* 文件大小和类型 */}
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>{formatFileSize(file.file_size)}</span>
          <span className="h-1 w-1 rounded-full bg-gray-600" />
          <span>{mimeTypeLabel}</span>
        </div>

        {/* 上传时间 */}
        <p className="text-xs text-gray-500">{formattedDate}</p>
      </div>

      {/* 操作按钮 */}
      <div className="mt-3 flex items-center justify-between border-t border-gray-700/50 pt-3">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onDownload(file)}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-700 hover:text-purple-400"
            title="下载"
          >
            <DownloadIcon />
          </button>
          <button
            type="button"
            onClick={() => onShare(file)}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-700 hover:text-green-400"
            title="分享"
          >
            <ShareIcon />
          </button>
        </div>
        <button
          type="button"
          onClick={() => onDelete(file.id)}
          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-700 hover:text-red-400"
          title="删除"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
});

// 预览图标
function EyeIcon() {
  return (
    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  );
}

// 下载图标
function DownloadIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}

// 分享图标
function ShareIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
      />
    </svg>
  );
}

// 删除图标
function TrashIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

export default FileCard;
