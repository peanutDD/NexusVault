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
  theme: 'dark';
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

export default function MarkdownPreview({ content, theme }: MarkdownPreviewProps) {
  const isDark = theme === 'dark';
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
          <Heading
            level={1}
            isDark={isDark}
            getHeadingId={getHeadingId}
            {...props}
          >
            {children as ReactNode}
          </Heading>
        ),
        h2: ({ children, ...props }) => (
          <Heading
            level={2}
            isDark={isDark}
            getHeadingId={getHeadingId}
            {...props}
          >
            {children as ReactNode}
          </Heading>
        ),
        h3: ({ children, ...props }) => (
          <Heading
            level={3}
            isDark={isDark}
            getHeadingId={getHeadingId}
            {...props}
          >
            {children as ReactNode}
          </Heading>
        ),
        h4: ({ children, ...props }) => (
          <Heading
            level={4}
            isDark={isDark}
            getHeadingId={getHeadingId}
            {...props}
          >
            {children as ReactNode}
          </Heading>
        ),
        h5: ({ children, ...props }) => (
          <Heading
            level={5}
            isDark={isDark}
            getHeadingId={getHeadingId}
            {...props}
          >
            {children as ReactNode}
          </Heading>
        ),
        h6: ({ children, ...props }) => (
          <Heading
            level={6}
            isDark={isDark}
            getHeadingId={getHeadingId}
            {...props}
          >
            {children as ReactNode}
          </Heading>
        ),
        p: ({ ...props }) => (
          <p
            className={`mb-2 text-xs ${
              isDark ? 'text-gray-100' : 'text-slate-800'
            }`}
            {...props}
          />
        ),
        ul: ({ ...props }) => (
          <ul
            className={`mb-2 list-disc pl-5 text-xs ${
              isDark ? 'text-gray-100' : 'text-slate-800'
            }`}
            {...props}
          />
        ),
        ol: ({ ...props }) => (
          <ol
            className={`mb-2 list-decimal pl-5 text-xs ${
              isDark ? 'text-gray-100' : 'text-slate-800'
            }`}
            {...props}
          />
        ),
        li: ({ ...props }) => <li className="mb-1" {...props} />,
        code: ({ inline, className, children, ...props }) => {
          const safeChildren = children as ReactNode;
          return inline ? (
            <code
              className={`rounded px-1 py-0.5 text-[0.7rem] font-mono ${
                isDark
                  ? 'bg-emerald-400/10 text-emerald-200 ring-1 ring-inset ring-emerald-400/20'
                  : 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200'
              }`}
              {...props}
            >
              {safeChildren}
            </code>
          ) : (
            <code
              className={`text-xs font-mono ${
                isDark ? 'text-emerald-50/95' : 'text-slate-900'
              } ${className ?? ''}`}
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
                isDark={isDark}
                language={language}
                codeClassName={className}
                code={codeChildren}
              />
            );
          }
          return (
            <pre
              className={`mb-3 overflow-auto rounded-md p-3 text-xs font-mono ${
                isDark
                  ? 'border border-emerald-400/25 bg-gradient-to-br from-emerald-950/50 via-slate-950/60 to-indigo-950/50 text-emerald-50/95'
                  : 'border border-emerald-200 bg-gradient-to-br from-slate-100 via-emerald-50 to-cyan-100 text-slate-900'
              }`}
              {...props}
            >
              {children as ReactNode}
            </pre>
          );
        },
        blockquote: ({ ...props }) => (
          <blockquote
            className={`mb-2 border-l-2 pl-3 text-xs ${
              isDark
                ? 'border-emerald-400/60 text-emerald-50/90'
                : 'border-emerald-500/70 text-slate-800'
            }`}
            {...props}
          />
        ),
        a: ({ ...props }) => (
          <a
            className={`text-xs underline ${
              isDark
                ? 'text-emerald-300 hover:text-cyan-200'
                : 'text-emerald-700 hover:text-cyan-600'
            }`}
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
                isDark ? 'border-emerald-400/20 bg-emerald-950/10' : 'border-emerald-200 bg-white',
                typeof className === 'string' ? className : undefined
              )}
              {...rest}
            />
          );
        },
        table: ({ ...props }) => (
          <div
            className={`mb-3 overflow-auto rounded-md border ${
              isDark ? 'border-emerald-400/20' : 'border-emerald-200'
            }`}
          >
            <table
              className={`min-w-full text-[0.7rem] ${
                isDark ? 'text-emerald-50/90' : 'text-slate-800'
              }`}
              {...props}
            />
          </div>
        ),
        th: ({ ...props }) => (
          <th
            className={`border-b px-2 py-1 text-left font-semibold ${
              isDark
                ? 'border-emerald-400/20 bg-emerald-400/10'
                : 'border-emerald-200 bg-emerald-50'
            }`}
            {...props}
          />
        ),
        td: ({ ...props }) => (
          <td
            className={`border-b px-2 py-1 align-top ${
              isDark ? 'border-emerald-400/10' : 'border-emerald-100'
            }`}
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
  isDark,
  getHeadingId,
  children,
  ...props
}: {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  isDark: boolean;
  getHeadingId: (text: string) => string;
  children: ReactNode;
  [key: string]: unknown;
}) {
  const text = toPlainText(children);
  const id = getHeadingId(text);
  const Tag = `h${level}` as const;
  const sizeClass =
    level <= 3 ? 'text-sm' : 'text-xs';
  const colorClass = isDark ? 'text-emerald-50' : 'text-slate-900';

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
          isDark ? 'text-emerald-300/50 hover:text-cyan-200' : 'text-emerald-600/70 hover:text-cyan-600'
        )}
        aria-label="Heading link"
      >
        #
      </a>
    </Tag>
  );
}

function CodeBlock({
  isDark,
  language,
  codeClassName,
  code,
}: {
  isDark: boolean;
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
        isDark
          ? 'border-emerald-400/25 bg-gradient-to-br from-emerald-950/50 via-slate-950/60 to-indigo-950/50'
          : 'border-emerald-200 bg-gradient-to-br from-slate-100 via-emerald-50 to-cyan-100'
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between gap-3 px-3 py-2',
          isDark
            ? 'bg-gradient-to-r from-emerald-400/10 via-cyan-400/10 to-fuchsia-400/10'
            : 'bg-gradient-to-r from-emerald-600/10 via-cyan-600/10 to-fuchsia-600/10'
        )}
      >
        <span
          className={cn(
            'rounded px-2 py-1 text-[0.7rem] font-mono',
            isDark
              ? 'bg-emerald-400/10 text-emerald-100/80'
              : 'bg-emerald-500/10 text-emerald-800/80'
          )}
        >
          {language ?? 'text'}
        </span>
        <button
          type="button"
          onClick={() => void copy(rawText)}
          className={cn(
            'rounded px-2 py-1 text-[0.7rem] transition-colors',
            isDark
              ? copied
                ? 'bg-emerald-400/25 text-emerald-100'
                : 'bg-emerald-400/15 text-emerald-100/85 hover:bg-emerald-400/25 hover:text-emerald-50'
              : copied
                ? 'bg-emerald-600/15 text-emerald-800'
                : 'bg-emerald-600/10 text-emerald-800/80 hover:bg-emerald-600/15 hover:text-emerald-900'
          )}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre
        className={cn(
          'overflow-auto p-3 text-xs font-mono',
          isDark ? 'text-emerald-50/95' : 'text-slate-900'
        )}
      >
        <code className={codeClassName} style={{ background: 'transparent' }}>
          {code}
        </code>
      </pre>
    </div>
  );
}
