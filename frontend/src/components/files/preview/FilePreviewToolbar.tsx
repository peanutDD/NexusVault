/**
 * FilePreviewToolbar
 * 右侧控制面板：关闭、下载、放大、缩小、旋转、Reset
 */

import { cn } from "../../../utils/cn";
import {
  CloseIcon,
  DownloadIcon,
  LoopIcon,
} from "./FilePreviewIcons";

// =============================================================================
// 类型
// =============================================================================

export interface FilePreviewToolbarProps {
  isImage: boolean;
  isVideo: boolean;
  section: "upper" | "lower";
  className?: string;
  onClose: () => void;
  onDownload: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRotate: () => void;
  onResetView: () => void;
  onToggleLoop: () => void;
  isLooping: boolean;
}

// =============================================================================
// 组件
// =============================================================================

export function FilePreviewToolbar({
  isImage,
  isVideo,
  section,
  className,
  onClose,
  onDownload,
  onZoomIn,
  onZoomOut,
  onRotate,
  onResetView,
  onToggleLoop,
  isLooping,
}: FilePreviewToolbarProps) {
  const showSecondaryControls = section === "upper" && (isVideo || isImage);
  const showPrimaryControls = section === "lower";

  if (!showSecondaryControls && !showPrimaryControls) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center pointer-events-auto",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
      data-oid="_xqsaf4"
    >
      <div
        className={cn(
          "flex flex-col items-center rounded-[clamp(0.8rem,2vw,1rem)] bg-[var(--preview-floating-bg)] backdrop-blur-xl border-solid pointer-events-auto",
          "w-[clamp(2.5rem,6vw,3rem)] gap-[clamp(0.25rem,0.8vw,0.5rem)] p-[clamp(0.35rem,1vw,0.75rem)]",
          "border-[clamp(1px,0.15vw,2px)] border-[var(--preview-floating-border)]",
          "shadow-[var(--preview-floating-shadow)]",
        )}
        data-oid="t0n:1ov"
      >
        {showPrimaryControls && (
          <div
            className="flex flex-col items-center gap-[clamp(0.25rem,0.8vw,0.5rem)]"
            data-oid=":yx4nvf"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="flex items-center justify-center rounded-full font-semibold text-[var(--preview-floating-btn-text)] hover:bg-[var(--preview-floating-btn-hover-bg)] w-[clamp(2rem,5vw,2.5rem)] h-[clamp(2rem,5vw,2.5rem)]"
              aria-label="关闭"
              data-oid=":vb9jf8"
            >
              <span
                className="flex shrink-0 items-center justify-center w-[clamp(1rem,2.5vw,1.25rem)] h-[clamp(1rem,2.5vw,1.25rem)]"
                data-oid="sewksa6"
              >
                <CloseIcon data-oid="r863tkr" />
              </span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDownload();
              }}
              className="flex items-center justify-center rounded-full font-semibold text-[var(--preview-floating-btn-text)] hover:bg-[var(--preview-floating-btn-hover-bg)] w-[clamp(2rem,5vw,2.5rem)] h-[clamp(2rem,5vw,2.5rem)]"
              aria-label="下载"
              data-oid="fyez415"
            >
              <span
                className="flex shrink-0 items-center justify-center w-[clamp(1rem,2.5vw,1.25rem)] h-[clamp(1rem,2.5vw,1.25rem)]"
                data-oid="ku-oe08"
              >
                <DownloadIcon data-oid="4kdojq5" />
              </span>
            </button>
          </div>
        )}

        {showSecondaryControls && (
          <div
            className="flex flex-col items-center gap-[clamp(0.25rem,0.8vw,0.5rem)]"
            data-oid="pkky9vb"
          >
            {isVideo && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLoop();
                }}
                className={cn(
                  "flex items-center justify-center rounded-full font-semibold w-[clamp(2rem,5vw,2.5rem)] h-[clamp(2rem,5vw,2.5rem)] transition-colors",
                  isLooping
                    ? "bg-[var(--preview-floating-btn-active-bg)] text-[var(--preview-floating-btn-text)] shadow-inner"
                    : "text-[var(--preview-floating-btn-muted)] hover:bg-[var(--preview-floating-btn-hover-bg)]",
                )}
                aria-label={isLooping ? "关闭循环播放" : "开启循环播放"}
                title={isLooping ? "循环播放：已开启" : "循环播放：已关闭"}
                data-oid="wbl1-_s"
              >
                <span
                  className="flex shrink-0 items-center justify-center w-[clamp(1rem,2.5vw,1.25rem)] h-[clamp(1rem,2.5vw,1.25rem)]"
                  data-oid="k-..gro"
                >
                  <LoopIcon data-oid="62e36-s" />
                </span>
              </button>
            )}

            {isImage && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onZoomIn();
                  }}
                  className="flex items-center justify-center rounded-full font-semibold text-[var(--preview-floating-btn-text)] hover:bg-[var(--preview-floating-btn-hover-bg)] active:bg-[var(--preview-floating-btn-active-bg)] transition-transform transition-colors duration-150 active:scale-95 w-[clamp(2rem,5vw,2.5rem)] h-[clamp(2rem,5vw,2.5rem)] text-[clamp(0.85rem,2vw,1.125rem)]"
                  aria-label="放大"
                  data-oid="hlafemx"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onZoomOut();
                  }}
                  className="flex items-center justify-center rounded-full font-semibold text-[var(--preview-floating-btn-text)] hover:bg-[var(--preview-floating-btn-hover-bg)] active:bg-[var(--preview-floating-btn-active-bg)] transition-transform transition-colors duration-150 active:scale-95 w-[clamp(2rem,5vw,2.5rem)] h-[clamp(2rem,5vw,2.5rem)] text-[clamp(0.85rem,2vw,1.125rem)]"
                  aria-label="缩小"
                  data-oid="9d9njy3"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRotate();
                  }}
                  className="flex items-center justify-center rounded-full font-semibold text-[var(--preview-floating-btn-text)] hover:bg-[var(--preview-floating-btn-hover-bg)] active:bg-[var(--preview-floating-btn-active-bg)] transition-transform transition-colors duration-150 active:scale-95 w-[clamp(2rem,5vw,2.5rem)] h-[clamp(2rem,5vw,2.5rem)] text-[clamp(0.85rem,2vw,1.125rem)]"
                  aria-label="旋转 90 度"
                  data-oid="6p:vlsu"
                >
                  ⤾
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onResetView();
                  }}
                  className="rounded-full font-semibold text-[var(--preview-floating-btn-muted)] hover:bg-[var(--preview-floating-btn-hover-bg)] active:bg-[var(--preview-floating-btn-active-bg)] transition-transform transition-colors duration-150 active:scale-95 mt-[clamp(0.15rem,0.4vw,0.25rem)] px-[clamp(0.35rem,0.8vw,0.5rem)] py-[clamp(0.1rem,0.3vw,0.15rem)] text-[clamp(0.5rem,1.2vw,0.625rem)]"
                  data-oid="fht5ktl"
                >
                  Reset
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
