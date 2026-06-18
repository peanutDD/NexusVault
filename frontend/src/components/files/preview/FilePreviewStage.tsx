import type { ReactNode } from "react";
import { cn } from "../../../utils/cn";

interface FilePreviewStageProps {
  showLabel: boolean;
  onClose: () => void;
  isDocumentPreview?: boolean;
  children: ReactNode;
}

export default function FilePreviewStage({
  showLabel,
  onClose,
  isDocumentPreview = false,
  children,
}: FilePreviewStageProps) {
  return (
    <div
      className={cn(
        "previewStageShell relative z-[3] flex min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-center px-[clamp(0.75rem,5vw,4.5rem)] py-[clamp(0.55rem,1.2vh,0.85rem)]",
        isDocumentPreview ? "previewStageDocumentShell" : undefined,
      )}
      style={{ perspective: "87.5rem" }}
      onClick={onClose}
      data-testid="preview-stage-shell"
      data-oid="wc3_jmf"
    >
      <div
        className={cn(
          "previewStageDisplay relative top-[calc(clamp(0.77rem,1.58vh,1.18rem)*-1)] w-full min-w-0 max-w-[var(--app-preview-stage-max-width)] pointer-events-auto",
          isDocumentPreview ? "previewStageDocumentDisplay" : undefined,
        )}
        data-testid="preview-stage-display"
        data-preview-content
        style={{
          transform:
            "translate3d(var(--preview-orbit-x, 0rem), var(--preview-orbit-y, 0rem), var(--preview-orbit-z, 0rem)) rotateY(var(--preview-orbit-ry, 0deg)) rotateX(var(--preview-orbit-rx, 0deg))",
          transformStyle: "preserve-3d",
          willChange: "transform",
        }}
        onClick={(e) => e.stopPropagation()}
        data-oid="2r4n-hv"
      >
        <div
          className="relative h-full w-full"
          style={{
            transform:
              "rotateX(calc(var(--preview-tilt-x, 0deg) * var(--preview-tilt-scale, 1))) rotateY(calc(var(--preview-tilt-y, 0deg) * var(--preview-tilt-scale, 1)))",
            transformStyle: "preserve-3d",
            transition: "transform 120ms ease-out",
          }}
          data-oid="qwd4gor"
        >
          <div
            className="absolute -inset-[clamp(1.25rem,2.7vw,1.5rem)] rounded-[2rem] bg-[var(--preview-orbit-glow)] blur-[clamp(2rem,5vw,2.5rem)]"
            data-oid="xkiq63w"
          />
          <div
            className="absolute -inset-[clamp(0.78rem,1.8vw,1rem)] rounded-[1.875rem] shadow-[var(--preview-orbit-shadow)]"
            data-oid="ch3s5ae"
          />
          <PreviewPedestal />
          <PreviewScreen showLabel={showLabel}>{children}</PreviewScreen>
        </div>
      </div>
    </div>
  );
}

function PreviewScreen({
  showLabel,
  children,
}: {
  showLabel: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="relative h-full w-full [transform-style:preserve-3d]"
      style={{ "--t-unit": "0.6vmin" } as React.CSSProperties}
      data-oid="_y1x2bh"
    >
      {Array.from({ length: 9 }, (_, index) => (
        <div
          key={index}
          className="pointer-events-none absolute inset-0 rounded-[1.625rem] bg-transparent border border-[var(--preview-depth-border)]"
          style={{ transform: `translateZ(calc(var(--t-unit)*-${index + 1}))` }}
          data-oid="27s5zdz"
        />
      ))}
      <div
        className="pointer-events-none absolute inset-0 rounded-[1.625rem] bg-transparent shadow-[var(--preview-depth-shadow)] [transform:translateZ(calc(var(--t-unit)*-10))]"
        data-oid="evrzy6x"
      >
        <div
          className="absolute inset-0 rounded-[1.625rem] ring-1 ring-[var(--preview-depth-ring)]"
          data-oid="zbnocm."
        />
      </div>

      <div
        className="relative h-full w-full overflow-hidden rounded-[1.625rem] border border-[var(--preview-screen-border)] bg-transparent backdrop-blur-md shadow-2xl [transform:translateZ(0rem)]"
        data-oid="-z5gcd."
      >
        {showLabel ? <PreviewLabel /> : null}
        {children}
      </div>
    </div>
  );
}

function PreviewLabel() {
  return (
    <div
      data-testid="preview-stage-label"
      className="pointer-events-none absolute left-[clamp(1.2rem,3vw,2.5rem)] top-[clamp(0.6rem,1.6vw,1.2rem)] z-[100] [transform:translateZ(3.75rem)]"
      data-oid="bpc3euq"
    >
      <div
        className="text-[clamp(0.7rem,1.8vw,1.1rem)] font-semibold uppercase tracking-[0.35em] text-[var(--preview-label-text-solid)] drop-shadow-[var(--preview-label-text-shadow)]"
        data-oid="o306q7e"
      >
        SSTV
      </div>
      <div
        className="mt-[clamp(0.1rem,0.4vw,0.25rem)] h-[clamp(0.12rem,0.3vw,0.18rem)] w-[clamp(2.8rem,7vw,4.6rem)] rounded-full bg-[var(--preview-label-bar)] shadow-[var(--preview-label-bar-shadow)]"
        data-oid="f320-zy"
      />
    </div>
  );
}

function PreviewPedestal() {
  return (
    <div
      data-testid="preview-pedestal"
      className="preview-rainbow-pedestal pointer-events-none absolute left-1/2 top-full -translate-x-1/2 translate-y-[clamp(0.12rem,0.4vw,0.3rem)] [transform-style:preserve-3d]"
    >
      <div
        data-testid="preview-pedestal-spine"
        className="previewPedestalSpine relative mx-auto h-[clamp(0.72rem,1.8vw,1.25rem)] w-[clamp(1.8rem,4.4vw,2.9rem)] rounded-[clamp(0.28rem,0.7vw,0.45rem)]"
      >
        <div className="previewPedestalSpineDepth absolute inset-x-[clamp(0.1rem,0.3vw,0.18rem)] top-full h-[clamp(0.26rem,0.8vw,0.44rem)] origin-top rounded-b-[clamp(0.22rem,0.55vw,0.36rem)]" />
        <div className="previewPedestalSpineHighlight absolute inset-[clamp(0.12rem,0.3vw,0.18rem)] rounded-[clamp(0.18rem,0.45vw,0.3rem)]" />
      </div>

      <div
        data-testid="preview-pedestal-foot"
        className="previewPedestalFoot relative mx-auto -mt-[clamp(0.08rem,0.25vw,0.16rem)] h-[clamp(0.55rem,1.25vw,0.82rem)] w-[clamp(5.8rem,13vw,7.8rem)] rounded-[clamp(0.65rem,1.5vw,1rem)]"
      >
        <div className="previewPedestalFootDepth absolute inset-x-[clamp(0.2rem,0.55vw,0.34rem)] top-[55%] h-[clamp(0.28rem,0.7vw,0.46rem)] rounded-b-full" />
        <div className="previewPedestalFootInner absolute inset-[clamp(0.11rem,0.3vw,0.18rem)] rounded-full" />
        <div className="previewPedestalFootSlot absolute left-1/2 top-[clamp(0.14rem,0.35vw,0.22rem)] h-[clamp(0.12rem,0.3vw,0.18rem)] w-[clamp(3.5rem,8vw,5.1rem)] -translate-x-1/2 rounded-full" />
      </div>

      <div className="previewPedestalShadow mx-auto -mt-[clamp(0.34rem,0.75vw,0.5rem)] h-[clamp(0.26rem,0.7vw,0.42rem)] w-[clamp(5.1rem,11vw,7rem)] rounded-full blur-[clamp(0.28rem,1vw,0.48rem)]" />
    </div>
  );
}
