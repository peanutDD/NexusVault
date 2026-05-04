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
    <div className="flex h-full w-full items-center justify-center pointer-events-none">
      <div
        className="pointer-events-auto h-[min(70vh,42rem)] w-[min(92vw,60rem)] overflow-hidden rounded-md border border-[var(--preview-markdown-container-border)] bg-[var(--preview-markdown-container-bg)] shadow-none"
        onClick={(e) => e.stopPropagation()}
      >
        <TextPanelToolbar lineCount={textContent.split("\n").length} />
        <div
          className={cn(
            "h-[calc(100%_-_3.5rem)] overflow-auto p-4 text-sm leading-relaxed",
            isMarkdown
              ? "bg-transparent text-[var(--preview-text-primary)]"
              : "text-[var(--preview-text-primary)]",
          )}
        >
          {isMarkdown ? (
            <Suspense fallback={<pre className="font-mono text-sm">Loading…</pre>}>
              <MarkdownPreview content={textContent} />
            </Suspense>
          ) : (
            <pre className="h-full overflow-auto text-sm leading-relaxed text-[var(--preview-text-primary)] whitespace-pre-wrap font-mono">
              {textContent}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function TextPanelToolbar({ lineCount }: { lineCount: number }) {
  return (
    <div className="border-b border-[var(--preview-text-toolbar-border)]">
      <div className="relative overflow-hidden bg-[var(--preview-text-toolbar-bg)] backdrop-blur-md">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[var(--preview-text-toolbar-topline)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-[var(--preview-text-toolbar-bottomline)]" />
        <div className="pointer-events-none absolute inset-0 bg-[var(--preview-text-toolbar-glow)]" />
        <div className="pointer-events-none absolute inset-0 opacity-90 [background:var(--preview-text-toolbar-ambient)]" />
        <div className="relative flex h-14 items-center justify-end px-[clamp(0.6rem,1.2vw,1rem)]">
          <span className="text-[clamp(0.5rem,0.45vw,0.65rem)] font-brand font-normal tracking-wider text-[var(--preview-text-muted)] drop-shadow-[var(--preview-text-toolbar-shadow)]">
            {lineCount} 行
          </span>
        </div>
      </div>
    </div>
  );
}
