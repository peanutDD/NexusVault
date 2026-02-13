import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { apiPath } from '../../../config/env';
import { cn } from '../../../utils/cn';

interface MarkdownPreviewProps {
  content: string;
  theme: 'dark' | 'light';
}

export default function MarkdownPreview({ content, theme }: MarkdownPreviewProps) {
  const isDark = theme === 'dark';

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        h1: ({ ...props }) => (
          <h1
            className={`mt-3 mb-1 text-sm font-semibold ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
            {...props}
          />
        ),
        h2: ({ ...props }) => (
          <h2
            className={`mt-3 mb-1 text-sm font-semibold ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
            {...props}
          />
        ),
        h3: ({ ...props }) => (
          <h3
            className={`mt-3 mb-1 text-sm font-semibold ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
            {...props}
          />
        ),
        h4: ({ ...props }) => (
          <h4
            className={`mt-3 mb-1 text-xs font-semibold ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
            {...props}
          />
        ),
        h5: ({ ...props }) => (
          <h5
            className={`mt-2 mb-1 text-xs font-semibold ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
            {...props}
          />
        ),
        h6: ({ ...props }) => (
          <h6
            className={`mt-2 mb-1 text-xs font-semibold ${
              isDark ? 'text-white/90' : 'text-slate-800'
            }`}
            {...props}
          />
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
                  ? 'bg-black/40 text-purple-200'
                  : 'bg-slate-100 text-purple-700'
              }`}
              {...props}
            >
              {safeChildren}
            </code>
          ) : (
            <code
              className={`text-xs font-mono ${
                isDark ? 'text-gray-100' : 'text-slate-50'
              } ${className ?? ''}`}
              {...props}
            >
              {safeChildren}
            </code>
          );
        },
        pre: ({ ...props }) => (
          <pre
            className={`mb-3 overflow-auto rounded-md p-3 text-xs font-mono ${
              isDark ? 'bg-black/40 text-gray-100' : 'bg-slate-900 text-slate-50'
            }`}
            {...props}
          />
        ),
        blockquote: ({ ...props }) => (
          <blockquote
            className={`mb-2 border-l-2 pl-3 text-xs ${
              isDark
                ? 'border-purple-400/60 text-gray-100/90'
                : 'border-purple-500/70 text-slate-800'
            }`}
            {...props}
          />
        ),
        a: ({ ...props }) => (
          <a
            className={`text-xs underline ${
              isDark
                ? 'text-sky-300 hover:text-sky-200'
                : 'text-sky-600 hover:text-sky-500'
            }`}
            target="_blank"
            rel="noreferrer"
            {...props}
          />
        ),
        img: ({ src, ...props }) => {
          const isAbsolute =
            typeof src === 'string' &&
            (src.startsWith('http://') || src.startsWith('https://'));

          const proxiedSrc =
            isAbsolute && typeof src === 'string'
              ? apiPath(`/proxy/image?url=${encodeURIComponent(src)}`)
              : src;

          const { className, ...rest } = props as {
            className?: string;
            [key: string]: unknown;
          };

          const resolvedSrc = typeof proxiedSrc === 'string' ? proxiedSrc : undefined;

          return (
            <img
              src={resolvedSrc}
              loading="lazy"
              className={cn(
                'my-3 mx-auto block max-w-full max-h-[60vh] rounded-md border border-white/10 bg-black/20 object-contain',
                typeof className === 'string' ? className : undefined
              )}
              {...rest}
            />
          );
        },
        table: ({ ...props }) => (
          <div
            className={`mb-3 overflow-auto rounded-md border ${
              isDark ? 'border-white/10' : 'border-slate-200'
            }`}
          >
            <table
              className={`min-w-full text-[0.7rem] ${
                isDark ? 'text-gray-100' : 'text-slate-800'
              }`}
              {...props}
            />
          </div>
        ),
        th: ({ ...props }) => (
          <th
            className={`border-b px-2 py-1 text-left font-semibold ${
              isDark
                ? 'border-white/10 bg-white/5'
                : 'border-slate-200 bg-slate-100'
            }`}
            {...props}
          />
        ),
        td: ({ ...props }) => (
          <td
            className={`border-b px-2 py-1 align-top ${
              isDark ? 'border-white/5' : 'border-slate-200'
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
