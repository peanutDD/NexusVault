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
        className="audioPreviewSurface pointer-events-auto flex flex-col items-center gap-[clamp(1.25rem,2.7vw,1.5rem)] rounded-[clamp(0.8rem,2vw,1rem)] [background:var(--preview-surface-soft)] px-[clamp(2.75rem,5.4vw,3rem)] py-[clamp(2.25rem,4.5vw,2.5rem)] shadow-[var(--neu-inset-shadow)]"
        onClick={(e) => e.stopPropagation()}
        data-oid="t97wgej"
      >
        <div
          className="flex h-[clamp(5.75rem,10.8vw,6rem)] w-[clamp(5.75rem,10.8vw,6rem)] items-center justify-center rounded-full [background:var(--preview-audio-icon-bg)] shadow-[var(--neu-control-shadow)]"
          data-oid="vp:v1h2"
        >
          <AudioIcon data-oid="n5a.zv-" />
        </div>
        <audio
          key={src}
          src={src}
          controls
          autoPlay
          className="w-[clamp(19.75rem,36vw,20rem)]"
          onError={onError}
          data-oid="ab7fcl9"
        >
          您的浏览器不支持音频播放
        </audio>
      </div>
    </div>
  );
}
