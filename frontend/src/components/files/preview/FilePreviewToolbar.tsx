/**
 * FilePreviewToolbar
 * 右侧控制面板：关闭、下载、放大、缩小、旋转、Reset
 */

import { cn } from '../../../utils/cn';
import { CloseIcon, DownloadIcon, LoopIcon, PauseIcon, PlayIcon } from './FilePreviewIcons';

// =============================================================================
// 类型
// =============================================================================

export interface FilePreviewToolbarProps {
  isImage: boolean;
  isVideo: boolean;
  section: 'upper' | 'lower';
  className?: string;
  onClose: () => void;
  onDownload: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRotate: () => void;
  onResetView: () => void;
  onToggleLoop: () => void;
  onToggleRotation: () => void;
  isLooping: boolean;
  isRotationPaused: boolean;
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
  onToggleRotation,
  isLooping,
  isRotationPaused,
}: FilePreviewToolbarProps) {
  const showSecondaryControls = section === 'upper' && (isVideo || isImage);
  const showPrimaryControls = section === 'lower';

  if (!showSecondaryControls && !showPrimaryControls) {
    return null;
  }

  return (
    <div
      className={cn('flex flex-col items-center pointer-events-auto', className)}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={cn(
          'flex flex-col items-center rounded-2xl bg-white/10 backdrop-blur-xl border-solid pointer-events-auto',
          'w-[clamp(2.5rem,6vw,3rem)] gap-[clamp(0.25rem,0.8vw,0.5rem)] p-[clamp(0.35rem,1vw,0.75rem)]',
          'border-[clamp(1px,0.15vw,2px)] border-[rgba(255,255,255,0.2)]',
          'shadow-[0_clamp(0.35rem,1vw,0.75rem)_clamp(0.6rem,2vw,1.25rem)_rgba(15,23,42,0.85)]'
        )}
      >
        {showPrimaryControls && (
          <div className="flex flex-col items-center gap-[clamp(0.25rem,0.8vw,0.5rem)]">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="flex items-center justify-center rounded-full font-semibold text-white/85 hover:bg-white/10 w-[clamp(2rem,5vw,2.5rem)] h-[clamp(2rem,5vw,2.5rem)]"
              aria-label="关闭"
            >
              <span className="flex shrink-0 items-center justify-center w-[clamp(1rem,2.5vw,1.25rem)] h-[clamp(1rem,2.5vw,1.25rem)]">
                <CloseIcon />
              </span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleRotation();
              }}
              className={cn(
                'flex items-center justify-center rounded-full font-semibold w-[clamp(2rem,5vw,2.5rem)] h-[clamp(2rem,5vw,2.5rem)] transition-colors',
                isRotationPaused
                  ? 'text-white/80 hover:bg-white/10'
                  : 'bg-white/15 text-white shadow-inner'
              )}
              aria-label={isRotationPaused ? '开始旋转' : '暂停旋转'}
              title={isRotationPaused ? '旋转：已暂停' : '旋转：进行中'}
            >
              <span className="flex shrink-0 items-center justify-center w-[clamp(1rem,2.5vw,1.25rem)] h-[clamp(1rem,2.5vw,1.25rem)]">
                {isRotationPaused ? <PlayIcon /> : <PauseIcon />}
              </span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDownload();
              }}
              className="flex items-center justify-center rounded-full font-semibold text-white/85 hover:bg-white/10 w-[clamp(2rem,5vw,2.5rem)] h-[clamp(2rem,5vw,2.5rem)]"
              aria-label="下载"
            >
              <span className="flex shrink-0 items-center justify-center w-[clamp(1rem,2.5vw,1.25rem)] h-[clamp(1rem,2.5vw,1.25rem)]">
                <DownloadIcon />
              </span>
            </button>
          </div>
        )}

        {showSecondaryControls && (
          <div className="flex flex-col items-center gap-[clamp(0.25rem,0.8vw,0.5rem)]">
            {isVideo && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLoop();
                }}
                className={cn(
                  'flex items-center justify-center rounded-full font-semibold w-[clamp(2rem,5vw,2.5rem)] h-[clamp(2rem,5vw,2.5rem)] transition-colors',
                  isLooping
                    ? 'bg-white/15 text-white shadow-inner'
                    : 'text-white/80 hover:bg-white/10'
                )}
                aria-label={isLooping ? '关闭循环播放' : '开启循环播放'}
                title={isLooping ? '循环播放：已开启' : '循环播放：已关闭'}
              >
                <span className="flex shrink-0 items-center justify-center w-[clamp(1rem,2.5vw,1.25rem)] h-[clamp(1rem,2.5vw,1.25rem)]">
                  <LoopIcon />
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
                  className="flex items-center justify-center rounded-full font-semibold text-white/85 hover:bg-white/10 active:bg-white/15 transition-transform transition-colors duration-150 active:scale-95 w-[clamp(2rem,5vw,2.5rem)] h-[clamp(2rem,5vw,2.5rem)] text-[clamp(0.85rem,2vw,1.125rem)]"
                  aria-label="放大"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onZoomOut();
                  }}
                  className="flex items-center justify-center rounded-full font-semibold text-white/85 hover:bg-white/10 active:bg-white/15 transition-transform transition-colors duration-150 active:scale-95 w-[clamp(2rem,5vw,2.5rem)] h-[clamp(2rem,5vw,2.5rem)] text-[clamp(0.85rem,2vw,1.125rem)]"
                  aria-label="缩小"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRotate();
                  }}
                  className="flex items-center justify-center rounded-full font-semibold text-white/85 hover:bg-white/10 active:bg-white/15 transition-transform transition-colors duration-150 active:scale-95 w-[clamp(2rem,5vw,2.5rem)] h-[clamp(2rem,5vw,2.5rem)] text-[clamp(0.85rem,2vw,1.125rem)]"
                  aria-label="旋转 90 度"
                >
                  ⤾
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onResetView();
                  }}
                  className="rounded-full font-semibold text-white/80 hover:bg-white/10 active:bg-white/15 transition-transform transition-colors duration-150 active:scale-95 mt-[clamp(0.15rem,0.4vw,0.25rem)] px-[clamp(0.35rem,0.8vw,0.5rem)] py-[clamp(0.1rem,0.3vw,0.15rem)] text-[clamp(0.5rem,1.2vw,0.625rem)]"
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
