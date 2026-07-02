import type { ReactNode } from "react";
import { cn } from "../../../utils/cn";
import { useClipboard } from "../../../hooks/useClipboard";
import { toPlainText } from "./markdownPreviewUtils";

export default function MarkdownCodeBlock({
  language,
  codeClassName,
  code,
}: {
  language?: string;
  codeClassName?: string;
  code: ReactNode;
}) {
  const { copy, copied } = useClipboard();
  const rawText = toPlainText(code).replace(/\n$/, "");

  return (
    <div
      className={cn(
        "neu-inset previewMarkdownCodeBlock mb-[clamp(0.585rem,1.35vw,0.75rem)] overflow-hidden rounded-[clamp(0.3rem,0.8vw,0.375rem)] border-0",
      )}
      data-testid="markdown-code-block"
    >
      <div
        className={cn(
          "flex items-center justify-between gap-[clamp(0.585rem,1.35vw,0.75rem)] px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)]",
          "bg-transparent",
        )}
      >
        <span
          className={cn(
            "rounded px-[clamp(0.39rem,0.9vw,0.5rem)] py-[clamp(0.195rem,0.45vw,0.25rem)] text-[length:var(--font-size-ui-3xs)] font-mono",
            "neu-inset text-[var(--preview-markdown-codeblock-label-text)]",
          )}
        >
          {language ?? "text"}
        </span>
        <button
          type="button"
          onClick={() => void copy(rawText)}
          className={cn(
            "rounded px-[clamp(0.39rem,0.9vw,0.5rem)] py-[clamp(0.195rem,0.45vw,0.25rem)] text-[length:var(--font-size-ui-3xs)] transition-colors",
            copied
              ? "neu-pressed text-[var(--preview-markdown-codeblock-btn-copied-text)]"
              : "neu-raised-sm text-[var(--preview-markdown-codeblock-btn-text)] hover:text-[var(--preview-markdown-codeblock-btn-hover-text)]",
          )}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="previewMarkdownCodeScroll overflow-auto p-[clamp(0.585rem,1.35vw,0.75rem)] text-[clamp(0.68rem,1.6vw,0.75rem)] font-mono text-[var(--preview-markdown-code-text)]">
        <code className={codeClassName} style={{ background: "transparent" }}>
          {code}
        </code>
      </pre>
    </div>
  );
}
