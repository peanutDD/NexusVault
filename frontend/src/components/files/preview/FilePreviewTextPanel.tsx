import { lazy, Suspense } from "react";
import { cn } from "../../../utils/cn";

const MarkdownPreview = lazy(() => import("./MarkdownPreview"));

interface FilePreviewTextPanelProps {
  isMarkdown: boolean;
  textContent: string;
}

export default function FilePreviewTextPanel({
  isMarkdown,
  textContent,
}: FilePreviewTextPanelProps) {
  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 items-center justify-center pointer-events-none"
      data-testid="preview-text-panel-frame"
    >
      <div
        className="previewTextPanel pointer-events-auto h-full min-h-0 w-full max-h-full max-w-[var(--app-preview-text-panel-max-width)] overflow-hidden rounded-[clamp(0.3rem,0.8vw,0.375rem)] border border-[var(--preview-markdown-container-border)] [background:var(--preview-markdown-container-bg)] shadow-none"
        onClick={(e) => e.stopPropagation()}
        data-testid="preview-text-panel"
      >
        <TextPanelToolbar
          isMarkdown={isMarkdown}
          lineCount={textContent.split("\n").length}
        />
        <div
          data-testid="preview-text-scroll"
          className={cn(
            "previewTextScroll h-[calc(100%_-_clamp(3.656rem,6.63vw,3.9rem))] overflow-auto p-[clamp(0.78rem,1.8vw,1rem)] text-[clamp(0.75rem,1.8vw,0.875rem)] leading-relaxed",
            isMarkdown
              ? "bg-transparent text-[var(--preview-text-primary)]"
              : "text-[var(--preview-text-primary)]",
          )}
        >
          {isMarkdown ? (
            <Suspense fallback={<pre className="font-mono text-[clamp(0.75rem,1.8vw,0.875rem)]">Loading…</pre>}>
              <MarkdownPreview content={textContent} />
            </Suspense>
          ) : (
            <pre className="previewTextPre h-full overflow-auto text-[clamp(0.75rem,1.8vw,0.875rem)] leading-relaxed text-[var(--preview-text-primary)] whitespace-pre-wrap font-mono">
              {textContent}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function TextPanelToolbar({
  isMarkdown,
  lineCount,
}: {
  isMarkdown: boolean;
  lineCount: number;
}) {
  const badge = isMarkdown ? "MD" : "TXT";

  return (
    <div className="border-b border-[var(--preview-text-toolbar-border)]">
      <div className="relative overflow-hidden [background:var(--preview-text-toolbar-bg)] backdrop-blur-md">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[var(--preview-text-toolbar-topline)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[clamp(0.0975rem,0.3vw,0.125rem)] bg-[var(--preview-text-toolbar-bottomline)]" />
        <div className="pointer-events-none absolute inset-0 bg-[var(--preview-text-toolbar-glow)]" />
        <div className="pointer-events-none absolute inset-0 opacity-90 [background:var(--preview-text-toolbar-ambient)]" />
        <div
          data-testid="preview-text-toolbar"
          className="relative flex h-[clamp(3.656rem,6.63vw,3.9rem)] items-center justify-between gap-[clamp(0.78rem,1.8vw,1rem)] px-[clamp(0.9rem,2vw,1.25rem)]"
        >
          <div
            data-testid="preview-text-toolbar-system"
            className="flex min-w-0 items-center gap-[clamp(0.58rem,1.35vw,0.75rem)]"
          >
            <span
              data-testid="preview-text-toolbar-system-label"
              className="font-brand whitespace-nowrap bg-[image:var(--preview-label-text)] bg-clip-text text-[clamp(0.72rem,1.6vw,0.9rem)] font-semibold uppercase leading-none tracking-[0.34em] text-transparent drop-shadow-[var(--preview-label-text-shadow)]"
            >
              SSTV
            </span>
            <span className="h-[clamp(1.35rem,3vw,1.75rem)] w-px shrink-0 bg-[var(--preview-text-toolbar-rule)]" />
          </div>
          <div
            data-testid="preview-text-toolbar-rule"
            className="h-px flex-1 rounded-full bg-[var(--preview-text-toolbar-rule)] opacity-70"
          />
          <div
            data-testid="preview-text-toolbar-meta"
            className="flex shrink-0 items-center gap-[clamp(0.36rem,0.82vw,0.48rem)]"
          >
            <span
              data-testid="preview-text-toolbar-line-count"
              className="previewTextMetaCapsule font-brand inline-flex h-[clamp(0.845rem,1.8vw,0.995rem)] shrink-0 items-center rounded-full border border-[var(--preview-counter-border)] [background:var(--preview-counter-bg)] px-[clamp(0.42rem,0.9vw,0.52rem)] shadow-[var(--preview-counter-shadow)]"
            >
              <span
                data-testid="preview-text-toolbar-line-count-text"
                className="bg-[image:var(--preview-label-text)] bg-clip-text text-[clamp(0.46rem,0.95vw,0.54rem)] font-medium leading-none tracking-wide text-transparent drop-shadow-[var(--preview-label-text-shadow)]"
              >
                {lineCount} 行
              </span>
            </span>
            <span
              data-testid="preview-text-toolbar-mark"
              className="previewTextMetaCapsule font-brand inline-flex h-[clamp(0.845rem,1.8vw,0.995rem)] min-w-[clamp(1.55rem,3.25vw,1.8rem)] shrink-0 items-center justify-center rounded-full border border-[var(--preview-counter-border)] [background:var(--preview-counter-bg)] px-[clamp(0.38rem,0.82vw,0.48rem)] shadow-[var(--preview-counter-shadow)]"
            >
              <span
                data-testid="preview-text-toolbar-mark-text"
                className="bg-[image:var(--preview-label-text)] bg-clip-text text-[clamp(0.46rem,0.95vw,0.54rem)] font-semibold leading-none tracking-wide text-transparent drop-shadow-[var(--preview-label-text-shadow)]"
              >
                {badge}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
