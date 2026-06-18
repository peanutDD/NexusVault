/**
 * FilePreviewToolbar
 * 右侧控制面板：关闭、下载、放大、缩小、旋转、Reset
 */

import { cn } from "../../../utils/cn";
import { RotateCw } from "lucide-react";
import {
  CloseIcon,
  DownloadIcon,
  LoopIcon,
} from "./FilePreviewIcons";

const toolbarButtonClass =
  "previewFloatingBtn flex h-[var(--preview-toolbar-button-size)] w-[var(--preview-toolbar-button-size)] items-center justify-center rounded-full font-semibold transition-[background,box-shadow,transform]";

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
          "previewFloatingToolbar flex flex-col items-center rounded-[clamp(0.8rem,2vw,1rem)] [background:var(--preview-floating-bg)] backdrop-blur-xl border-solid pointer-events-auto",
          "w-[var(--preview-floating-toolbar-inline-size)] gap-[clamp(0.25rem,0.8vw,0.5rem)] p-[clamp(0.35rem,1vw,0.75rem)]",
          "border-[clamp(1px,0.15vw,2px)] border-[var(--preview-floating-border)]",
          "shadow-[var(--preview-floating-shadow)]",
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
                "text-[var(--preview-floating-btn-text)] hover:[background:var(--preview-floating-btn-hover-bg)]",
              )}
              aria-label="下载"
              data-oid="fyez415"
            >
              <span
                className={toolbarIconShellClass}
                data-oid="ku-oe08"
              >
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
                "text-[var(--preview-floating-btn-text)] hover:[background:var(--preview-floating-btn-hover-bg)]",
              )}
              aria-label="关闭"
              data-oid=":vb9jf8"
            >
              <span
                className={toolbarIconShellClass}
                data-oid="sewksa6"
              >
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
                    ? "[background:var(--preview-floating-btn-active-bg)] text-[var(--preview-floating-btn-text)] shadow-[var(--neu-inset-shadow)]"
                    : "text-[var(--preview-floating-btn-muted)] hover:[background:var(--preview-floating-btn-hover-bg)]",
                )}
                aria-label={isLooping ? "关闭循环播放" : "开启循环播放"}
                title={isLooping ? "循环播放：已开启" : "循环播放：已关闭"}
                data-oid="wbl1-_s"
              >
                <span
                  className={toolbarIconShellClass}
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
                  className={cn(
                    toolbarButtonClass,
                    "text-[length:var(--preview-toolbar-symbol-font-size)] text-[var(--preview-floating-btn-text)] duration-150 hover:[background:var(--preview-floating-btn-hover-bg)] active:scale-95 active:[background:var(--preview-floating-btn-active-bg)]",
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
                    "text-[length:var(--preview-toolbar-symbol-font-size)] text-[var(--preview-floating-btn-text)] duration-150 hover:[background:var(--preview-floating-btn-hover-bg)] active:scale-95 active:[background:var(--preview-floating-btn-active-bg)]",
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
                  "text-[var(--preview-floating-btn-text)] duration-150 hover:[background:var(--preview-floating-btn-hover-bg)] active:scale-95 active:[background:var(--preview-floating-btn-active-bg)]",
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
                className="previewFloatingBtn previewFloatingResetButton mt-[clamp(0.15rem,0.4vw,0.25rem)] rounded-full px-[clamp(0.35rem,0.8vw,0.5rem)] py-[clamp(0.1rem,0.3vw,0.15rem)] text-[length:var(--preview-toolbar-reset-font-size)] font-semibold text-[var(--preview-floating-btn-muted)] transition-[background,box-shadow,transform] duration-150 hover:[background:var(--preview-floating-btn-hover-bg)] active:scale-95 active:[background:var(--preview-floating-btn-active-bg)]"
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
