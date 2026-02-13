/**
 * FilePreview
 * 文件预览弹窗：支持图片、视频、音频、PDF、文本
 * 多文件时可左右切换，图片支持缩放、旋转
 */

// =============================================================================
// 依赖
// =============================================================================

import { useMemo, useState, useEffect, useRef } from 'react';
import { fileService } from '../../../services/files';
import { formatFileSize } from '../../../utils/format';
import { cn } from '../../../utils/cn';
import { getPreviewKind, getMimeTypeLabel } from '../../../utils/mimeType';
import type { FileMetadata } from '../../../types/files';

import { useFilePreviewData } from './hooks/useFilePreviewData';
import { useFilePreviewNavigation } from './hooks/useFilePreviewNavigation';
import { useFilePreviewEffects } from './hooks/useFilePreviewEffects';
import { FilePreviewContent } from './FilePreviewContent.tsx';
import { FilePreviewToolbar } from './FilePreviewToolbar.tsx';
import { truncateFilename, formatPreviewDate } from './utils';

// =============================================================================
// 类型
// =============================================================================

export interface FilePreviewProps {
  /** 当前预览的文件，null 时渲染 null */
  file: FileMetadata | null;
  /** 同目录文件列表，用于上一页/下一页 */
  files?: FileMetadata[];
  /** 当前文件在列表中的索引 */
  currentIndex?: number;
  /** 关闭回调 */
  onClose: () => void;
  /** 切换文件回调（上一页/下一页时传入新文件） */
  onNavigate?: (file: FileMetadata) => void;
}

// =============================================================================
// 主组件
// =============================================================================

export default function FilePreview({
  file,
  files = [],
  currentIndex = 0,
  onClose,
  onNavigate,
}: FilePreviewProps) {
  // -------------------------------------------------------------------------
  // 预览类型
  // -------------------------------------------------------------------------
  const kind = useMemo(
    () =>
      file
        ? getPreviewKind(file.mime_type, file.original_filename)
        : getPreviewKind(''),
    [file]
  );

  const { isImage, isPDF, isText, isMarkdown, isVideo, isAudio, supported } = kind;

  // -------------------------------------------------------------------------
  // 数据加载（Blob/文本/GIF 流式首帧等）
  // -------------------------------------------------------------------------
  const {
    blobUrl,
    gifFirstFrameUrl,
    textContent,
    error,
    loading,
    gifTranscodeInProgress,
    gifTranscodeProgress,
    useHls,
    imageLoaded,
    setImageLoaded,
    videoRef,
    tryVideoAudioFallback,
    tryVideoAudioFallbackRef,
    onImageError,
  } = useFilePreviewData({ file, kind });

  // -------------------------------------------------------------------------
  // 导航（上一页/下一页）
  // -------------------------------------------------------------------------
  const { canGoPrev, canGoNext, goToPrev, goToNext } = useFilePreviewNavigation({
    files,
    currentIndex,
    onNavigate,
  });

  // -------------------------------------------------------------------------
  // 图片视图状态（缩放、旋转）
  // -------------------------------------------------------------------------
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isLooping, setIsLooping] = useState(true);
  const imageTransformRef = useRef<HTMLDivElement>(null);

  // -------------------------------------------------------------------------
  // Side Effects：HLS、键盘、滚动锁定、预加载
  // -------------------------------------------------------------------------
  useFilePreviewEffects({
    kind,
    useHls,
    blobUrl,
    loading,
    file,
    files,
    currentIndex,
    canGoPrev,
    canGoNext,
    videoRef,
    tryVideoAudioFallbackRef,
    onClose,
    goToPrev,
    goToNext,
  });

  // -------------------------------------------------------------------------
  // 文件切换时重置视图状态
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // 将 zoom/rotation 同步到图片容器的 transform
  // -------------------------------------------------------------------------
  useEffect(() => {
    const el = imageTransformRef.current;
    if (!el) return;
    el.style.transform = `scale(${zoom}) rotate(${rotation}deg)`;
  }, [zoom, rotation]);

  // -------------------------------------------------------------------------
  // 文件名展示（中间省略）
  // -------------------------------------------------------------------------
  const displayFilename = useMemo(
    () => (file?.original_filename ? truncateFilename(file.original_filename) : ''),
    [file]
  );

  // -------------------------------------------------------------------------
  // 图片控制回调
  // -------------------------------------------------------------------------
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleRotate = () => setRotation((r) => r + 90);
  const handleResetView = () => {
    setZoom(1);
    setRotation(0);
  };
  const handleDownload = async () => {
    if (!file) return;
    try {
      await fileService.downloadFile(file.id, file.original_filename);
    } catch {
      /* 静默 */
    }
  };

  const handleToggleLoop = () => {
    setIsLooping((prev) => !prev);
  };

  // -------------------------------------------------------------------------
  // 无文件时返回 null
  // -------------------------------------------------------------------------
  if (!file) return null;

  // -------------------------------------------------------------------------
  // 渲染
  // -------------------------------------------------------------------------
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-title"
    >
      {/* ---- 背景层（点击关闭） ---- */}
      <div
        className="absolute inset-0 z-0 bg-gray-950/90 backdrop-blur-xl"
        onClick={onClose}
        aria-hidden
      />

      {/* ---- 装饰渐变 ---- */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-1/4 -top-1/4 h-1/2 w-1/2 rounded-full bg-purple-600/20 blur-3xl" />
        <div className="absolute -bottom-1/4 -right-1/4 h-1/2 w-1/2 rounded-full bg-blue-600/15 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-1/3 w-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      {/* ---- 网格纹理 ---- */}
      <div className="preview-grid-pattern pointer-events-none absolute inset-0" />

      {/* ---- 左侧导航按钮 ---- */}
      {files.length > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goToPrev();
          }}
          disabled={!canGoPrev}
          className={cn(
            'absolute z-20 top-1/2 -translate-y-1/2 left-[clamp(0.5rem,2vw,1rem)]',
            'flex items-center justify-center rounded-full w-[clamp(2rem,5vw,3rem)] h-[clamp(2rem,5vw,3rem)]',
            'border-[clamp(1px,0.2vw,2px)] border-solid border-[rgba(255,255,255,0.25)]',
            'shadow-[0_clamp(0.25rem,1vw,0.75rem)_clamp(0.5rem,2.5vw,1.5rem)_rgba(15,23,42,0.75)]',
            'bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl text-white/80 transition-all duration-200',
            canGoPrev ? 'hover:from-white/20 hover:via-white/10 hover:text-white hover:scale-105 hover:border-white/40 cursor-pointer' : 'opacity-30 cursor-not-allowed'
          )}
          aria-label="上一个文件"
        >
          <svg className="shrink-0 w-[clamp(1rem,2.5vw,1.5rem)] h-[clamp(1rem,2.5vw,1.5rem)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="clamp(1.5, 0.4vw, 2.5)">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* ---- 顶部工具栏（文件计数器） ---- */}
      <div
        className="relative z-20 flex shrink-0 items-center justify-between bg-gradient-to-b from-black/70 via-black/40 to-transparent px-4 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3" />
        <div className="flex items-center gap-2" />
        {file.mime_type.toLowerCase() === 'image/gif' && gifTranscodeInProgress && (
          <div className="pointer-events-none absolute left-1/2 top-[3.1rem] -translate-x-1/2">
            <div className="inline-flex flex-col items-center rounded-full bg-black/40 px-4 py-2 text-[11px] text-white/80 backdrop-blur-md shadow-lg border border-white/15">
              <span className="mb-1">
                正在为 GIF 生成视频预览，大文件可能需要几十秒…
              </span>
              {typeof gifTranscodeProgress === 'number' && (
                <div className="relative h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-purple-400 via-pink-400 to-sky-400 transition-all duration-300"
                    style={{ width: `${Math.min(Math.max(gifTranscodeProgress, 5), 100)}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
        {files.length > 1 && (
          <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2">
            <div
              className={cn(
                'inline-flex items-center rounded-full bg-white/10 backdrop-blur-xl border-solid',
                'gap-[clamp(0.25rem,0.8vw,0.5rem)] pl-[clamp(0.5rem,1.2vw,0.75rem)] pr-[clamp(0.5rem,1.2vw,0.75rem)]',
                'pt-[clamp(0.2rem,0.5vw,0.25rem)] pb-[clamp(0.2rem,0.5vw,0.25rem)]',
                'border-[clamp(1px,0.15vw,2px)] border-[rgba(255,255,255,0.2)] text-[clamp(0.6rem,1.2vw,0.7rem)]',
                'shadow-[0_clamp(0.25rem,0.8vw,0.6rem)_clamp(0.5rem,1.5vw,1rem)_rgba(15,23,42,0.85)]'
              )}
            >
              <span className="text-white/80">{currentIndex + 1} / {files.length}</span>
            </div>
          </div>
        )}
      </div>

      {/* ---- 右侧导航按钮 ---- */}
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
            'flex items-center justify-center rounded-full w-[clamp(2rem,5vw,3rem)] h-[clamp(2rem,5vw,3rem)]',
            'border-[clamp(1px,0.2vw,2px)] border-solid border-[rgba(255,255,255,0.25)]',
            'shadow-[0_clamp(0.25rem,1vw,0.75rem)_clamp(0.5rem,2.5vw,1.5rem)_rgba(15,23,42,0.75)]',
            'bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl text-white/80 transition-all duration-200',
            canGoNext ? 'hover:from-white/20 hover:via-white/10 hover:text-white hover:scale-105 hover:border-white/40 cursor-pointer' : 'opacity-30 cursor-not-allowed'
          )}
          aria-label="下一个文件"
        >
          <svg className="shrink-0 w-[clamp(1rem,2.5vw,1.5rem)] h-[clamp(1rem,2.5vw,1.5rem)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="clamp(1.5, 0.4vw, 2.5)">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* ---- 右侧控制面板 ---- */}
      <FilePreviewToolbar
        isImage={isImage}
        isVideo={isVideo}
        filesLength={files.length}
        onClose={onClose}
        onDownload={handleDownload}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onRotate={handleRotate}
        onResetView={handleResetView}
        onToggleLoop={handleToggleLoop}
        isLooping={isLooping}
      />

      {/* ---- 主内容区 ---- */}
      <FilePreviewContent
        file={file}
        loading={loading}
        error={error}
        supported={supported}
        isImage={isImage}
        isPDF={isPDF}
        isVideo={isVideo}
        isAudio={isAudio}
        isText={isText}
        isMarkdown={isMarkdown}
        blobUrl={blobUrl}
        gifFirstFrameUrl={gifFirstFrameUrl}
        textContent={textContent}
        useHls={useHls}
        imageLoaded={imageLoaded}
        imageTransformRef={imageTransformRef}
        videoRef={videoRef}
        loop={isLooping}
        setImageLoaded={setImageLoaded}
        tryVideoAudioFallback={tryVideoAudioFallback}
        onImageError={onImageError}
        onClose={onClose}
        formatDate={formatPreviewDate}
      />

      {/* ---- 底部文件信息 ---- */}
      <div
        className="relative z-20 shrink-0 bg-gradient-to-t from-black/70 to-transparent px-[clamp(0.8rem,2vw,1rem)] py-[clamp(0.9rem,2.25vw,1.25rem)]"
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
            <h2 id="preview-title" className="truncate font-medium text-white text-[clamp(0.8rem,1.8vw,1rem)]" title={file.original_filename}>
              {displayFilename}
            </h2>
            <p className="text-white/55 mt-[clamp(0.2rem,0.5vw,0.25rem)] text-[clamp(0.65rem,1.4vw,0.75rem)]">
              {formatFileSize(file.file_size)} · {getMimeTypeLabel(file.mime_type, file.original_filename)} · {formatPreviewDate(file.created_at)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
