import { AudioIcon } from "./FilePreviewIcons";

interface AudioPreviewProps {
  src: string;
  onError: () => void;
}

export function AudioPreview({ src, onError }: AudioPreviewProps) {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center pointer-events-none"
      data-oid="h.1_-ta"
    >
      <div
        className="pointer-events-auto flex flex-col items-center gap-6 rounded-2xl bg-[var(--preview-surface-soft)] px-12 py-10"
        onClick={(e) => e.stopPropagation()}
        data-oid="t97wgej"
      >
        <div
          className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--preview-audio-icon-bg)]"
          data-oid="vp:v1h2"
        >
          <AudioIcon data-oid="n5a.zv-" />
        </div>
        <audio
          key={src}
          src={src}
          controls
          autoPlay
          className="w-80"
          onError={onError}
          data-oid="ab7fcl9"
        >
          您的浏览器不支持音频播放
        </audio>
      </div>
    </div>
  );
}