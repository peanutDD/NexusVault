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
        "mb-3 overflow-hidden rounded-md border",
        "border-[var(--preview-markdown-codeblock-border)] bg-[var(--preview-markdown-codeblock-bg)]",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-3 px-3 py-2",
          "bg-[var(--preview-markdown-codeblock-header-bg)]",
        )}
      >
        <span
          className={cn(
            "rounded px-2 py-1 text-[0.7rem] font-mono",
            "bg-[var(--preview-markdown-codeblock-label-bg)] text-[var(--preview-markdown-codeblock-label-text)]",
          )}
        >
          {language ?? "text"}
        </span>
        <button
          type="button"
          onClick={() => void copy(rawText)}
          className={cn(
            "rounded px-2 py-1 text-[0.7rem] transition-colors",
            copied
              ? "bg-[var(--preview-markdown-codeblock-btn-copied-bg)] text-[var(--preview-markdown-codeblock-btn-copied-text)]"
              : "bg-[var(--preview-markdown-codeblock-btn-bg)] text-[var(--preview-markdown-codeblock-btn-text)] hover:bg-[var(--preview-markdown-codeblock-btn-hover-bg)] hover:text-[var(--preview-markdown-codeblock-btn-hover-text)]",
          )}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-auto p-3 text-xs font-mono text-[var(--preview-markdown-code-text)]">
        <code className={codeClassName} style={{ background: "transparent" }}>
          {code}
        </code>
      </pre>
    </div>
  );
}
