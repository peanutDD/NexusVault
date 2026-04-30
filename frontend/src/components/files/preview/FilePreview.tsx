/**
 * FilePreview
 * 文件预览弹窗：支持图片、视频、音频、PDF、文本
 * 多文件时可左右切换，图片支持缩放、旋转
 */

// =============================================================================
// 依赖
// =============================================================================

import { useMemo, useState, useRef } from "react";
import { fileService } from "../../../services/files";
import { formatFileSize } from "../../../utils/format";
import { cn } from "../../../utils/cn";
import { getPreviewKind, getMimeTypeLabel } from "../../../utils/mimeType";
import type { FileMetadata } from "../../../types/files";

import { useFilePreviewData } from "./hooks/useFilePreviewData";
import { useFilePreviewNavigation } from "./hooks/useFilePreviewNavigation";
import { useFilePreviewEffects } from "./hooks/useFilePreviewEffects";
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
      ref={previewRootRef}
      className="preview-cyberpunk-root fixed inset-0 z-50 flex flex-col overflow-hidden text-[var(--preview-text-primary)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-title"
      data-oid="i.zkwzs"
    >
      {/* ---- 背景层（点击关闭） ---- */}
      <div
        className="absolute inset-0 z-0 backdrop-blur-xl"
        style={{ backgroundColor: "rgba(var(--preview-ink), 0.92)" }}
        onClick={onClose}
        aria-hidden
        data-oid="fj47v.w"
      />

      <div
        className="pointer-events-none absolute inset-0 z-[2]"
        data-oid="svab85m"
      >
        <div
          className="preview-static-bg preview-static-bg-glow absolute inset-0"
          data-oid="q5r7l8n"
        />
        <div
          className="preview-static-grid preview-static-grid-glow absolute inset-0 opacity-35"
          data-oid="n13d9xk"
        />
        <div
          className="preview-static-vignette preview-static-vignette-glow absolute inset-0"
          data-oid="v8x9e3t"
        />
        <div
          className="preview-static-scanlines preview-static-scanlines-glow absolute inset-0 opacity-20"
          data-oid="a6p2d4m"
        />
        <div
          className="preview-static-hud preview-static-hud-glow absolute inset-0"
          data-oid="x0h7m2w"
        />
      </div>

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
            "absolute z-20 top-1/2 -translate-y-1/2 left-[clamp(0.5rem,2vw,1rem)]",
            "flex items-center justify-center rounded-full w-[clamp(2rem,5vw,3rem)] h-[clamp(2rem,5vw,3rem)]",
            "border-[clamp(1px,0.2vw,2px)] border-solid border-[rgba(255,255,255,0.25)]",
            "shadow-[0_clamp(0.25rem,1vw,0.75rem)_clamp(0.5rem,2.5vw,1.5rem)_rgba(15,23,42,0.75)]",
            "bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl text-[var(--preview-icon)] transition-all duration-200",
            canGoPrev
              ? "hover:from-white/20 hover:via-white/10 hover:text-white hover:scale-105 hover:border-white/40 cursor-pointer"
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

      {/* ---- 顶部工具栏（文件计数器） ---- */}
      <div
        className="relative z-20 flex shrink-0 items-center justify-between bg-gradient-to-b from-black/70 via-black/40 to-transparent px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]"
        onClick={(e) => e.stopPropagation()}
        data-oid="0_8_xes"
      >
        <div className="flex items-center gap-3" data-oid="omtvpu3" />
        <div className="flex items-center gap-2" data-oid="sj8woog" />
        {files.length > 1 && (
          <div
            className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2"
            data-oid="ptnb6vs"
          >
            <div
              className={cn(
                "inline-flex items-center rounded-full bg-white/10 backdrop-blur-xl border-solid",
                "gap-[clamp(0.25rem,0.8vw,0.5rem)] pl-[clamp(0.5rem,1.2vw,0.75rem)] pr-[clamp(0.5rem,1.2vw,0.75rem)]",
                "pt-[clamp(0.2rem,0.5vw,0.25rem)] pb-[clamp(0.2rem,0.5vw,0.25rem)]",
                "border-[clamp(1px,0.15vw,2px)] border-[rgba(255,255,255,0.2)] text-[clamp(0.6rem,1.2vw,0.7rem)]",
                "shadow-[0_clamp(0.25rem,0.8vw,0.6rem)_clamp(0.5rem,1.5vw,1rem)_rgba(15,23,42,0.85)]",
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
        )}
      </div>

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
        data-oid="gyzog51"
      />

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
        className="absolute z-[1000] right-[clamp(0.5rem,2vw,1rem)] bottom-[calc(50%+clamp(1rem,2.5vw,1.5rem)+clamp(0.75rem,1.8vw,1rem))]"
        data-oid="raibeex"
      />

      {files.length > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
          disabled={!canGoNext}
          className={cn(
            "absolute z-[1000] right-[clamp(0.5rem,2vw,1rem)] top-1/2 -translate-y-1/2",
            "flex items-center justify-center rounded-full w-[clamp(2rem,5vw,3rem)] h-[clamp(2rem,5vw,3rem)]",
            "border-[clamp(1px,0.2vw,2px)] border-solid border-[rgba(255,255,255,0.25)]",
            "shadow-[0_clamp(0.25rem,1vw,0.75rem)_clamp(0.5rem,2.5vw,1.5rem)_rgba(15,23,42,0.75)]",
            "bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl text-[var(--preview-icon)] transition-all duration-200",
            canGoNext
              ? "hover:from-white/20 hover:via-white/10 hover:text-white hover:scale-105 hover:border-white/40 cursor-pointer"
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
        className="absolute z-[1000] right-[clamp(0.5rem,2vw,1rem)] top-[calc(50%+clamp(1rem,2.5vw,1.5rem)+clamp(0.75rem,1.8vw,1rem))]"
        data-oid="h1nkeo3"
      />

      {/* ---- 底部文件信息 ---- */}
      <div
        className="relative z-20 shrink-0 bg-gradient-to-t from-black/70 to-transparent px-[clamp(0.8rem,2vw,1rem)] py-[clamp(0.9rem,2.25vw,1.25rem)]"
        onClick={(e) => e.stopPropagation()}
        data-oid="8u:a17z"
      >
        <div className="mx-auto max-w-3xl" data-oid="j24dcaf">
          <div
            className={cn(
              "mx-auto max-w-2xl rounded-xl bg-white/5 text-center backdrop-blur-sm border-solid",
              "p-[clamp(0.5rem,1.2vw,0.75rem)]",
              "border-[clamp(1px,0.15vw,2px)] border-[rgba(255,255,255,0.1)]",
              "shadow-[0_clamp(0.2rem,0.6vw,0.4rem)_clamp(0.4rem,1.2vw,0.8rem)_rgba(0,0,0,0.2)]",
            )}
            data-oid="86:.xt."
          >
            <h2
              id="preview-title"
              className="truncate font-medium text-[var(--preview-text-primary)] text-[clamp(0.8rem,1.8vw,1rem)]"
              title={file.original_filename}
              data-oid="fl7a_5r"
            >
              {displayFilename}
            </h2>
            <p
              className="text-[var(--preview-text-muted)] mt-[clamp(0.2rem,0.5vw,0.25rem)] text-[clamp(0.65rem,1.4vw,0.75rem)]"
              data-oid="n97uwfn"
            >
              {formatFileSize(file.file_size)} ·{" "}
              {getMimeTypeLabel(file.mime_type, file.original_filename)} ·{" "}
              {formatPreviewDate(file.created_at)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
