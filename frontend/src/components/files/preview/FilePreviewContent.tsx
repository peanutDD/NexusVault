import { lazy, Suspense, useEffect, useState } from "react";
import { isGifType } from "../../../utils/mimeType";
import { AudioPreview } from "./AudioPreview";
import FilePreviewStage from "./FilePreviewStage";
import {
  PreviewErrorState,
  PreviewLoadingState,
  UnsupportedPreviewState,
} from "./FilePreviewStates";
import FilePreviewTextPanel from "./FilePreviewTextPanel";
import { SpinnerIcon } from "./FilePreviewIcons";
import { ImagePreview } from "./ImagePreview";
import { VideoPreview } from "./VideoPreview";

const PdfPreview = lazy(() => import("./PdfPreview"));

export interface FilePreviewContentProps {
  file: {
    id: string;
    original_filename: string;
    mime_type: string;
    file_size: number;
    created_at: string;
  };
  loading: boolean;
  error: string | null;
  supported: boolean;
  isImage: boolean;
  isPDF: boolean;
  isMarkdown: boolean;
  isVideo: boolean;
  isAudio: boolean;
  isText: boolean;
  blobUrl: string | null;
  gifFirstFrameUrl: string | null;
  textContent: string | null;
  useHls: boolean;
  imageLoaded: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  loop: boolean;
  setImageLoaded: (v: boolean) => void;
  tryVideoAudioFallback: () => void;
  onImageError: () => void;
  onClose: () => void;
  formatDate: (dateStr: string) => string;
  zoom: number;
  rotation: number;
  pan: { x: number; y: number };
  isDraggingImage: boolean;
  onImagePointerDown: React.PointerEventHandler<HTMLDivElement>;
  onImagePointerMove: React.PointerEventHandler<HTMLDivElement>;
  onImagePointerUp: React.PointerEventHandler<HTMLDivElement>;
  onImagePointerCancel: React.PointerEventHandler<HTMLDivElement>;
}

export function FilePreviewContent(props: FilePreviewContentProps) {
  const {
    file,
    loading,
    error,
    supported,
    isImage,
    isPDF,
    isMarkdown,
    isVideo,
    isAudio,
    isText,
    blobUrl,
    gifFirstFrameUrl,
    textContent,
    useHls,
    imageLoaded,
    videoRef,
    loop,
    setImageLoaded,
    tryVideoAudioFallback,
    onImageError,
    onClose,
    formatDate,
    zoom,
    rotation,
    pan,
    isDraggingImage,
    onImagePointerDown,
    onImagePointerMove,
    onImagePointerUp,
    onImagePointerCancel,
  } = props;
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setVideoReady(false);
    });
    return () => {
      cancelled = true;
    };
  }, [blobUrl, isVideo, useHls]);

  const isGif = isGifType(file.mime_type);
  const showImagePreview =
    (isImage && (blobUrl || gifFirstFrameUrl)) ||
    (isGif && !blobUrl && gifFirstFrameUrl);
  const imagePreviewSrc =
    isGif && !blobUrl ? gifFirstFrameUrl : (blobUrl ?? gifFirstFrameUrl);

  return (
    <FilePreviewStage
      showLabel={!loading && !error && supported}
      onClose={onClose}
    >
      {loading ? <PreviewLoadingState /> : null}
      {error && !loading ? (
        <PreviewErrorState error={error} onClose={onClose} />
      ) : null}
      {!loading && !error && supported ? (
        <div className="relative flex h-full w-full items-center justify-center p-[clamp(1rem,3vw,2rem)]">
          {showImagePreview && imagePreviewSrc ? (
            <ImagePreview
              src={imagePreviewSrc}
              alt={file.original_filename}
              imageLoaded={imageLoaded}
              onImageLoad={() => setImageLoaded(true)}
              onImageError={onImageError}
              zoom={zoom}
              rotation={rotation}
              pan={pan}
              isDragging={isDraggingImage}
              onPointerDown={onImagePointerDown}
              onPointerMove={onImagePointerMove}
              onPointerUp={onImagePointerUp}
              onPointerCancel={onImagePointerCancel}
            />
          ) : null}

          {isPDF && blobUrl ? (
            <Suspense fallback={<PreviewInlineLoading label="加载 PDF…" />}>
              <PdfPreview
                blobUrl={blobUrl}
                title={file.original_filename}
                onClose={onClose}
              />
            </Suspense>
          ) : null}

          {isVideo && blobUrl ? (
            <VideoPreview
              blobUrl={blobUrl}
              useHls={useHls}
              loop={loop}
              videoReady={videoReady}
              videoRef={videoRef}
              onReady={() => setVideoReady(true)}
              onError={tryVideoAudioFallback}
            />
          ) : null}

          {isAudio && blobUrl ? (
            <AudioPreview src={blobUrl} onError={tryVideoAudioFallback} />
          ) : null}

          {isText && textContent !== null ? (
            <FilePreviewTextPanel
              isMarkdown={isMarkdown}
              textContent={textContent}
            />
          ) : null}
        </div>
      ) : null}
      {!loading && !error && !supported ? (
        <UnsupportedPreviewState file={file} formatDate={formatDate} />
      ) : null}
    </FilePreviewStage>
  );
}

function PreviewInlineLoading({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <SpinnerIcon className="h-12 w-12 text-[var(--preview-spinner)]" />
      <span className="text-sm text-[var(--preview-text-muted)]">{label}</span>
    </div>
  );
}
