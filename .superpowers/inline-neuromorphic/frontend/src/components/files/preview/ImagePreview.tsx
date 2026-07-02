import { cn } from "../../../utils/cn";
import { ResponsivePicture } from "../../common/ResponsivePicture";
import type { CSSProperties, PointerEventHandler } from "react";

interface ImagePreviewProps {
  src: string;
  alt: string;
  imageLoaded: boolean;
  onImageLoad: () => void;
  onImageError: () => void;
  zoom: number;
  rotation: number;
  pan: { x: number; y: number };
  isDragging: boolean;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onPointerMove: PointerEventHandler<HTMLDivElement>;
  onPointerUp: PointerEventHandler<HTMLDivElement>;
  onPointerCancel: PointerEventHandler<HTMLDivElement>;
}

export function ImagePreview({
  src,
  alt,
  imageLoaded,
  onImageLoad,
  onImageError,
  zoom,
  rotation,
  pan,
  isDragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: ImagePreviewProps) {
  return (
    <div
      className="relative flex h-full w-full min-h-0 items-center justify-center"
      data-oid="nkhpa89"
    >
      <div
        className={cn(
          // 缩放与旋转由 CSS 变量驱动，避免重新布局
          "flex h-full w-full min-h-0 min-w-0 touch-none select-none items-center justify-center overflow-hidden rounded-[clamp(0.4rem,1vw,0.5rem)] origin-center transition-transform ease-out",
          "transform-[translate3d(var(--preview-pan-x),var(--preview-pan-y),0)_scale(var(--preview-zoom))_rotate(var(--preview-rotation))]",
          zoom > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-default",
          isDragging ? "duration-0" : "duration-500",
          imageLoaded ? "opacity-100" : "opacity-0",
        )}
        data-testid="image-preview-pan-surface"
        data-oid="7dzq3rw"
        style={{
          "--preview-zoom": zoom,
          "--preview-rotation": `${rotation}deg`,
          "--preview-pan-x": `${pan.x}px`,
          "--preview-pan-y": `${pan.y}px`,
        } as CSSProperties}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <ResponsivePicture
          src={src}
          alt={alt}
          className="max-h-full max-w-full object-contain"
          decoding="async"
          fetchPriority="high"
          draggable={false}
          onLoad={onImageLoad}
          onError={onImageError}
          data-oid="2j7js_c"
        />
      </div>
      {/* 图片未完成解码时保持中心 Loading，避免抖动 */}
      {!imageLoaded ? (
        <div
          className="absolute flex items-center justify-center inset-0"
          data-oid="uk1f569"
        >
          <div
            className="h-[clamp(2.25rem,4.5vw,2.5rem)] w-[clamp(2.25rem,4.5vw,2.5rem)] animate-spin rounded-full border-2 border-[var(--preview-loading-border)] border-t-[var(--preview-loading-border-top)]"
            data-oid="rk.oeiq"
          />
        </div>
      ) : null}
    </div>
  );
}
