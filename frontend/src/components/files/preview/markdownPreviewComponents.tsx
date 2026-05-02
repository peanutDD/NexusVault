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
      <p className="mb-3 text-[0.78rem] leading-6 text-[var(--preview-markdown-text)]" {...props} />
    ),
    ul: ({ ...props }) => (
      <ul className="mb-3 list-disc pl-5 text-[0.76rem] leading-6 text-[var(--preview-markdown-list)] marker:text-[var(--preview-markdown-li-marker)]" {...props} />
    ),
    ol: ({ ...props }) => (
      <ol className="mb-3 list-decimal pl-5 text-[0.76rem] leading-6 text-[var(--preview-markdown-list)] marker:text-[var(--preview-markdown-li-marker)]" {...props} />
    ),
    li: ({ ...props }) => <li className="mb-1.5" {...props} />,
    code: ({ inline, className, children, ...props }) =>
      inline ? (
        <code
          className="rounded px-1 py-0.5 text-[0.7rem] font-mono bg-[var(--preview-markdown-code-inline-bg)] text-[var(--preview-markdown-code-inline-text)] ring-1 ring-inset ring-[var(--preview-markdown-code-inline-ring)]"
          {...props}
        >
          {children as ReactNode}
        </code>
      ) : (
        <code
          className={`text-xs font-mono text-[var(--preview-markdown-code-text)] ${className ?? ""}`}
          {...props}
        >
          {children as ReactNode}
        </code>
      ),
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
          className="mb-3 overflow-auto rounded-md border border-[var(--preview-markdown-pre-border)] bg-[var(--preview-markdown-pre-bg)] p-3 text-xs font-mono text-[var(--preview-markdown-pre-text)]"
          {...props}
        >
          {children as ReactNode}
        </pre>
      );
    },
    blockquote: ({ ...props }) => (
      <blockquote className="mb-3 border-l-2 pl-3 text-[0.76rem] leading-6 italic border-[var(--preview-markdown-blockquote-border)] text-[var(--preview-markdown-blockquote-text)]" {...props} />
    ),
    a: ({ ...props }) => (
      <a
        className="text-[0.76rem] font-medium underline decoration-[0.08em] underline-offset-2 text-[var(--preview-markdown-link)] hover:text-[var(--preview-markdown-link-hover)]"
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
      <div className="mb-3 overflow-auto rounded-md border border-[var(--preview-markdown-table-border)]">
        <table className="min-w-full text-[0.72rem] text-[var(--preview-markdown-table-text)]" {...props} />
      </div>
    ),
    th: ({ ...props }) => (
      <th className="border-b px-2 py-1 text-left font-semibold border-[var(--preview-markdown-th-border)] bg-[var(--preview-markdown-th-bg)] text-[var(--preview-markdown-table-head-text)]" {...props} />
    ),
    td: ({ ...props }) => (
      <td className="border-b px-2 py-1 align-top border-[var(--preview-markdown-td-border)]" {...props} />
    ),
  };
}
