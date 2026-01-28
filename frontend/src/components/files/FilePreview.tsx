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
  
  // 请求 ID 用于处理竞态条件
  const requestIdRef = useRef(0);
  // 导航防抖 - 防止过快点击
  const lastNavTimeRef = useRef(0);
  const NAV_DEBOUNCE_MS = 150; // 150ms 防抖

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

  // 文件变化时重置状态
  useEffect(() => {
    setBlobUrl(null);
    setTextContent(null);
    setError(null);
    setImageLoaded(false);
    if (file && kind.supported) {
      setLoading(true);
    }
  }, [file?.id, kind.supported]);

  useEffect(() => {
    if (!file || !kind.supported) return;
    
    // 递增请求 ID，用于处理竞态条件
    const currentRequestId = ++requestIdRef.current;
    
    // 检查当前请求是否仍然有效
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

    // image / pdf / video / audio
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
  }, [file?.id, kind.supported, kind.isText]);

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
      
      // 使用 Image 对象预加载（浏览器会缓存）
      fileService.fetchPreviewBlob(fileToPreload.id).then((blob) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.src = url;
        img.onload = () => URL.revokeObjectURL(url);
        img.onerror = () => URL.revokeObjectURL(url);
      }).catch(() => {
        // 预加载失败静默忽略
      });
    };

    // 延迟预加载，避免影响当前文件加载
    const timer = setTimeout(() => {
      if (canGoPrev) preloadImage(files[currentIndex - 1]);
      if (canGoNext) preloadImage(files[currentIndex + 1]);
    }, 300);

    return () => clearTimeout(timer);
  }, [loading, file?.id, currentIndex, files, canGoPrev, canGoNext]);

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

  if (!file) return null;

  const { isImage, isPDF, isText, isVideo, isAudio, supported } = kind;

  const handleDownload = async () => {
    try {
      await fileService.downloadFile(file.id, file.original_filename);
    } catch {
      // 静默处理
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-title"
    >
      {/* 背景层 */}
      <div className="absolute inset-0 bg-gray-950/90 backdrop-blur-xl" />
      
      {/* 装饰性渐变光晕 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-1/4 -top-1/4 h-1/2 w-1/2 rounded-full bg-purple-600/20 blur-3xl" />
        <div className="absolute -bottom-1/4 -right-1/4 h-1/2 w-1/2 rounded-full bg-blue-600/15 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-1/3 w-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      {/* 网格纹理 */}
      <div className="preview-grid-pattern pointer-events-none absolute inset-0" />

      {/* 左侧导航按钮 */}
      {files.length > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goToPrev();
          }}
          disabled={!canGoPrev}
          className={cn(
            'absolute left-4 top-1/2 z-20 -translate-y-1/2',
            'flex h-12 w-12 items-center justify-center rounded-full',
            'bg-black/30 backdrop-blur-md',
            'border border-white/10',
            'text-white/70 transition-all duration-200',
            canGoPrev 
              ? 'hover:bg-black/50 hover:text-white hover:scale-110 hover:border-white/20 cursor-pointer' 
              : 'opacity-30 cursor-not-allowed'
          )}
          aria-label="上一个文件"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* 右侧导航按钮 */}
      {files.length > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
          disabled={!canGoNext}
          className={cn(
            'absolute right-4 top-1/2 z-20 -translate-y-1/2',
            'flex h-12 w-12 items-center justify-center rounded-full',
            'bg-black/30 backdrop-blur-md',
            'border border-white/10',
            'text-white/70 transition-all duration-200',
            canGoNext 
              ? 'hover:bg-black/50 hover:text-white hover:scale-110 hover:border-white/20 cursor-pointer' 
              : 'opacity-30 cursor-not-allowed'
          )}
          aria-label="下一个文件"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* 顶部工具栏 */}
      <div
        className="relative z-10 flex shrink-0 items-center justify-between bg-gradient-to-b from-black/60 to-transparent px-4 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="关闭"
          >
            <CloseIcon />
          </button>
          {/* 文件计数器 */}
          {files.length > 1 && (
            <span className="text-sm text-white/50">
              {currentIndex + 1} / {files.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            className="flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-sm text-white transition-colors hover:bg-white/20"
          >
            <DownloadIcon />
            <span className="hidden sm:inline">下载</span>
          </button>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-16 py-2">
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
                <div className={cn(
                  'pointer-events-auto relative overflow-hidden rounded-lg transition-opacity duration-300',
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

      {/* 底部文件信息 */}
      <div
        className="relative z-10 shrink-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="preview-title"
            className="truncate text-base font-medium text-white sm:text-lg"
            title={file.original_filename}
          >
            {file.original_filename}
          </h2>
          <div className="file-meta-14px mt-1 flex items-center justify-center gap-3 text-white/50">
            <span>{formatFileSize(file.file_size)}</span>
            <span className="h-1 w-1 rounded-full bg-white/30" />
            <span>{getMimeTypeLabel(file.mime_type)}</span>
            <span className="h-1 w-1 rounded-full bg-white/30" />
            <span>{formatDate(file.created_at)}</span>
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

// 关闭图标
function CloseIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
