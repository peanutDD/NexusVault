import { useState, useEffect, useRef } from 'react';
import { fileService } from '../../services/files';
import { cn } from '../../utils/cn';
import { isImageType, isVideoType, isPdfType, isAudioType } from '../../utils/mimeType';

interface LazyThumbnailProps {
  fileId: string;
  mimeType: string;
  filename: string;
  className?: string;
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('text-gray-500', className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('text-gray-500', className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function VideoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('text-purple-400', className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function PdfIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('text-red-400', className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
      />
      <text x="7" y="16" fontSize="6" fontWeight="bold" fill="currentColor" stroke="none">
        PDF
      </text>
    </svg>
  );
}

function AudioIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('text-green-400', className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
      />
    </svg>
  );
}

/** 获取文件类型对应的图标和背景色 */
function getFileTypeDisplay(mimeType: string) {
  if (isVideoType(mimeType)) {
    return {
      icon: <VideoIcon className="h-10 w-10" />,
      bgClass: 'bg-purple-900/30',
      label: 'VIDEO',
    };
  }
  if (isPdfType(mimeType)) {
    return {
      icon: <PdfIcon className="h-10 w-10" />,
      bgClass: 'bg-red-900/30',
      label: 'PDF',
    };
  }
  if (isAudioType(mimeType)) {
    return {
      icon: <AudioIcon className="h-10 w-10" />,
      bgClass: 'bg-green-900/30',
      label: 'AUDIO',
    };
  }
  return {
    icon: <FileIcon className="h-8 w-8" />,
    bgClass: 'bg-gray-700',
    label: null,
  };
}

export default function LazyThumbnail({
  fileId,
  mimeType,
  filename,
  className = '',
}: LazyThumbnailProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  useEffect(() => {
    if (!isImageType(mimeType)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setLoading(true);
        observer.disconnect();
      },
      { rootMargin: '80px', threshold: 0.01 }
    );

    const el = containerRef.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [mimeType]);

  useEffect(() => {
    if (!isImageType(mimeType) || !loading || blobUrl || error) return;

    let revoked = false;
    fileService
      .fetchPreviewBlob(fileId)
      .then((blob) => {
        if (!mountedRef.current || revoked) return;
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
      })
      .catch(() => {
        if (mountedRef.current && !revoked) setError(true);
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });

    return () => {
      revoked = true;
    };
  }, [fileId, mimeType, loading, blobUrl, error]);

  const placeholder = (
    <div
      ref={containerRef}
      className={cn(
        'flex items-center justify-center bg-gray-700 dark:bg-gray-600 rounded overflow-hidden shrink-0',
        className
      )}
    >
      {loading ? (
        <div className="w-full h-full animate-pulse bg-gray-600 dark:bg-gray-500" />
      ) : isImageType(mimeType) ? (
        <ImageIcon className="w-8 h-8" />
      ) : (
        <FileIcon className="w-8 h-8" />
      )}
    </div>
  );

  // 非图片类型：显示专门的图标
  if (!isImageType(mimeType)) {
    const { icon, bgClass, label } = getFileTypeDisplay(mimeType);
    return (
      <div
        ref={containerRef}
        className={cn(
          'flex flex-col items-center justify-center rounded overflow-hidden shrink-0',
          bgClass,
          className
        )}
      >
        {icon}
        {label && (
          <span className="mt-1 text-xs font-medium text-white/60">{label}</span>
        )}
      </div>
    );
  }

  // 图片加载错误
  if (error) {
    return (
      <div
        ref={containerRef}
        className={cn(
          'flex items-center justify-center bg-gray-700 dark:bg-gray-600 rounded overflow-hidden shrink-0',
          className
        )}
      >
        <ImageIcon className="h-8 w-8" />
      </div>
    );
  }

  if (blobUrl) {
    return (
      <div ref={containerRef} className={cn('rounded overflow-hidden shrink-0', className)}>
        <img
          src={blobUrl}
          alt={filename}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setError(true)}
        />
      </div>
    );
  }

  return placeholder;
}
