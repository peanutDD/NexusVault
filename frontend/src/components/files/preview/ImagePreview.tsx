import { useRef } from "react";
import { cn } from "../../../utils/cn";
import { ResponsivePicture } from "../../common/ResponsivePicture";

interface ImagePreviewProps {
  src: string;
  alt: string;
  imageLoaded: boolean;
  onImageLoad: () => void;
  onImageError: () => void;
}

export function ImagePreview({
  src,
  alt,
  imageLoaded,
  onImageLoad,
  onImageError,
}: ImagePreviewProps) {
  const imageTransformRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className="relative flex h-full w-full min-h-0 items-center justify-center"
      data-oid="nkhpa89"
    >
      <div
        ref={imageTransformRef}
        className={cn(
          // 缩放与旋转由父层注入 transform，避免重新布局
          "flex h-full w-full min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-lg origin-center transition-transform duration-500 ease-out cursor-pointer",
          imageLoaded ? "opacity-100" : "opacity-0",
        )}
        data-oid="7dzq3rw"
      >
        <ResponsivePicture
          src={src}
          alt={alt}
          className="max-h-full max-w-full object-contain"
          decoding="async"
          fetchPriority="high"
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
            className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--preview-loading-border)] border-t-[var(--preview-loading-border-top)]"
            data-oid="rk.oeiq"
          />
        </div>
      ) : null}
    </div>
  );
}