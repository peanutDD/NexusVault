/**
 * FilePreview
 * 文件预览弹窗：支持图片、视频、音频、PDF、文本
 * 多文件时可左右切换，图片支持缩放/旋转，视频支持旋转
 */

// =============================================================================
// 依赖
// =============================================================================

import { useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { fileService } from "../../../services/files";
import { formatFileSize } from "../../../utils/format";
import { cn } from "../../../utils/cn";
import { getPreviewKind, getMimeTypeLabel } from "../../../utils/mimeType";
import type { FileMetadata } from "../../../types/files";

import { useFilePreviewData } from "./hooks/useFilePreviewData";
import { useFilePreviewNavigation } from "./hooks/useFilePreviewNavigation";
import { useFilePreviewEffects } from "./hooks/useFilePreviewEffects";
import { useImagePan } from "./hooks/useImagePan";
import { FilePreviewContent } from "./FilePreviewContent";
import { FilePreviewToolbar } from "./FilePreviewToolbar";
import { truncateFilename, formatPreviewDate } from "./utils";

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
        : getPreviewKind(""),
    [file],
  );

  // 移动端 PDF 由 PdfPreview 内部使用 PDF.js Canvas 渲染，此处不再禁用
  const previewKind = kind;

  const { isImage, isPDF, isText, isMarkdown, isVideo, isAudio, supported } =
    previewKind;

  // -------------------------------------------------------------------------
  // 数据加载（Blob/文本/GIF 流式首帧等）
  // -------------------------------------------------------------------------
  const {
    blobUrl,
    gifFirstFrameUrl,
    textContent,
    error,
    loading,
    useHls,
    imageLoaded,
    setImageLoaded,
    videoRef,
    hlsStartTimeRef,
    hlsStartPausedRef,
    hlsStartVolumeRef,
    hlsStartMutedRef,
    tryVideoAudioFallback,
    tryVideoAudioFallbackRef,
    onImageError,
  } = useFilePreviewData({ file, kind: previewKind });

  // -------------------------------------------------------------------------
  // 导航（上一页/下一页）
  // -------------------------------------------------------------------------
  const { canGoPrev, canGoNext, goToPrev, goToNext } = useFilePreviewNavigation(
    {
      files,
      currentIndex,
      onNavigate,
    },
  );

  // -------------------------------------------------------------------------
  // 图片视图状态（缩放、旋转）
  // -------------------------------------------------------------------------
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isLooping, setIsLooping] = useState(true);
  const previewRootRef = useRef<HTMLDivElement>(null);
  const {
    pan,
    isDragging: isDraggingImage,
    resetPan,
    onPointerDown: onImagePointerDown,
    onPointerMove: onImagePointerMove,
    onPointerUp: onImagePointerUp,
    onPointerCancel: onImagePointerCancel,
  } = useImagePan({ zoom, resetKey: file?.id });

  // -------------------------------------------------------------------------
  // Side Effects：HLS、键盘、滚动锁定、预加载
  // -------------------------------------------------------------------------
  useFilePreviewEffects({
    kind: previewKind,
    useHls,
    blobUrl,
    loading,
    file,
    files,
    currentIndex,
    canGoPrev,
    canGoNext,
    videoRef,
    hlsStartTimeRef,
    hlsStartPausedRef,
    hlsStartVolumeRef,
    hlsStartMutedRef,
    tryVideoAudioFallbackRef,
    onClose,
    goToPrev,
    goToNext,
  });

  // -------------------------------------------------------------------------
  // 文件名展示（中间省略）
  // -------------------------------------------------------------------------
  const displayFilename = useMemo(
    () =>
      file?.original_filename ? truncateFilename(file.original_filename) : "",
    [file],
  );
  const showCounterStrip = files.length > 1;

  // -------------------------------------------------------------------------
  // 图片控制回调
  // -------------------------------------------------------------------------
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleRotate = () => setRotation((r) => r + 90);
  const handleResetView = () => {
    setZoom(1);
    setRotation(0);
    resetPan();
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
  const previewDialog = (
    <div
      ref={previewRootRef}
      className="previewDialog preview-root fixed inset-0 z-[70] flex flex-col overflow-hidden text-[var(--preview-text-primary)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-title"
      data-oid="i.zkwzs"
    >
      {/* ---- 背景层（点击关闭） ---- */}
      <div
        className="neu-flat absolute inset-0 z-0"
        onClick={onClose}
        aria-hidden
        data-oid="fj47v.w"
      />

      {/* ---- 顶部工具栏（文件计数器） ---- */}
      {showCounterStrip && (
        <div
          className="neu-flat previewCounterStrip relative z-20 flex shrink-0 items-center justify-between px-[clamp(0.78rem,1.8vw,1rem)] pb-[clamp(0.585rem,1.35vw,0.75rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)]"
          onClick={(e) => e.stopPropagation()}
          data-testid="preview-counter-strip"
          data-oid="0_8_xes"
        >
          <div
            className="flex items-center gap-[clamp(0.585rem,1.35vw,0.75rem)]"
            data-oid="omtvpu3"
          />
          <div
            className="flex items-center gap-[clamp(0.39rem,0.9vw,0.5rem)]"
            data-oid="sj8woog"
          />
          <div
            className="pointer-events-none absolute left-1/2 top-[clamp(0.585rem,1.35vw,0.75rem)] -translate-x-1/2"
            data-oid="ptnb6vs"
          >
            <div
              className={cn(
                "neu-raised-sm inline-flex items-center rounded-full",
                "gap-[clamp(0.25rem,0.8vw,0.5rem)] pl-[clamp(0.5rem,1.2vw,0.75rem)] pr-[clamp(0.5rem,1.2vw,0.75rem)]",
                "pt-[clamp(0.2rem,0.5vw,0.25rem)] pb-[clamp(0.2rem,0.5vw,0.25rem)]",
                "text-[clamp(0.6rem,1.2vw,0.7rem)]",
              )}
              data-oid="2ug-018"
            >
              <span
                className="text-[var(--preview-text-primary)]"
                data-oid="ks8479d"
              >
                {currentIndex + 1} / {files.length}
              </span>
            </div>
          </div>
        </div>
      )}

      <div
        className="neu-flat previewStageControlPlane relative z-10 flex min-h-0 w-full min-w-0 flex-1"
        data-testid="preview-stage-control-plane"
      >
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
          videoRef={videoRef}
          loop={isLooping}
          setImageLoaded={setImageLoaded}
          tryVideoAudioFallback={tryVideoAudioFallback}
          onImageError={onImageError}
          onClose={onClose}
          formatDate={formatPreviewDate}
          zoom={zoom}
          rotation={rotation}
          pan={pan}
          isDraggingImage={isDraggingImage}
          onImagePointerDown={onImagePointerDown}
          onImagePointerMove={onImagePointerMove}
          onImagePointerUp={onImagePointerUp}
          onImagePointerCancel={onImagePointerCancel}
          data-oid="gyzog51"
        />

        {/* ---- 左侧导航按钮 ---- */}
        {showCounterStrip && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToPrev();
            }}
            disabled={!canGoPrev}
            className={cn(
              "neu-raised-sm previewNavButton absolute z-[1000] top-1/2 -translate-y-1/2 left-[clamp(0.5rem,2vw,1rem)]",
              "flex items-center justify-center rounded-full w-[clamp(2rem,5vw,3rem)] h-[clamp(2rem,5vw,3rem)]",
              "border-0 text-[var(--preview-icon)] transition-[box-shadow,color,transform] duration-200",
              canGoPrev
                ? "hover:text-[var(--preview-nav-hover-text)] hover:scale-105 cursor-pointer active:shadow-[var(--neu-pressed-shadow)]"
                : "opacity-30 cursor-not-allowed",
            )}
            aria-label="上一个文件"
            data-oid="1u2s148"
          >
            <svg
              className="shrink-0 w-[clamp(1rem,2.5vw,1.5rem)] h-[clamp(1rem,2.5vw,1.5rem)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="clamp(1.5, 0.4vw, 2.5)"
              data-oid="2mniwy."
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
                data-oid=":-.ujt6"
              />
            </svg>
          </button>
        )}

        <FilePreviewToolbar
          section="upper"
          isImage={isImage}
          isVideo={isVideo}
          onClose={onClose}
          onDownload={handleDownload}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onRotate={handleRotate}
          onResetView={handleResetView}
          onToggleLoop={handleToggleLoop}
          isLooping={isLooping}
          className="previewToolbarUpper previewMobileChromeLane absolute z-[1000] right-[clamp(0.5rem,2vw,1rem)] bottom-[calc(50%+clamp(1rem,2.5vw,1.5rem)+clamp(0.75rem,1.8vw,1rem))]"
          data-oid="raibeex"
        />

        {showCounterStrip && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            disabled={!canGoNext}
            className={cn(
              "neu-raised-sm previewNavButton absolute z-[1000] right-[clamp(0.5rem,2vw,1rem)] top-1/2 -translate-y-1/2",
              "flex items-center justify-center rounded-full w-[clamp(2rem,5vw,3rem)] h-[clamp(2rem,5vw,3rem)]",
              "border-0 text-[var(--preview-icon)] transition-[box-shadow,color,transform] duration-200",
              canGoNext
                ? "hover:text-[var(--preview-nav-hover-text)] hover:scale-105 cursor-pointer active:shadow-[var(--neu-pressed-shadow)]"
                : "opacity-30 cursor-not-allowed",
            )}
            aria-label="下一个文件"
            data-oid="k1l2xfs"
          >
            <svg
              className="shrink-0 w-[clamp(1rem,2.5vw,1.5rem)] h-[clamp(1rem,2.5vw,1.5rem)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="clamp(1.5, 0.4vw, 2.5)"
              data-oid="qxkd8d-"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
                data-oid="ftin3jx"
              />
            </svg>
          </button>
        )}

        <FilePreviewToolbar
          section="lower"
          isImage={isImage}
          isVideo={isVideo}
          onClose={onClose}
          onDownload={handleDownload}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onRotate={handleRotate}
          onResetView={handleResetView}
          onToggleLoop={handleToggleLoop}
          isLooping={isLooping}
          className="previewToolbarLower previewMobileChromeLane absolute z-[1000] right-[clamp(0.5rem,2vw,1rem)] top-[calc(50%+clamp(1rem,2.5vw,1.5rem)+clamp(0.75rem,1.8vw,1rem))]"
          data-oid="h1nkeo3"
        />
      </div>

      {/* ---- 底部文件信息 ---- */}
      <div
        className="neu-flat relative z-20 shrink-0 px-[clamp(0.8rem,2vw,1rem)] pb-[clamp(0.9rem,2.25vw,1.25rem)] pt-[clamp(0.18rem,0.45vw,0.25rem)]"
        onClick={(e) => e.stopPropagation()}
        data-testid="preview-file-info-strip"
        data-oid="8u:a17z"
      >
        <div
          className="mx-auto max-w-[clamp(38rem,96vw,48rem)]"
          data-oid="j24dcaf"
        >
          <div
            className={cn(
              "neu-raised previewFileInfoCard mx-auto max-w-[clamp(34rem,96vw,50rem)] rounded-[clamp(0.6rem,1.4vw,0.75rem)] text-center",
              "p-[clamp(0.5rem,1.2vw,0.75rem)]",
              "border-0",
            )}
            data-testid="preview-file-info-card"
            data-oid="86:.xt."
          >
            <div
              className="previewFileInfoContent"
              data-testid="preview-file-info-content"
            >
              <div
                className="previewFileInfoNameBlock min-w-0"
                data-testid="preview-file-info-name-block"
              >
                <h2
                  id="preview-title"
                  className="previewFileInfoTitle truncate font-medium text-[var(--preview-text-primary)]"
                  title={file.original_filename}
                  data-testid="preview-file-info-title"
                  data-oid="fl7a_5r"
                >
                  {displayFilename}
                </h2>
              </div>
              <p
                className="previewFileInfoMeta previewFileInfoMetaRail previewFileInfoMetaCapsule text-[var(--preview-text-muted)]"
                data-testid="preview-file-info-meta"
                data-oid="n97uwfn"
              >
                <span
                  className="previewFileInfoMetaItem previewFileInfoSize"
                  data-testid="preview-file-info-size"
                >
                  {formatFileSize(file.file_size)}
                </span>
                <span
                  className="previewFileInfoMetaSeparator"
                  data-testid="preview-file-info-size-separator"
                  aria-hidden="true"
                >
                  ·
                </span>
                <span
                  className="previewFileInfoMetaItem previewFileInfoType"
                  data-testid="preview-file-info-type"
                >
                  {getMimeTypeLabel(file.mime_type, file.original_filename)}
                </span>
                <span
                  className="previewFileInfoMetaSeparator"
                  data-testid="preview-file-info-type-separator"
                  aria-hidden="true"
                >
                  ·
                </span>
                <span
                  className="previewFileInfoMetaItem previewFileInfoDate"
                  data-testid="preview-file-info-date"
                >
                  {formatPreviewDate(file.created_at)}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(previewDialog, document.body);
}
