import { isValidElement, type ComponentProps, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import MarkdownCodeBlock from "./MarkdownCodeBlock";
import MarkdownHeading from "./MarkdownHeading";
import MarkdownImage from "./MarkdownImage";

type MarkdownComponents = NonNullable<
  ComponentProps<typeof ReactMarkdown>["components"]
>;

export function createMarkdownComponents(
  getHeadingId: (text: string) => string,
): MarkdownComponents {
  return {
    h1: ({ children, ...props }) => (
      <MarkdownHeading level={1} getHeadingId={getHeadingId} {...props}>
        {children as ReactNode}
      </MarkdownHeading>
    ),
    h2: ({ children, ...props }) => (
      <MarkdownHeading level={2} getHeadingId={getHeadingId} {...props}>
        {children as ReactNode}
      </MarkdownHeading>
    ),
    h3: ({ children, ...props }) => (
      <MarkdownHeading level={3} getHeadingId={getHeadingId} {...props}>
        {children as ReactNode}
      </MarkdownHeading>
    ),
    h4: ({ children, ...props }) => (
      <MarkdownHeading level={4} getHeadingId={getHeadingId} {...props}>
        {children as ReactNode}
      </MarkdownHeading>
    ),
    h5: ({ children, ...props }) => (
      <MarkdownHeading level={5} getHeadingId={getHeadingId} {...props}>
        {children as ReactNode}
      </MarkdownHeading>
    ),
    h6: ({ children, ...props }) => (
      <MarkdownHeading level={6} getHeadingId={getHeadingId} {...props}>
        {children as ReactNode}
      </MarkdownHeading>
    ),
    p: ({ ...props }) => (
      <p className="mb-[clamp(0.585rem,1.35vw,0.75rem)] text-[clamp(0.75rem,1.65vw,0.8rem)] leading-6 text-[var(--preview-markdown-text)]" {...props} />
    ),
    ul: ({ ...props }) => (
      <ul className="mb-[clamp(0.585rem,1.35vw,0.75rem)] list-disc pl-[clamp(1rem,2.25vw,1.25rem)] text-[clamp(0.74rem,1.55vw,0.78rem)] leading-6 text-[var(--preview-markdown-list)] marker:text-[var(--preview-markdown-li-marker)]" {...props} />
    ),
    ol: ({ ...props }) => (
      <ol className="mb-[clamp(0.585rem,1.35vw,0.75rem)] list-decimal pl-[clamp(1rem,2.25vw,1.25rem)] text-[clamp(0.74rem,1.55vw,0.78rem)] leading-6 text-[var(--preview-markdown-list)] marker:text-[var(--preview-markdown-li-marker)]" {...props} />
    ),
    li: ({ ...props }) => <li className="mb-[clamp(0.2925rem,0.675vw,0.375rem)]" {...props} />,
    code: ({ inline, className, children, ...props }) => {
      const isInlineCode =
        inline ?? (!className && !String(children).includes("\n"));

      return isInlineCode ? (
        <code
          className="rounded px-[clamp(0.195rem,0.45vw,0.25rem)] py-[clamp(0.0975rem,0.3vw,0.125rem)] text-[length:var(--font-size-ui-3xs)] font-mono [background:var(--preview-markdown-code-inline-bg)] text-[var(--preview-markdown-code-inline-text)] ring-1 ring-inset ring-[var(--preview-markdown-code-inline-ring)]"
          {...props}
        >
          {children as ReactNode}
        </code>
      ) : (
        <code
          className={`text-[clamp(0.68rem,1.6vw,0.75rem)] font-mono text-[var(--preview-markdown-code-text)] ${className ?? ""}`}
          {...props}
        >
          {children as ReactNode}
        </code>
      );
    },
    pre: ({ children, ...props }) => {
      const childNode = Array.isArray(children) ? children[0] : children;
      type CodeProps = { className?: string; children?: ReactNode };
      const child =
        isValidElement<CodeProps>(childNode) && childNode.type === "code"
          ? childNode
          : null;
      const className =
        typeof child?.props?.className === "string"
          ? child.props.className
          : undefined;
      const language =
        typeof className === "string"
          ? className.match(/language-([A-Za-z0-9_-]+)/)?.[1]
          : undefined;

      if (child) {
        return (
          <MarkdownCodeBlock
            language={language}
            codeClassName={className}
            code={child.props?.children}
          />
        );
      }
      return (
        <pre
          className="previewMarkdownPre mb-[clamp(0.585rem,1.35vw,0.75rem)] overflow-auto rounded-[clamp(0.3rem,0.8vw,0.375rem)] border border-[var(--preview-markdown-pre-border)] [background:var(--preview-markdown-pre-bg)] p-[clamp(0.585rem,1.35vw,0.75rem)] text-[clamp(0.68rem,1.6vw,0.75rem)] font-mono text-[var(--preview-markdown-pre-text)] shadow-[inset_0_1px_0_var(--preview-markdown-container-border)] backdrop-blur-xl"
          {...props}
        >
          {children as ReactNode}
        </pre>
      );
    },
    blockquote: ({ ...props }) => (
      <blockquote className="mb-[clamp(0.585rem,1.35vw,0.75rem)] border-l-2 pl-[clamp(0.585rem,1.35vw,0.75rem)] text-[clamp(0.74rem,1.55vw,0.78rem)] leading-6 italic border-[var(--preview-markdown-blockquote-border)] text-[var(--preview-markdown-blockquote-text)]" {...props} />
    ),
    a: ({ ...props }) => (
      <a
        className="text-[clamp(0.74rem,1.55vw,0.78rem)] font-medium underline decoration-[0.08em] underline-offset-2 text-[var(--preview-markdown-link)] hover:text-[var(--preview-markdown-link-hover)]"
        target="_blank"
        rel="noreferrer"
        {...props}
      />
    ),
    strong: ({ ...props }) => (
      <strong className="font-semibold text-[var(--preview-markdown-strong)]" {...props} />
    ),
    em: ({ ...props }) => <em className="text-[var(--preview-markdown-em)]" {...props} />,
    del: ({ ...props }) => <del className="text-[var(--preview-markdown-del)]" {...props} />,
    img: ({ src, ...props }) => (
      <MarkdownImage src={typeof src === "string" ? src : undefined} {...props} />
    ),
    table: ({ ...props }) => (
      <div className="previewMarkdownTableShell mb-[clamp(0.585rem,1.35vw,0.75rem)] overflow-auto rounded-[clamp(0.3rem,0.8vw,0.375rem)] border border-[var(--preview-markdown-table-border)] shadow-[inset_0_1px_0_var(--preview-markdown-container-border)] backdrop-blur-xl">
        <table className="min-w-full text-[clamp(0.7rem,1.45vw,0.74rem)] text-[var(--preview-markdown-table-text)]" {...props} />
      </div>
    ),
    th: ({ ...props }) => (
      <th className="border-b px-[clamp(0.39rem,0.9vw,0.5rem)] py-[clamp(0.195rem,0.45vw,0.25rem)] text-left font-semibold border-[var(--preview-markdown-th-border)] bg-[var(--preview-markdown-th-bg)] text-[var(--preview-markdown-table-head-text)]" {...props} />
    ),
    td: ({ ...props }) => (
      <td className="border-b px-[clamp(0.39rem,0.9vw,0.5rem)] py-[clamp(0.195rem,0.45vw,0.25rem)] align-top border-[var(--preview-markdown-td-border)]" {...props} />
    ),
  };
}
