import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { fileService } from '../../services/files';
import type { FileMetadata } from '../../services/files';
import { formatFileSize } from '../../utils/format';
import { cn } from '../../utils/cn';
import { getPreviewKind, getMimeTypeLabel } from '../../utils/mimeType';

interface FilePreviewProps {
  file: FileMetadata | null;
  files?: FileMetadata[];
  currentIndex?: number;
  onClose: () => void;
  onNavigate?: (file: FileMetadata) => void;
}

export default function FilePreview({ 
  file, 
  files = [], 
  currentIndex = 0,
  onClose,
  onNavigate,
}: FilePreviewProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  
  // 请求 ID 用于处理竞态条件
  const requestIdRef = useRef(0);
  // 导航防抖 - 防止过快点击
  const lastNavTimeRef = useRef(0);
  const NAV_DEBOUNCE_MS = 150; // 150ms 防抖
  // 图片缩放/旋转容器 ref，用于设置 CSS 变量（避免内联 style 触发 lint）
  const imageTransformRef = useRef<HTMLDivElement>(null);

  // 计算是否可以导航
  const canGoPrev = files.length > 1 && currentIndex > 0;
  const canGoNext = files.length > 1 && currentIndex < files.length - 1;

  // 导航到上一个/下一个文件（带防抖）
  const goToPrev = useCallback(() => {
    const now = Date.now();
    if (now - lastNavTimeRef.current < NAV_DEBOUNCE_MS) return;
    lastNavTimeRef.current = now;
    
    if (canGoPrev && onNavigate) {
      onNavigate(files[currentIndex - 1]);
    }
  }, [canGoPrev, currentIndex, files, onNavigate]);

  const goToNext = useCallback(() => {
    const now = Date.now();
    if (now - lastNavTimeRef.current < NAV_DEBOUNCE_MS) return;
    lastNavTimeRef.current = now;
    
    if (canGoNext && onNavigate) {
      onNavigate(files[currentIndex + 1]);
    }
  }, [canGoNext, currentIndex, files, onNavigate]);

  // 使用共享工具函数获取预览类型信息
  const kind = useMemo(
    () => (file ? getPreviewKind(file.mime_type) : getPreviewKind('')),
    [file]
  );

  const [loading, setLoading] = useState(() => (file ? kind.supported : false));

  useEffect(() => {
    if (!file || !kind.supported) return;

    const currentRequestId = ++requestIdRef.current;
    const isValidRequest = () => currentRequestId === requestIdRef.current;

    const finish = () => {
      if (isValidRequest()) setLoading(false);
    };

    if (kind.isText) {
      fileService
        .fetchPreviewBlob(file.id)
        .then((b) => b.text())
        .then((text) => {
          if (!isValidRequest()) return;
          setTextContent(text);
        })
        .catch((e) => {
          if (!isValidRequest()) return;
          setError(e instanceof Error ? e.message : '加载失败');
        })
        .finally(finish);
      return;
    }

    fileService
      .fetchPreviewBlob(file.id)
      .then((b) => {
        if (!isValidRequest()) return;
        setBlobUrl(URL.createObjectURL(b));
      })
      .catch((e) => {
        if (!isValidRequest()) return;
        setError(e instanceof Error ? e.message : '加载失败');
      })
      .finally(finish);
    // 仅依赖 file?.id 与 kind，避免 file 引用变化导致重复请求
  }, [file, kind.supported, kind.isText]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  // 预加载相邻图片（仅图片类型，加载完成后预加载）
  useEffect(() => {
    if (loading || !file) return;

    const preloadImage = (fileToPreload: FileMetadata) => {
      const preloadKind = getPreviewKind(fileToPreload.mime_type);
      if (!preloadKind.isImage) return;

      fileService.fetchPreviewBlob(fileToPreload.id).then((blob) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.src = url;
        img.onload = () => URL.revokeObjectURL(url);
        img.onerror = () => URL.revokeObjectURL(url);
      }).catch(() => {});
    };

    const timer = setTimeout(() => {
      if (canGoPrev) preloadImage(files[currentIndex - 1]);
      if (canGoNext) preloadImage(files[currentIndex + 1]);
    }, 300);

    return () => clearTimeout(timer);
  }, [loading, file, currentIndex, files, canGoPrev, canGoNext]);

  // 键盘事件：ESC 关闭，左右箭头切换
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goToPrev();
      if (e.key === 'ArrowRight') goToNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, goToPrev, goToNext]);

  // 打开预览时锁定背景滚动，关闭时恢复（解决滚轮/触摸滑动时底层内容跟随滚动）
  useEffect(() => {
    if (!file) return;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [file]);

  // 文件名展示：对于特别长的文件名做“中间省略”处理（Hooks 必须在 early return 之前）
  const displayFilename = useMemo(() => {
    if (!file?.original_filename) return '';
    const full = file.original_filename;
    const MAX_LEN = 32;
    if (full.length <= MAX_LEN) return full;

    const match = full.match(/^(.*?)(\.[^.]+)?$/);
    const namePart = match?.[1] ?? full;
    const extPart = match?.[2] ?? '';

    const budget = MAX_LEN - extPart.length - 1;
    if (budget <= 0) {
      return full.slice(0, MAX_LEN - 1) + '…';
    }

    const head = namePart.slice(0, Math.ceil(budget * 0.6));
    const tail = namePart.slice(-Math.floor(budget * 0.4));
    return `${head}…${tail}${extPart}`;
  }, [file?.original_filename]);

  // 每次切换文件时重置视图状态（Hooks 必须在 early return 之前）
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset view when file id changes
    setZoom(1);
    setRotation(0);
    setImageLoaded(false);
  }, [file?.id]);

  // 将 zoom/rotation 同步到图片容器的 transform 样式
  useEffect(() => {
    const el = imageTransformRef.current;
    if (!el) return;
    el.style.transform = `scale(${zoom}) rotate(${rotation}deg)`;
  }, [zoom, rotation]);

  if (!file) return null;

  const { isImage, isPDF, isText, isVideo, isAudio, supported } = kind;

  const handleDownload = async () => {
    try {
      await fileService.downloadFile(file.id, file.original_filename);
    } catch {
      // 静默处理
    }
  };

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  // 始终按顺时针方向累加旋转角度（不取模），保证视觉上每次都是继续顺时针
  const handleRotate = () => setRotation((r) => r + 90);
  const handleResetView = () => {
    setZoom(1);
    setRotation(0);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-title"
    >
      {/* 背景层：仅点击背景时关闭，控制区/主内容区点击不关闭 */}
      <div
        className="absolute inset-0 z-0 bg-gray-950/90 backdrop-blur-xl"
        onClick={onClose}
        aria-hidden
      />
      
      {/* 装饰性渐变光晕 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-1/4 -top-1/4 h-1/2 w-1/2 rounded-full bg-purple-600/20 blur-3xl" />
        <div className="absolute -bottom-1/4 -right-1/4 h-1/2 w-1/2 rounded-full bg-blue-600/15 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-1/3 w-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      {/* 网格纹理 */}
      <div className="preview-grid-pattern pointer-events-none absolute inset-0" />

      {/* 左右导航按钮容器（尺寸相关全部基于视口，无固定 px/rem） */}
      {files.length > 1 && (
        <>
          {/* 左侧导航按钮（玻璃拟态圆钮） */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToPrev();
            }}
            disabled={!canGoPrev}
            className={cn(
              'absolute z-20 top-1/2 -translate-y-1/2',
              'flex items-center justify-center rounded-full',
              'left-[clamp(0.5rem,2vw,1rem)] w-[clamp(2rem,5vw,3rem)] h-[clamp(2rem,5vw,3rem)]',
              'border-[clamp(1px,0.2vw,2px)] border-solid border-[rgba(255,255,255,0.25)]',
              'shadow-[0_clamp(0.25rem,1vw,0.75rem)_clamp(0.5rem,2.5vw,1.5rem)_rgba(15,23,42,0.75)]',
              'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
              'backdrop-blur-xl text-white/80 transition-all duration-200',
              canGoPrev
                ? 'hover:from-white/20 hover:via-white/10 hover:text-white hover:scale-105 hover:border-white/40 cursor-pointer'
                : 'opacity-30 cursor-not-allowed'
            )}
            aria-label="上一个文件"
          >
            <svg
              className="shrink-0 w-[clamp(1rem,2.5vw,1.5rem)] h-[clamp(1rem,2.5vw,1.5rem)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="clamp(1.5, 0.4vw, 2.5)"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

        </>
      )}

      {/* 顶部工具栏（仅显示文件计数器，玻璃拟态胶囊） */}
      <div
        className="relative z-10 flex shrink-0 items-center justify-between bg-gradient-to-b from-black/70 via-black/40 to-transparent px-4 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3" />
        <div className="flex items-center gap-2" />

        {/* 文件计数器：居中悬浮的小胶囊（尺寸基于视口） */}
        {files.length > 1 && (
          <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2">
            <div
              className={cn(
                'inline-flex items-center rounded-full bg-white/10 backdrop-blur-xl border-solid',
                'gap-[clamp(0.25rem,0.8vw,0.5rem)]',
                'pl-[clamp(0.5rem,1.2vw,0.75rem)] pr-[clamp(0.5rem,1.2vw,0.75rem)]',
                'pt-[clamp(0.2rem,0.5vw,0.25rem)] pb-[clamp(0.2rem,0.5vw,0.25rem)]',
                'border-[clamp(1px,0.15vw,2px)] border-[rgba(255,255,255,0.2)]',
                'text-[clamp(0.6rem,1.2vw,0.7rem)]',
                'shadow-[0_clamp(0.25rem,0.8vw,0.6rem)_clamp(0.5rem,1.5vw,1rem)_rgba(15,23,42,0.85)]'
              )}
            >
              <span className="text-white/80">{currentIndex + 1} / {files.length}</span>
            </div>
          </div>
        )}
      </div>

      {/* 右侧控制区：「下一个」与左侧「上一个」同一定位（top-1/2 -translate-y-1/2）保证同一水平线；控制面板在其上 */}
      {files.length > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
          disabled={!canGoNext}
          className={cn(
            'absolute z-[100] top-1/2 -translate-y-1/2 right-[clamp(0.5rem,2vw,1rem)]',
            'flex items-center justify-center rounded-full',
            'w-[clamp(2rem,5vw,3rem)] h-[clamp(2rem,5vw,3rem)]',
            'border-[clamp(1px,0.2vw,2px)] border-solid border-[rgba(255,255,255,0.25)]',
            'shadow-[0_clamp(0.25rem,1vw,0.75rem)_clamp(0.5rem,2.5vw,1.5rem)_rgba(15,23,42,0.75)]',
            'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
            'backdrop-blur-xl text-white/80 transition-all duration-200',
            canGoNext
              ? 'hover:from-white/20 hover:via-white/10 hover:text-white hover:scale-105 hover:border-white/40 cursor-pointer'
              : 'opacity-30 cursor-not-allowed'
          )}
          aria-label="下一个文件"
        >
          <svg
            className="shrink-0 w-[clamp(1rem,2.5vw,1.5rem)] h-[clamp(1rem,2.5vw,1.5rem)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="clamp(1.5, 0.4vw, 2.5)"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
      <div
        className={cn(
          'absolute z-[100] right-[clamp(0.5rem,2vw,1rem)] flex flex-col items-center pointer-events-auto',
          files.length > 1 ? 'bottom-[calc(50%+4rem)]' : 'bottom-[clamp(0.8rem,2.5vw,1.25rem)]'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 控制面板（关闭、下载、放大缩小旋转、Reset），多文件时在「下一个」上方 */}
        <div
          className={cn(
            'flex flex-col items-center rounded-2xl bg-white/10 backdrop-blur-xl border-solid pointer-events-auto',
            'w-[clamp(2.5rem,6vw,3rem)] gap-[clamp(0.25rem,0.8vw,0.5rem)] p-[clamp(0.35rem,1vw,0.75rem)]',
            'border-[clamp(1px,0.15vw,2px)] border-[rgba(255,255,255,0.2)]',
            'shadow-[0_clamp(0.35rem,1vw,0.75rem)_clamp(0.6rem,2vw,1.25rem)_rgba(15,23,42,0.85)]'
          )}
        >
          {/* 关闭按钮 */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="flex items-center justify-center rounded-full bg-black/40 text-white/85 transition-colors hover:bg-black/70 w-[clamp(2rem,5vw,2.5rem)] h-[clamp(2rem,5vw,2.5rem)]"
            aria-label="关闭"
          >
            <span className="flex shrink-0 items-center justify-center w-[clamp(1rem,2.5vw,1.25rem)] h-[clamp(1rem,2.5vw,1.25rem)]">
              <CloseIcon />
            </span>
          </button>

          {/* 下载按钮 */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleDownload(); }}
            className="flex items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/30 w-[clamp(2rem,5vw,2.5rem)] h-[clamp(2rem,5vw,2.5rem)]"
            aria-label="下载"
          >
            <span className="flex shrink-0 items-center justify-center w-[clamp(1rem,2.5vw,1.25rem)] h-[clamp(1rem,2.5vw,1.25rem)]">
              <DownloadIcon />
            </span>
          </button>

          {/* 图片专用视图控制 */}
          {isImage && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}
                className="flex items-center justify-center rounded-full font-semibold text-white/85 hover:bg-white/10 w-[clamp(2rem,5vw,2.5rem)] h-[clamp(2rem,5vw,2.5rem)] text-[clamp(0.85rem,2vw,1.125rem)]"
                aria-label="放大"
              >
                +
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}
                className="flex items-center justify-center rounded-full font-semibold text-white/85 hover:bg-white/10 w-[clamp(2rem,5vw,2.5rem)] h-[clamp(2rem,5vw,2.5rem)] text-[clamp(0.85rem,2vw,1.125rem)]"
                aria-label="缩小"
              >
                −
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleRotate(); }}
                className="flex items-center justify-center rounded-full font-semibold text-white/85 hover:bg-white/10 w-[clamp(2rem,5vw,2.5rem)] h-[clamp(2rem,5vw,2.5rem)] text-[clamp(0.85rem,2vw,1.125rem)]"
                aria-label="旋转 90 度"
              >
                ⤾
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleResetView(); }}
                className="rounded-full font-semibold text-white/80 hover:bg-white/10 mt-[clamp(0.15rem,0.4vw,0.25rem)] px-[clamp(0.35rem,0.8vw,0.5rem)] py-[clamp(0.1rem,0.3vw,0.15rem)] text-[clamp(0.5rem,1.2vw,0.625rem)]"
              >
                Reset
              </button>
            </>
          )}
        </div>
      </div>

      {/* 主内容区：点击本层或冒泡上来的点击即关闭；子内容（图片/PDF/加载态等）已 stopPropagation，控制区为兄弟节点不冒泡到此 */}
      <div
        className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-16 py-2"
        onClick={onClose}
      >
        {/* 加载状态 */}
        {loading && (
          <div className="flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="h-12 w-12 animate-spin rounded-full border-3 border-white/20 border-t-purple-500" />
            <span className="text-sm text-white/60">加载中…</span>
          </div>
        )}

        {/* 错误状态 */}
        {error && !loading && (
          <div
            className="flex flex-col items-center gap-4 rounded-2xl bg-white/5 px-8 py-10 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
              <ErrorIcon />
            </div>
            <p className="text-lg text-white">{error}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 rounded-full bg-white/10 px-6 py-2.5 text-sm text-white transition-colors hover:bg-white/20"
            >
              关闭
            </button>
          </div>
        )}

        {/* 统一预览容器 - 固定尺寸确保一致性 */}
        {!loading && !error && supported && (
          <div
            className="flex h-[calc(100vh-180px)] w-full max-w-5xl items-center justify-center"
          >
            {/* 图片预览 */}
            {isImage && blobUrl && (
              <div className="relative flex h-full w-full items-center justify-center pointer-events-none">
                <div
                  ref={imageTransformRef}
                  className={cn(
                    'pointer-events-auto relative overflow-hidden rounded-lg origin-center transition-transform duration-500 ease-out',
                    imageLoaded ? 'opacity-100' : 'opacity-0'
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <img
                    src={blobUrl}
                    alt={file.original_filename}
                    className="max-h-[calc(100vh-200px)] max-w-full object-contain"
                    onLoad={() => setImageLoaded(true)}
                  />
                </div>
                {!imageLoaded && (
                  <div className="absolute flex items-center justify-center">
                    <div className="h-10 w-10 animate-spin rounded-full border-3 border-white/20 border-t-purple-500" />
                  </div>
                )}
              </div>
            )}

            {/* PDF 预览 */}
            {isPDF && blobUrl && (
              <div className="flex h-full w-full items-center justify-center pointer-events-none">
                <div
                  className="pointer-events-auto h-[min(70vh,42rem)] w-[min(92vw,64rem)] overflow-hidden rounded-lg"
                  onClick={(e) => e.stopPropagation()}
                >
                  <iframe
                    src={blobUrl}
                    title={file.original_filename}
                    className="h-full w-full border-0 bg-white"
                  />
                </div>
              </div>
            )}

            {/* 视频预览 */}
            {isVideo && blobUrl && (
              <div className="flex h-full w-full items-center justify-center pointer-events-none">
                <video
                  src={blobUrl}
                  controls
                  autoPlay
                  className="pointer-events-auto max-h-full max-w-full rounded-lg shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <track kind="captions" />
                  您的浏览器不支持视频播放
                </video>
              </div>
            )}

            {/* 音频预览 */}
            {isAudio && blobUrl && (
              <div className="flex h-full w-full flex-col items-center justify-center pointer-events-none">
                <div
                  className="pointer-events-auto flex flex-col items-center gap-6 rounded-2xl bg-white/5 px-12 py-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-purple-500/20">
                    <AudioIcon />
                  </div>
                  <audio
                    src={blobUrl}
                    controls
                    autoPlay
                    className="w-80"
                  >
                    您的浏览器不支持音频播放
                  </audio>
                </div>
              </div>
            )}

            {/* 文本预览 */}
            {isText && textContent !== null && (
              <div className="flex h-full w-full items-center justify-center pointer-events-none">
                <div
                  className="pointer-events-auto h-[min(70vh,42rem)] w-[min(92vw,60rem)] overflow-hidden rounded-xl bg-gray-900/80 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
                    <span className="text-xs text-white/40">{file.mime_type}</span>
                    <span className="text-xs text-white/40">{textContent.split('\n').length} 行</span>
                  </div>
                  <pre className="h-[calc(100%-40px)] overflow-auto p-4 text-sm leading-relaxed text-gray-200 whitespace-pre-wrap font-mono">
                    {textContent}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 不支持的文件类型 */}
        {!loading && !error && !supported && (
          <div
            className="flex h-[calc(100vh-180px)] w-full max-w-5xl items-center justify-center"
          >
            <div
              className="flex flex-col items-center gap-4 rounded-2xl bg-white/5 px-8 py-10 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-purple-500/20">
                <FileIcon />
              </div>
              <p className="text-lg text-white">无法预览此文件类型</p>
              <p className="text-sm text-white/50">{file.mime_type}</p>
              <button
                type="button"
                onClick={handleDownload}
                className="mt-2 flex items-center gap-2 rounded-full bg-purple-600 px-6 py-2.5 text-sm text-white transition-colors hover:bg-purple-500"
              >
                <DownloadIcon />
                下载文件
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 底部文件信息（尺寸基于视口） */}
      <div
        className="relative z-10 shrink-0 bg-gradient-to-t from-black/70 to-transparent px-[clamp(0.8rem,2vw,1rem)] pt-[clamp(0.8rem,2vw,1rem)] pb-[clamp(1rem,2.5vw,1.5rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto max-w-3xl">
          <div
            className={cn(
              'mx-auto max-w-2xl rounded-xl bg-white/5 text-center backdrop-blur-sm border-solid',
              'p-[clamp(0.5rem,1.2vw,0.75rem)]',
              'border-[clamp(1px,0.15vw,2px)] border-[rgba(255,255,255,0.1)]',
              'shadow-[0_clamp(0.2rem,0.6vw,0.4rem)_clamp(0.4rem,1.2vw,0.8rem)_rgba(0,0,0,0.2)]'
            )}
          >
            <h2
              id="preview-title"
              className="truncate font-medium text-white text-[clamp(0.8rem,1.8vw,1rem)]"
              title={file.original_filename}
            >
              {displayFilename}
            </h2>
            <p
              className="text-white/55 mt-[clamp(0.2rem,0.5vw,0.25rem)] text-[clamp(0.65rem,1.4vw,0.75rem)]"
            >
              {formatFileSize(file.file_size)} · {getMimeTypeLabel(file.mime_type)} · {formatDate(file.created_at)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// 关闭图标（父级设宽高时用 h-full w-full 随父级缩放）
function CloseIcon() {
  return (
    <svg className="h-full w-full shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="clamp(1.5, 0.4vw, 2.5)">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// 下载图标
function DownloadIcon() {
  return (
    <svg className="h-full w-full shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="clamp(1.5, 0.4vw, 2.5)">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}

// 错误图标
function ErrorIcon() {
  return (
    <svg className="h-8 w-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

// 文件图标
function FileIcon() {
  return (
    <svg className="h-10 w-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

// 音频图标
function AudioIcon() {
  return (
    <svg className="h-12 w-12 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
      />
    </svg>
  );
}
