import { useEffect } from "react";
import { cn } from "../../../utils/cn";
import { SpinnerIcon } from "./FilePreviewIcons";

interface VideoPreviewProps {
  blobUrl: string;
  useHls: boolean;
  loop: boolean;
  videoReady: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onReady: () => void;
  onError: () => void;
}

export function VideoPreview({
  blobUrl,
  useHls,
  loop,
  videoReady,
  videoRef,
  onReady,
  onError,
}: VideoPreviewProps) {
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.loop = loop;
    }
  }, [loop, videoRef]);

  return (
    <div
      className="relative flex h-full w-full min-h-0 items-center justify-center"
    >
      {!videoReady && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-transparent">
          <SpinnerIcon className="h-10 w-10 text-[var(--preview-spinner)]" />
        </div>
      )}
      <video
        ref={videoRef}
        key={blobUrl}
        src={useHls ? undefined : blobUrl}
        loop={loop}
        controls={videoReady}
        autoPlay
        preload="metadata"
        poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='2' height='2'%3E%3C/svg%3E"
        className={cn(
          "pointer-events-auto max-h-full max-w-full rounded-lg object-contain shadow-2xl transition-opacity duration-200 cursor-pointer",
          videoReady ? "opacity-100" : "opacity-0",
        )}
        style={{ backgroundColor: "transparent" }}
        onClick={(e) => e.stopPropagation()}
        onLoadedMetadata={onReady}
        onLoadedData={onReady}
        onCanPlay={onReady}
        onError={onError}
      >
        <track kind="captions" />
        您的浏览器不支持视频播放
      </video>
    </div>
  );
}
