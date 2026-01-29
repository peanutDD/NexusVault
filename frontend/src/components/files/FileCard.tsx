import { memo, useMemo } from 'react';
import { Download, Send, Trash2 } from 'lucide-react';
import { formatFileSize } from '../../utils/format';
import type { FileMetadata } from '../../services/files';
import LazyThumbnail from './LazyThumbnail';
import { cn } from '../../utils/cn';
import { getMimeTypeLabel } from '../../utils/mimeType';
import { preloadPreview } from '../../utils/preloadPreview';

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
        'glass-card group relative p-3',
        isSelected && 'ring-2 ring-purple-500 bg-purple-500/10'
      )}
      draggable
      onDragStart={handleDragStart}
      onMouseEnter={() => preloadPreview(file.id)}
    >
      {/* 缩略图 */}
      <div
        className="glass-thumb relative mb-3 aspect-square cursor-pointer overflow-hidden"
        onClick={() => onPreview(file)}
      >
        {/* 选择框 - 纯色紫圈 + 外圈水晶，选中闪动（固定尺寸避免切换时位移） */}
        <div
          className="absolute left-2 top-2 z-10 flex h-5 w-5 cursor-pointer items-center justify-center transition-all"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(file.id);
          }}
        >
          {isSelected ? (
            <div className="card-checkbox-outer-crystal card-checkbox-selected flex h-5 w-5 items-center justify-center rounded-full">
              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-violet-500">
                <svg className="h-3 w-3 text-white drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          ) : (
            <div className="flex h-4 w-4 items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100">
              <div className="h-3 w-3 rounded-full border-2 border-white/60" />
            </div>
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
            className="glass-btn bg-white/12 rounded-full p-3 transition-colors hover:bg-white/20"
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
        <div className="file-meta-14px flex items-center gap-2 text-gray-400">
          <span>{formatFileSize(file.file_size)}</span>
          <span className="h-1 w-1 rounded-full bg-gray-600" />
          <span>{mimeTypeLabel}</span>
        </div>

        {/* 上传时间 */}
        <p className="file-meta-14px text-gray-500">{formattedDate}</p>
      </div>

      {/* 操作按钮（更克制的小图标，常驻但非常弱化） */}
      <div
        className={cn(
          'mt-1.5 flex items-center justify-end gap-1 border-t border-white/5 pt-1.5 text-[10px]',
          'text-purple-100/50',
        )}
      >
        <button
          type="button"
          onClick={() => onDownload(file)}
          className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-purple-100/60 hover:text-purple-200 hover:bg-purple-500/10"
          title="下载"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onShare(file)}
          className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-purple-100/60 hover:text-purple-200 hover:bg-purple-500/15"
          title="分享"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(file.id)}
          className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-purple-100/60 hover:text-rose-300 hover:bg-rose-500/15"
          title="删除"
        >
          <Trash2 className="h-3.5 w-3.5" />
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

export default FileCard;
