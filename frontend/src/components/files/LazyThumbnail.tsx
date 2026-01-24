import { useState, useEffect, useRef } from 'react';
import { fileService } from '../../services/files';
import { cn } from '../../utils/cn';

interface LazyThumbnailProps {
  fileId: string;
  mimeType: string;
  filename: string;
  className?: string;
}

export default function LazyThumbnail({
  fileId,
  mimeType,
  filename,
  className = '',
}: LazyThumbnailProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isVisible || imageUrl || error) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '50px' }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [isVisible, imageUrl, error]);

  useEffect(() => {
    if (!isVisible || imageUrl || error) return;

    // 只对图片类型显示缩略图
    if (!mimeType.startsWith('image/')) {
      setError(true);
      return;
    }

    const url = fileService.getPreviewUrl(fileId);
    setImageUrl(url);
  }, [isVisible, fileId, mimeType, imageUrl, error]);

  if (error || !mimeType.startsWith('image/')) {
    return (
      <div
        ref={containerRef}
        className={cn('flex items-center justify-center bg-gray-700 rounded', className)}
      >
        <svg
          className="w-8 h-8 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {imageUrl ? (
        <img
          ref={imgRef}
          src={imageUrl}
          alt={filename}
          className="w-full h-full object-cover rounded"
          loading="lazy"
          onError={() => setError(true)}
        />
      ) : (
        <div className="flex items-center justify-center bg-gray-700 rounded animate-pulse">
          <svg
            className="w-8 h-8 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
