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
  const sizeClass = level <= 3 ? "text-sm" : "text-xs";
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
      className={cn("group mt-3 mb-1 font-semibold", sizeClass, colorClass)}
      {...props}
    >
      {children}
      <a
        href={`#${id}`}
        className={cn(
          "ml-1 inline-flex select-none items-center opacity-0 transition-opacity group-hover:opacity-100",
          "text-[var(--preview-markdown-heading-link)] hover:text-[var(--preview-markdown-heading-link-hover)]",
        )}
        aria-label="Heading link"
      >
        #
      </a>
    </Tag>
  );
}
