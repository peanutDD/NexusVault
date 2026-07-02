import type { ReactNode } from "react";
import { cn } from "../../../utils/cn";
import { toPlainText } from "./markdownPreviewUtils";

export default function MarkdownHeading({
  level,
  getHeadingId,
  children,
  ...props
}: {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  getHeadingId: (text: string) => string;
  children: ReactNode;
  [key: string]: unknown;
}) {
  const text = toPlainText(children);
  const id = getHeadingId(text);
  const Tag = `h${level}` as const;
  const sizeClass = level <= 3 ? "text-[clamp(0.75rem,1.8vw,0.875rem)]" : "text-[clamp(0.68rem,1.6vw,0.75rem)]";
  const colorClass =
    level === 1
      ? "text-[var(--preview-markdown-h1)]"
      : level === 2
        ? "text-[var(--preview-markdown-h2)]"
        : level === 3
          ? "text-[var(--preview-markdown-h3)]"
          : level === 4
            ? "text-[var(--preview-markdown-h4)]"
            : level === 5
              ? "text-[var(--preview-markdown-h5)]"
              : "text-[var(--preview-markdown-h6)]";

  return (
    <Tag
      id={id}
      className={cn("group mt-[clamp(0.585rem,1.35vw,0.75rem)] mb-[clamp(0.195rem,0.45vw,0.25rem)] font-semibold", sizeClass, colorClass)}
      {...props}
    >
      {children}
      <a
        href={`#${id}`}
        className={cn(
          "ml-[clamp(0.195rem,0.45vw,0.25rem)] inline-flex select-none items-center opacity-0 transition-opacity group-hover:opacity-100",
          "text-[var(--preview-markdown-heading-link)] hover:text-[var(--preview-markdown-heading-link-hover)]",
        )}
        aria-label="Heading link"
      >
        #
      </a>
    </Tag>
  );
}
