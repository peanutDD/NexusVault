import type { ReactNode } from "react";

interface FilePreviewStageProps {
  showLabel: boolean;
  onClose: () => void;
  children: ReactNode;
}

export default function FilePreviewStage({
  showLabel,
  onClose,
  children,
}: FilePreviewStageProps) {
  return (
    <div
      className="relative z-[3] flex min-h-0 flex-1 flex-col items-center justify-center pl-[clamp(4.5rem,13vw,7rem)] pr-[clamp(4.5rem,13vw,7rem)] py-[clamp(1rem,4vh,2.5rem)]"
      style={{ perspective: "1400px" }}
      onClick={onClose}
      data-oid="wc3_jmf"
    >
      <div
        className="relative h-[min(72vh,44rem)] w-[min(92vw,70rem)] pointer-events-auto"
        data-preview-content
        style={{
          transform:
            "translate3d(var(--preview-orbit-x, 0px), var(--preview-orbit-y, 0px), var(--preview-orbit-z, 0px)) rotateY(var(--preview-orbit-ry, 0deg)) rotateX(var(--preview-orbit-rx, 0deg))",
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
            className="absolute -inset-6 rounded-[32px] bg-[var(--preview-orbit-glow)] blur-2xl"
            data-oid="xkiq63w"
          />
          <div
            className="absolute -inset-4 rounded-[30px] shadow-[var(--preview-orbit-shadow)]"
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
          className="pointer-events-none absolute inset-0 rounded-[26px] bg-transparent border border-[var(--preview-depth-border)]"
          style={{ transform: `translateZ(calc(var(--t-unit)*-${index + 1}))` }}
          data-oid="27s5zdz"
        />
      ))}
      <div
        className="pointer-events-none absolute inset-0 rounded-[26px] bg-transparent shadow-[var(--preview-depth-shadow)] [transform:translateZ(calc(var(--t-unit)*-10))]"
        data-oid="evrzy6x"
      >
        <div
          className="absolute inset-0 rounded-[26px] ring-1 ring-[var(--preview-depth-ring)]"
          data-oid="zbnocm."
        />
      </div>

      <div
        className="relative h-full w-full overflow-hidden rounded-[26px] border border-[var(--preview-screen-border)] bg-transparent backdrop-blur-md shadow-2xl [transform:translateZ(0px)]"
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
      className="pointer-events-none absolute left-[clamp(1.2rem,3vw,2.5rem)] top-[clamp(0.6rem,1.6vw,1.2rem)] z-[100] [transform:translateZ(60px)]"
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
    <div className="preview-rainbow-pedestal pointer-events-none absolute left-1/2 top-full -translate-x-1/2 translate-y-[clamp(0.55rem,1.6vw,1rem)] [transform-style:preserve-3d]">
      <div className="relative mx-auto h-[clamp(1.2rem,3.2vw,2.1rem)] w-[clamp(1.6rem,3.8vw,2.5rem)] [transform-style:preserve-3d]">
        {[-4, -8].map((z) => (
          <div
            key={z}
            className="absolute inset-0 rounded-[clamp(0.32rem,0.8vw,0.5rem)] bg-transparent border border-[var(--preview-shell-border)]"
            style={{ transform: `translateZ(${z}px)` }}
          />
        ))}
        <div className="absolute inset-0 rounded-[clamp(0.32rem,0.8vw,0.5rem)] border border-[var(--preview-neck-front-border)] bg-[var(--preview-neck-front-bg)] shadow-[var(--preview-neck-front-shadow)] [transform:translateZ(0px)]">
          <div className="absolute inset-[clamp(0.18rem,0.45vw,0.3rem)] rounded-[clamp(0.24rem,0.6vw,0.38rem)] border border-[var(--preview-neck-inner-border)] bg-[var(--preview-neck-inner-bg)]" />
          <div className="absolute inset-x-[clamp(0.2rem,0.55vw,0.34rem)] bottom-[clamp(0.12rem,0.3vw,0.22rem)] h-[clamp(0.18rem,0.45vw,0.28rem)] rounded-full bg-[var(--preview-neck-bottom-bg)]" />
        </div>
      </div>

      <div className="relative mx-auto -mt-[clamp(0.18rem,0.38vw,0.32rem)] h-[clamp(0.55rem,1.3vw,0.9rem)] w-[clamp(5.2rem,12.5vw,7rem)] [transform-style:preserve-3d]">
        {[-4, -8].map((z) => (
          <div
            key={z}
            className="absolute inset-0 rounded-[clamp(0.7rem,1.6vw,1.1rem)] bg-transparent border border-[var(--preview-shell-border)]"
            style={{ transform: `translateZ(${z}px)` }}
          />
        ))}
        <div className="absolute inset-0 rounded-[clamp(0.7rem,1.6vw,1.1rem)] border border-[var(--preview-base-border)] bg-[var(--preview-base-bg)] shadow-[var(--preview-base-shadow)] [transform:translateZ(0px)]">
          <div className="absolute inset-[clamp(0.12rem,0.3vw,0.2rem)] rounded-[clamp(0.6rem,1.4vw,0.95rem)] border border-[var(--preview-base-inner-border)] bg-[var(--preview-base-inner-bg)]" />
          <div className="absolute left-1/2 top-0 h-[clamp(0.2rem,0.5vw,0.32rem)] w-[clamp(3.2rem,7.5vw,4.4rem)] -translate-x-1/2 rounded-b-full bg-[var(--preview-base-top-glow)] blur-[clamp(4px,1vw,8px)]" />
        </div>
      </div>

      <div className="mx-auto -mt-[clamp(0.35rem,0.6vw,0.55rem)] h-[clamp(0.3rem,0.8vw,0.5rem)] w-[clamp(4.2rem,10vw,5.8rem)] rounded-full bg-[var(--preview-base-ambient)] blur-[clamp(6px,1.6vw,12px)]" />
    </div>
  );
}
