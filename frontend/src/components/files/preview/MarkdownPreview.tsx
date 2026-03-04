import { type ReactNode, isValidElement } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { defaultSchema } from 'hast-util-sanitize';
import 'highlight.js/styles/github-dark.css';
import { apiPath } from '../../../config/env';
import { cn } from '../../../utils/cn';
import { useClipboard } from '../../../hooks/useClipboard';

interface MarkdownPreviewProps {
  content: string;
}

function toPlainText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(toPlainText).join('');
  if (typeof node === 'object' && 'props' in node) {
    const el = node as unknown as { props?: { children?: ReactNode } };
    return toPlainText(el.props?.children);
  }
  return '';
}

function slugifyHeading(text: string): string {
  const base = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'section';
}

const markdownSanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    a: [
      ...(defaultSchema.attributes?.a ?? []),
      'href',
      'title',
      'target',
      'rel',
      'className',
    ],
    img: [
      ...(defaultSchema.attributes?.img ?? []),
      'src',
      'alt',
      'title',
      'className',
    ],
    code: [...(defaultSchema.attributes?.code ?? []), 'className'],
    pre: [...(defaultSchema.attributes?.pre ?? []), 'className'],
    span: [...(defaultSchema.attributes?.span ?? []), 'className'],
    h1: [...(defaultSchema.attributes?.h1 ?? []), 'id', 'className'],
    h2: [...(defaultSchema.attributes?.h2 ?? []), 'id', 'className'],
    h3: [...(defaultSchema.attributes?.h3 ?? []), 'id', 'className'],
    h4: [...(defaultSchema.attributes?.h4 ?? []), 'id', 'className'],
    h5: [...(defaultSchema.attributes?.h5 ?? []), 'id', 'className'],
    h6: [...(defaultSchema.attributes?.h6 ?? []), 'id', 'className'],
    p: [...(defaultSchema.attributes?.p ?? []), 'className'],
    table: [...(defaultSchema.attributes?.table ?? []), 'className'],
    th: [...(defaultSchema.attributes?.th ?? []), 'className'],
    td: [...(defaultSchema.attributes?.td ?? []), 'className'],
  },
};

export default function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const headingCounts = new Map<string, number>();
  const getHeadingId = (text: string) => {
    const base = slugifyHeading(text);
    const count = headingCounts.get(base) ?? 0;
    headingCounts.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[
        rehypeRaw,
        rehypeSanitize(markdownSanitizeSchema),
        [rehypeHighlight, { detect: true, ignoreMissing: true }],
      ]}
      components={{
        h1: ({ children, ...props }) => (
          <Heading level={1} getHeadingId={getHeadingId} {...props}>
            {children as ReactNode}
          </Heading>
        ),
        h2: ({ children, ...props }) => (
          <Heading level={2} getHeadingId={getHeadingId} {...props}>
            {children as ReactNode}
          </Heading>
        ),
        h3: ({ children, ...props }) => (
          <Heading level={3} getHeadingId={getHeadingId} {...props}>
            {children as ReactNode}
          </Heading>
        ),
        h4: ({ children, ...props }) => (
          <Heading level={4} getHeadingId={getHeadingId} {...props}>
            {children as ReactNode}
          </Heading>
        ),
        h5: ({ children, ...props }) => (
          <Heading level={5} getHeadingId={getHeadingId} {...props}>
            {children as ReactNode}
          </Heading>
        ),
        h6: ({ children, ...props }) => (
          <Heading level={6} getHeadingId={getHeadingId} {...props}>
            {children as ReactNode}
          </Heading>
        ),
        p: ({ ...props }) => (
          <p className="mb-2 text-xs text-[var(--preview-markdown-text)]" {...props} />
        ),
        ul: ({ ...props }) => (
          <ul className="mb-2 list-disc pl-5 text-xs text-[var(--preview-markdown-text)]" {...props} />
        ),
        ol: ({ ...props }) => (
          <ol className="mb-2 list-decimal pl-5 text-xs text-[var(--preview-markdown-text)]" {...props} />
        ),
        li: ({ ...props }) => <li className="mb-1" {...props} />,
        code: ({ inline, className, children, ...props }) => {
          const safeChildren = children as ReactNode;
          return inline ? (
            <code
              className="rounded px-1 py-0.5 text-[0.7rem] font-mono bg-[var(--preview-markdown-code-inline-bg)] text-[var(--preview-markdown-code-inline-text)] ring-1 ring-inset ring-[var(--preview-markdown-code-inline-ring)]"
              {...props}
            >
              {safeChildren}
            </code>
          ) : (
            <code
              className={`text-xs font-mono text-[var(--preview-markdown-code-text)] ${className ?? ''}`}
              {...props}
            >
              {safeChildren}
            </code>
          );
        },
        pre: ({ children, ...props }) => {
          const childNode = Array.isArray(children) ? children[0] : children;
          type CodeProps = { className?: string; children?: ReactNode };
          const child = isValidElement<CodeProps>(childNode) && childNode.type === 'code' ? childNode : null;
          const className = typeof child?.props?.className === 'string' ? child.props.className : undefined;
          const language =
            typeof className === 'string' ? className.match(/language-([A-Za-z0-9_-]+)/)?.[1] : undefined;
          const codeChildren = child?.props?.children;
          if (child) {
            return (
              <CodeBlock
                language={language}
                codeClassName={className}
                code={codeChildren}
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
          <blockquote
            className="mb-2 border-l-2 pl-3 text-xs border-[var(--preview-markdown-blockquote-border)] text-[var(--preview-markdown-blockquote-text)]"
            {...props}
          />
        ),
        a: ({ ...props }) => (
          <a
            className="text-xs underline text-[var(--preview-markdown-link)] hover:text-[var(--preview-markdown-link-hover)]"
            target="_blank"
            rel="noreferrer"
            {...props}
          />
        ),
        img: ({ src, ...props }) => {
          const raw = typeof src === 'string' ? src : '';
          const normalized = raw
            .trim()
            .replace(/^([`'"]+)([\s\S]*?)\1$/, '$2')
            .trim();

          const isAbsolute =
            normalized.startsWith('http://') || normalized.startsWith('https://');

          const proxiedSrc =
            isAbsolute ? apiPath(`/proxy/image?url=${encodeURIComponent(normalized)}`) : normalized;

          const { className, ...rest } = props as {
            className?: string;
            [key: string]: unknown;
          };

          const resolvedSrc = proxiedSrc ? proxiedSrc : undefined;

          return (
            <img
              src={resolvedSrc}
              loading="lazy"
              className={cn(
                'my-3 mx-auto block max-w-full max-h-[60vh] rounded-md border object-contain',
                'border-[var(--preview-markdown-img-border)] bg-[var(--preview-markdown-img-bg)]',
                typeof className === 'string' ? className : undefined
              )}
              {...rest}
            />
          );
        },
        table: ({ ...props }) => (
          <div
            className="mb-3 overflow-auto rounded-md border border-[var(--preview-markdown-table-border)]"
          >
            <table
              className="min-w-full text-[0.7rem] text-[var(--preview-markdown-table-text)]"
              {...props}
            />
          </div>
        ),
        th: ({ ...props }) => (
          <th
            className="border-b px-2 py-1 text-left font-semibold border-[var(--preview-markdown-th-border)] bg-[var(--preview-markdown-th-bg)]"
            {...props}
          />
        ),
        td: ({ ...props }) => (
          <td
            className="border-b px-2 py-1 align-top border-[var(--preview-markdown-td-border)]"
            {...props}
          />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function Heading({
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
  const sizeClass =
    level <= 3 ? 'text-sm' : 'text-xs';
  const colorClass = 'text-[var(--preview-markdown-heading)]';

  return (
    <Tag
      id={id}
      className={cn('group mt-3 mb-1 font-semibold', sizeClass, colorClass)}
      {...props}
    >
      {children}
      <a
        href={`#${id}`}
        className={cn(
          'ml-1 inline-flex select-none items-center opacity-0 transition-opacity group-hover:opacity-100',
          'text-[var(--preview-markdown-heading-link)] hover:text-[var(--preview-markdown-heading-link-hover)]'
        )}
        aria-label="Heading link"
      >
        #
      </a>
    </Tag>
  );
}

function CodeBlock({
  language,
  codeClassName,
  code,
}: {
  language?: string;
  codeClassName?: string;
  code: ReactNode;
}) {
  const { copy, copied } = useClipboard();
  const rawText = toPlainText(code).replace(/\n$/, '');

  return (
    <div
      className={cn(
        'mb-3 overflow-hidden rounded-md border',
        'border-[var(--preview-markdown-codeblock-border)] bg-[var(--preview-markdown-codeblock-bg)]'
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between gap-3 px-3 py-2',
          'bg-[var(--preview-markdown-codeblock-header-bg)]'
        )}
      >
        <span
          className={cn(
            'rounded px-2 py-1 text-[0.7rem] font-mono',
            'bg-[var(--preview-markdown-codeblock-label-bg)] text-[var(--preview-markdown-codeblock-label-text)]'
          )}
        >
          {language ?? 'text'}
        </span>
        <button
          type="button"
          onClick={() => void copy(rawText)}
          className={cn(
            'rounded px-2 py-1 text-[0.7rem] transition-colors',
            copied
              ? 'bg-[var(--preview-markdown-codeblock-btn-copied-bg)] text-[var(--preview-markdown-codeblock-btn-copied-text)]'
              : 'bg-[var(--preview-markdown-codeblock-btn-bg)] text-[var(--preview-markdown-codeblock-btn-text)] hover:bg-[var(--preview-markdown-codeblock-btn-hover-bg)] hover:text-[var(--preview-markdown-codeblock-btn-hover-text)]'
          )}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre
        className={cn(
          'overflow-auto p-3 text-xs font-mono',
          'text-[var(--preview-markdown-code-text)]'
        )}
      >
        <code className={codeClassName} style={{ background: 'transparent' }}>
          {code}
        </code>
      </pre>
    </div>
  );
}
