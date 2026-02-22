import { useState, useEffect, useRef, useCallback } from 'react';
import { fileService } from '../../../services/files';
import { ResponsivePicture } from '../../common/ResponsivePicture';
import { cn } from '../../../utils/cn';
import { isImageType, isVideoType, isPdfType, isAudioType } from '../../../utils/mimeType';
import { getCachedThumbnailUrl, setCachedThumbnailUrl } from '../../../utils/thumbnailBlobCache';

interface LazyThumbnailProps {
  fileId: string;
  mimeType: string;
  filename: string;
  className?: string;
  priority?: 'high' | 'low';
}

type ThumbnailState = {
  fileId: string;
  blobUrl: string | null;
  loading: boolean;
  showLoadingUi: boolean;
  error: boolean;
};

// 共享 IntersectionObserver：避免长列表里“每个缩略图一个 observer”造成额外开销
type ObserveCallback = () => void;
let sharedObserver: IntersectionObserver | null = null;
const observeCallbacks = new Map<Element, ObserveCallback>();

function getSharedObserver() {
  if (sharedObserver) return sharedObserver;
  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return null;

  sharedObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const cb = observeCallbacks.get(entry.target);
        if (cb) cb();
      }
    },
    { rootMargin: '80px', threshold: 0.01 }
  );
  return sharedObserver;
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
    // 其他类型占位图：与视频卡片统一使用紫色背景
    bgClass: 'bg-purple-900/30',
    label: null,
  };
}

const SHOW_LOADING_DELAY_MS = 100; // 延迟显示加载骨架，缓存命中或快速响应时不再闪一下
const RETRY_MAX = 3;
const RETRY_BASE_MS = 800;

export default function LazyThumbnail({
  fileId,
  mimeType,
  filename,
  className = '',
  priority = 'low',
}: LazyThumbnailProps) {
  const showThumbnail = isImageType(mimeType);
  const eagerLoad = priority === 'high';
  const cachedUrl = showThumbnail ? getCachedThumbnailUrl(fileId) ?? null : null;
  const createInitialState = useCallback(
    (): ThumbnailState => ({
      fileId,
      blobUrl: cachedUrl,
      loading: false,
      showLoadingUi: false,
      error: false,
    }),
    [fileId, cachedUrl]
  );
  const [state, setState] = useState<ThumbnailState>(() => createInitialState());
  const effectiveState = state.fileId === fileId ? state : createInitialState();
  const { blobUrl, loading, showLoadingUi, error } = effectiveState;
  const updateState = useCallback(
    (partial: Partial<ThumbnailState>) => {
      setState((prev) => {
        const base = prev.fileId === fileId ? prev : createInitialState();
        return { ...base, ...partial };
      });
    },
    [fileId, createInitialState]
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const loadingDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestStateRef = useRef({ blobUrl: null as string | null, error: false });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (loadingDelayRef.current) clearTimeout(loadingDelayRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  // Blob URL 由 thumbnailBlobCache 统一管理，淘汰时再 revoke，此处不再 revoke 避免与缓存冲突

  useEffect(() => {
    latestStateRef.current = { blobUrl, error };
  }, [blobUrl, error]);

  useEffect(() => {
    retryCountRef.current = 0;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, [fileId]);

  useEffect(() => {
    if (!showThumbnail) return;

    const observer = getSharedObserver();
    const el = containerRef.current;
    if (!el) return;

    const triggerLoad = () => {
      const cached = getCachedThumbnailUrl(fileId);
      if (cached) {
        if (mountedRef.current) {
          updateState({ blobUrl: cached, error: false, showLoadingUi: false });
        }
        return;
      }
      updateState({ loading: true });
      if (loadingDelayRef.current) clearTimeout(loadingDelayRef.current);
      loadingDelayRef.current = setTimeout(() => {
        loadingDelayRef.current = null;
        if (mountedRef.current) updateState({ showLoadingUi: true });
      }, SHOW_LOADING_DELAY_MS);
    };

    if (eagerLoad || !observer) {
      triggerLoad();
      return;
    }

    observeCallbacks.set(el, () => {
      triggerLoad();
      observeCallbacks.delete(el);
      observer.unobserve(el);
    });

    observer.observe(el);
    return () => {
      observeCallbacks.delete(el);
      if (loadingDelayRef.current) {
        clearTimeout(loadingDelayRef.current);
        loadingDelayRef.current = null;
      }
      try {
        observer.unobserve(el);
      } catch {
        // ignore
      }
    };
  }, [fileId, mimeType, showThumbnail, updateState, eagerLoad]);

  useEffect(() => {
    if (!showThumbnail || !loading || blobUrl || error) return;

    let cancelled = false;
    const scheduleRetry = () => {
      if (retryCountRef.current >= RETRY_MAX) return;
      retryCountRef.current += 1;
      const delay = RETRY_BASE_MS * retryCountRef.current;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(() => {
        if (!mountedRef.current || cancelled) return;
        const latest = latestStateRef.current;
        if (latest.blobUrl || latest.error) return;
        fileService
          .fetchThumbnailBlob(fileId)
          .then((retryBlob) => {
            if (!mountedRef.current || cancelled) return;
            if (retryBlob === null) {
              scheduleRetry();
              return;
            }
            const url = URL.createObjectURL(retryBlob);
            setCachedThumbnailUrl(fileId, url);
            updateState({ blobUrl: url });
          })
          .catch(() => {
            if (mountedRef.current && !cancelled) updateState({ error: true });
          });
      }, delay);
    };
    fileService
      .fetchThumbnailBlob(fileId)
      .then((blob) => {
        if (!mountedRef.current || cancelled) return;
        if (blob === null) {
          scheduleRetry();
          return;
        }
        const url = URL.createObjectURL(blob);
        setCachedThumbnailUrl(fileId, url);
        updateState({ blobUrl: url });
      })
      .catch(() => {
        if (mountedRef.current && !cancelled) updateState({ error: true });
      })
      .finally(() => {
        if (mountedRef.current) {
          updateState({ loading: false, showLoadingUi: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fileId, showThumbnail, loading, blobUrl, error, updateState]);

  const placeholder = (
    <div
      ref={containerRef}
      className={cn(
        'flex items-center justify-center bg-purple-900/30 dark:bg-purple-900/40 rounded overflow-hidden shrink-0',
        className
      )}
    >
      {showLoadingUi ? (
        <div className="w-full h-full animate-pulse bg-gray-600 dark:bg-gray-500" />
      ) : showThumbnail ? (
        <ImageIcon className="w-8 h-8" />
      ) : (
        <FileIcon className="w-8 h-8" />
      )}
    </div>
  );

  // 非缩略图类型（视频/PDF/音频等）：显示专门图标
  if (!showThumbnail) {
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
          // 错误占位也统一使用与视频卡片相同的紫色背景
          'flex items-center justify-center bg-purple-900/30 dark:bg-purple-900/40 rounded overflow-hidden shrink-0',
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
        <ResponsivePicture
          src={blobUrl}
          alt={filename}
          className="w-full h-full object-cover"
          loading={eagerLoad ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={eagerLoad ? 'high' : 'low'}
          onError={() => updateState({ error: true })}
        />
      </div>
    );
  }

  return placeholder;
}
