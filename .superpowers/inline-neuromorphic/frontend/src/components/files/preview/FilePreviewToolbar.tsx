/**
 * FilePreviewToolbar
 * 右侧控制面板：关闭、下载、放大、缩小、旋转、Reset
 */

import { cn } from "../../../utils/cn";
import { RotateCw } from "lucide-react";
import { CloseIcon, DownloadIcon, LoopIcon } from "./FilePreviewIcons";

const toolbarButtonClass =
  "neu-raised-sm previewFloatingBtn flex h-[var(--preview-toolbar-button-size)] w-[var(--preview-toolbar-button-size)] items-center justify-center rounded-full font-semibold transition-[box-shadow,color,transform] active:shadow-[var(--neu-inset-shadow)]";

const toolbarIconShellClass =
  "flex h-[var(--preview-toolbar-icon-size)] w-[var(--preview-toolbar-icon-size)] shrink-0 items-center justify-center";

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
          "neu-raised previewFloatingToolbar flex flex-col items-center rounded-[clamp(0.8rem,2vw,1rem)] border-0 pointer-events-auto",
          "w-[var(--preview-floating-toolbar-inline-size)] gap-[clamp(0.25rem,0.8vw,0.5rem)] p-[clamp(0.35rem,1vw,0.75rem)]",
        )}
        data-testid="preview-toolbar-container"
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
                onDownload();
              }}
              className={cn(
                toolbarButtonClass,
                "text-[var(--preview-floating-btn-text)]",
              )}
              aria-label="下载"
              data-oid="fyez415"
            >
              <span className={toolbarIconShellClass} data-oid="ku-oe08">
                <DownloadIcon data-oid="4kdojq5" />
              </span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className={cn(
                toolbarButtonClass,
                "text-[var(--preview-floating-btn-text)]",
              )}
              aria-label="关闭"
              data-oid=":vb9jf8"
            >
              <span className={toolbarIconShellClass} data-oid="sewksa6">
                <CloseIcon data-oid="r863tkr" />
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
                  toolbarButtonClass,
                  isLooping
                    ? "neu-pressed text-[var(--preview-floating-btn-text)]"
                    : "text-[var(--preview-floating-btn-muted)]",
                )}
                aria-label={isLooping ? "关闭循环播放" : "开启循环播放"}
                title={isLooping ? "循环播放：已开启" : "循环播放：已关闭"}
                data-oid="wbl1-_s"
              >
                <span className={toolbarIconShellClass} data-oid="k-..gro">
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
                  className={cn(
                    toolbarButtonClass,
                    "text-[length:var(--preview-toolbar-symbol-font-size)] text-[var(--preview-floating-btn-text)] duration-150 active:scale-95",
                  )}
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
                  className={cn(
                    toolbarButtonClass,
                    "text-[length:var(--preview-toolbar-symbol-font-size)] text-[var(--preview-floating-btn-text)] duration-150 active:scale-95",
                  )}
                  aria-label="缩小"
                  data-oid="9d9njy3"
                >
                  −
                </button>
              </>
            )}

            {(isVideo || isImage) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRotate();
                }}
                className={cn(
                  toolbarButtonClass,
                  "text-[var(--preview-floating-btn-text)] duration-150 active:scale-95",
                )}
                aria-label="旋转 90 度"
                title="旋转 90 度"
                data-oid="6p:vlsu"
              >
                <RotateCw
                  className="h-[var(--preview-toolbar-icon-size)] w-[var(--preview-toolbar-icon-size)] shrink-0"
                  aria-hidden="true"
                />
              </button>
            )}

            {isImage && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onResetView();
                }}
                className="neu-raised-sm previewFloatingBtn previewFloatingResetButton rounded-full h-[var(--preview-toolbar-button-size)] w-[var(--preview-toolbar-button-size)] items-center justify-center text-[length:var(--preview-toolbar-reset-font-size)] font-semibold text-[var(--preview-floating-btn-muted)] transition-[box-shadow,color,transform] duration-150 active:scale-95 active:shadow-[var(--neu-pressed-shadow)]"
                data-oid="fht5ktl"
              >
                Reset
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
