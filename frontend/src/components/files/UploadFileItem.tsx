import { memo, useState, useEffect } from 'react';
import { formatFileSize } from '../../utils/format';
import { cn } from '../../utils/cn';

export interface UploadFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  startTime?: number;
  file?: File;
}

interface UploadFileItemProps {
  file: UploadFile;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}

/**
 * 计算上传剩余时间
 */
function calculateRemainingTime(
  uploadedBytes: number,
  totalBytes: number,
  elapsedMs: number
): string {
  if (uploadedBytes === 0 || elapsedMs === 0) return '';

  const bytesPerMs = uploadedBytes / elapsedMs;
  const remainingBytes = totalBytes - uploadedBytes;
  const remainingMs = remainingBytes / bytesPerMs;
  const remainingSec = Math.ceil(remainingMs / 1000);

  if (remainingSec < 60) {
    return `${remainingSec} sec left`;
  }
  if (remainingSec < 3600) {
    const mins = Math.ceil(remainingSec / 60);
    return `${mins} min left`;
  }
  const hours = Math.floor(remainingSec / 3600);
  const mins = Math.ceil((remainingSec % 3600) / 60);
  return `${hours}h ${mins}m left`;
}

/**
 * 获取文件类型图标颜色
 */
function getFileIconColor(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '#6C5DD3';
  if (mimeType.startsWith('video/')) return '#6C5DD3';
  if (mimeType.startsWith('audio/')) return '#22C55E';
  if (mimeType === 'application/pdf') return '#EF4444';
  if (mimeType.includes('word') || mimeType.includes('document')) return '#3B82F6';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return '#22C55E';
  return '#6C5DD3';
}

/**
 * 上传文件项组件
 * 完美复刻设计稿的样式
 */
const UploadFileItem = memo(function UploadFileItem({
  file,
  onRemove,
  onRetry,
}: UploadFileItemProps) {
  const [now, setNow] = useState(Date.now());

  // 上传中时每秒更新一次
  useEffect(() => {
    if (file.status !== 'uploading') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [file.status]);

  const elapsedMs = file.startTime ? now - file.startTime : 0;
  const uploadedBytes = (file.progress / 100) * file.size;
  const remainingTime =
    file.status === 'uploading'
      ? calculateRemainingTime(uploadedBytes, file.size, elapsedMs)
      : '';

  const iconColor = getFileIconColor(file.mimeType);

  // 状态文字
  const renderStatusText = () => {
    switch (file.status) {
      case 'pending':
        return (
          <span className="text-xs text-gray-500">
            {formatFileSize(file.size)}
          </span>
        );
      case 'uploading':
        return (
          <span className="text-xs text-gray-500">
            {formatFileSize(file.size)}
            <span className="mx-1.5 text-gray-600">|</span>
            <span className="text-white">{file.progress}%</span>
            {remainingTime && (
              <>
                <span className="mx-1.5 text-gray-600">·</span>
                <span>{remainingTime}</span>
              </>
            )}
          </span>
        );
      case 'success':
        return (
          <span className="text-xs text-gray-500">
            Upload Successful
            <span className="mx-1.5 text-gray-600">|</span>
            <span className="text-white">100%</span>
          </span>
        );
      case 'error':
        return <span className="text-xs text-red-500">Upload failed</span>;
      default:
        return null;
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl bg-[#1C1C28]">
      {/* 主内容 */}
      <div className="flex items-center gap-3 p-3">
        {/* 文件图标 */}
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${iconColor}20` }}
        >
          <FileIcon color={iconColor} />
        </div>

        {/* 文件信息 */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white" title={file.name}>
            {file.name}
          </p>
          {renderStatusText()}
        </div>

        {/* 操作按钮 */}
        <div className="flex shrink-0 items-center gap-1">
          {file.status === 'error' && (
            <button
              type="button"
              onClick={() => onRetry(file.id)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-[#2A2A3C] hover:text-white"
              title="重试"
              aria-label="重试上传"
            >
              <RetryIcon />
            </button>
          )}
          <button
            type="button"
            onClick={() => onRemove(file.id)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-[#2A2A3C] hover:text-white"
            title="删除"
            aria-label="删除文件"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      {/* 进度条 - 贯穿底部 */}
      {(file.status === 'uploading' || file.status === 'success') && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#2A2A3C]">
          <div
            className={cn(
              'h-full transition-all duration-300 ease-out',
              file.status === 'success'
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                : 'bg-gradient-to-r from-emerald-500 to-emerald-400'
            )}
            style={{ width: `${file.progress}%` }}
          />
        </div>
      )}
    </div>
  );
});

// 文件图标
function FileIcon({ color }: { color: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6 2C5.44772 2 5 2.44772 5 3V21C5 21.5523 5.44772 22 6 22H18C18.5523 22 19 21.5523 19 21V7L14 2H6Z"
        fill={color}
      />
      <path d="M14 2L19 7H15C14.4477 7 14 6.55228 14 6V2Z" fill={`${color}80`} />
    </svg>
  );
}

// 重试图标
function RetryIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

// 删除图标
function TrashIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

export default UploadFileItem;
