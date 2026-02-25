import { useState, useEffect, useRef, useCallback } from 'react';
import { fileService } from '../../../services/files';
import { cn } from '../../../utils/cn';
import { isImageType, isVideoType, isPdfType, isAudioType } from '../../../utils/mimeType';
import { useAuthStore } from '../../../store/authStore';
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
  imageUrl: string | null;
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


const SHOW_LOADING_DELAY_MS = 100; // 延迟显示加载骨架，缓存命中或快速响应时不再闪一下

export default function LazyThumbnail({
  fileId,
  mimeType,
  filename,
  className = '',
  priority = 'low',
}: LazyThumbnailProps) {
  const showThumbnail = isImageType(mimeType);
  const eagerLoad = priority === 'high';
  const token =
    useAuthStore.getState().token ??
    (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
  const thumbnailUrl = showThumbnail
    ? fileService.getThumbnailUrl(fileId, { width: 400, token })
    : null;
  const createInitialState = useCallback(
    (): ThumbnailState => ({
      fileId,
      imageUrl: eagerLoad && thumbnailUrl ? thumbnailUrl : null,
      loading: eagerLoad && !!thumbnailUrl,
      showLoadingUi: false,
      error: false,
    }),
    [fileId, eagerLoad, thumbnailUrl]
  );
  const [state, setState] = useState<ThumbnailState>(() => createInitialState());
  // 在 render 阶段修正 state，确保渲染内容与 fileId 一致，避免旧图片闪烁
  const effectiveState = state.fileId === fileId ? state : createInitialState();
  
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
  const fallbackAttemptedRef = useRef(false);
  const handleImageLoad = useCallback(() => {
    if (loadingDelayRef.current) {
      clearTimeout(loadingDelayRef.current);
      loadingDelayRef.current = null;
    }
    updateState({ loading: false, showLoadingUi: false });
  }, [updateState]);
  const handleImageError = useCallback(() => {
    if (loadingDelayRef.current) {
      clearTimeout(loadingDelayRef.current);
      loadingDelayRef.current = null;
    }
    if (!showThumbnail) {
      updateState({ error: true, loading: false, showLoadingUi: false });
      return;
    }
    if (!fallbackAttemptedRef.current && fileId) {
      fallbackAttemptedRef.current = true;
      const cached = getCachedThumbnailUrl(fileId);
      if (cached) {
        updateState({
          imageUrl: cached,
          error: false,
          loading: false,
          showLoadingUi: false,
        });
        return;
      }
      fileService
        .fetchThumbnailBlob(fileId)
        .then((blob) => {
          if (!mountedRef.current) return;
          if (!blob) {
            updateState({ error: true, loading: false, showLoadingUi: false });
            return;
          }
          const url = URL.createObjectURL(blob);
          setCachedThumbnailUrl(fileId, url);
          updateState({
            imageUrl: url,
            error: false,
            loading: false,
            showLoadingUi: false,
          });
        })
        .catch(() => {
          if (mountedRef.current) {
            updateState({ error: true, loading: false, showLoadingUi: false });
          }
        });
      return;
    }
    updateState({ error: true, loading: false, showLoadingUi: false });
  }, [fileId, showThumbnail, updateState]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (loadingDelayRef.current) clearTimeout(loadingDelayRef.current);
    };
  }, []);

  useEffect(() => {
    if (loadingDelayRef.current) {
      clearTimeout(loadingDelayRef.current);
      loadingDelayRef.current = null;
    }
    fallbackAttemptedRef.current = false;
  }, [fileId]);

  useEffect(() => {
    if (!showThumbnail) return;

    const observer = getSharedObserver();
    const el = containerRef.current;
    if (!el) return;

    const triggerLoad = () => {
      if (!thumbnailUrl) return;
      setState((prev) => {
        const base = prev.fileId === fileId ? prev : createInitialState();
        if (base.imageUrl) return base;
        return {
          ...base,
          imageUrl: thumbnailUrl,
          loading: true,
          // 立即重置 showLoadingUi 为 false，由 setTimeout 稍后决定是否显示
          showLoadingUi: false,
          error: false,
        };
      });
      
      // 清除旧的定时器（如果有）
      if (loadingDelayRef.current) clearTimeout(loadingDelayRef.current);
      
      // 设置新的定时器：只有当加载时间超过阈值时才显示 loading UI
      loadingDelayRef.current = setTimeout(() => {
        loadingDelayRef.current = null;
        if (mountedRef.current) {
          // 只有当图片仍在加载中（loading 为 true）时才显示 loading UI
          setState(s => s.loading ? { ...s, showLoadingUi: true } : s);
        }
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
  }, [fileId, showThumbnail, updateState, eagerLoad, thumbnailUrl, createInitialState]);

  const getSrcSet = () => {
    if (!thumbnailUrl) return undefined;
    if (thumbnailUrl.startsWith('blob:')) return undefined; // Blob URL 不支持 srcset
    const url = new URL(thumbnailUrl);
    // 生成不同尺寸的缩略图 URL
    // w=200: 小屏幕/移动端
    // w=400: 默认尺寸 (FileGrid 默认列宽)
    // w=800: 高分屏/大屏幕
    const getUrl = (w: number) => {
      const u = new URL(url);
      u.searchParams.set('w', w.toString());
      return `${u.toString()} ${w}w`;
    };
    return `${getUrl(200)}, ${getUrl(400)}, ${getUrl(800)}`;
  };

  const renderContent = () => {
    if (effectiveState.error || !showThumbnail) {
      if (isImageType(mimeType)) return <ImageIcon className="h-8 w-8" />;
      if (isVideoType(mimeType)) return <VideoIcon className="h-8 w-8" />;
      if (isPdfType(mimeType)) return <PdfIcon className="h-8 w-8" />;
      if (isAudioType(mimeType)) return <AudioIcon className="h-8 w-8" />;
      return <FileIcon className="h-8 w-8" />;
    }

    if (effectiveState.imageUrl) {
      return (
        <>
          {effectiveState.showLoadingUi && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/10">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            </div>
          )}
          <img
            src={effectiveState.imageUrl}
            srcSet={getSrcSet()}
            sizes="(max-width: 640px) 100px, (max-width: 1024px) 200px, 400px"
            alt={filename}
            className={cn(
              'h-full w-full object-cover transition-opacity duration-300',
              effectiveState.loading ? 'opacity-0' : 'opacity-100'
            )}
            onLoad={handleImageLoad}
            onError={handleImageError}
            decoding="async"
            loading={eagerLoad ? 'eager' : 'lazy'}
            fetchPriority={eagerLoad ? 'high' : 'auto'}
          />
        </>
      );
    }

    return (
      <div className="w-full h-full animate-pulse bg-gray-600 dark:bg-gray-500" />
    );
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex items-center justify-center bg-purple-900/30 dark:bg-purple-900/40 rounded overflow-hidden shrink-0',
        className
      )}
    >
      {renderContent()}
    </div>
  );
}
