/**
 * FilePreviewContent
 * 预览主内容区：加载态、错误态、图片/视频/音频/PDF/文本/Ugoira/不支持
 */

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';
import { apiPath } from '../../../config/env';
import { ResponsivePicture } from '../../common/ResponsivePicture';
import { formatFileSize } from '../../../utils/format';
import { getMimeTypeLabel } from '../../../utils/mimeType';
import { cn } from '../../../utils/cn';
import { ErrorIcon, FileIcon, AudioIcon } from './FilePreviewIcons';

interface MarkdownPreviewProps {
  content: string;
  theme: 'dark' | 'light';
}

function MarkdownPreview({ content, theme }: MarkdownPreviewProps) {
  const isDark = theme === 'dark';

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, rehypeHighlight]}
      components={{
        h1: ({ node, ...props }) => (
          <h1
            className={`mt-3 mb-1 text-sm font-semibold ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
            {...props}
          />
        ),
        h2: ({ node, ...props }) => (
          <h2
            className={`mt-3 mb-1 text-sm font-semibold ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
            {...props}
          />
        ),
        h3: ({ node, ...props }) => (
          <h3
            className={`mt-3 mb-1 text-sm font-semibold ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
            {...props}
          />
        ),
        h4: ({ node, ...props }) => (
          <h4
            className={`mt-3 mb-1 text-xs font-semibold ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
            {...props}
          />
        ),
        h5: ({ node, ...props }) => (
          <h5
            className={`mt-2 mb-1 text-xs font-semibold ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
            {...props}
          />
        ),
        h6: ({ node, ...props }) => (
          <h6
            className={`mt-2 mb-1 text-xs font-semibold ${
              isDark ? 'text-white/90' : 'text-slate-800'
            }`}
            {...props}
          />
        ),
        p: ({ node, ...props }) => (
          <p
            className={`mb-2 text-xs ${
              isDark ? 'text-gray-100' : 'text-slate-800'
            }`}
            {...props}
          />
        ),
        ul: ({ node, ...props }) => (
          <ul
            className={`mb-2 list-disc pl-5 text-xs ${
              isDark ? 'text-gray-100' : 'text-slate-800'
            }`}
            {...props}
          />
        ),
        ol: ({ node, ...props }) => (
          <ol
            className={`mb-2 list-decimal pl-5 text-xs ${
              isDark ? 'text-gray-100' : 'text-slate-800'
            }`}
            {...props}
          />
        ),
        li: ({ node, ...props }) => <li className="mb-1" {...props} />,
        code: ({ inline, className, children, ...props }) =>
          inline ? (
            <code
              className={`rounded px-1 py-0.5 text-[0.7rem] font-mono ${
                isDark
                  ? 'bg-black/40 text-purple-200'
                  : 'bg-slate-100 text-purple-700'
              }`}
              {...props}
            >
              {children}
            </code>
          ) : (
            // 对于代码块，只自定义 code，本身仍由 ReactMarkdown 包在 <pre> 里，
            // 避免在 <p> 里再嵌套 <pre> 导致 hydration 报错
            <code
              className={`text-xs font-mono ${
                isDark ? 'text-gray-100' : 'text-slate-50'
              } ${className ?? ''}`}
              {...props}
            >
              {children}
            </code>
          ),
        pre: ({ node, ...props }) => (
          <pre
            className={`mb-3 overflow-auto rounded-md p-3 text-xs font-mono ${
              isDark ? 'bg-black/40 text-gray-100' : 'bg-slate-900 text-slate-50'
            }`}
            {...props}
          />
        ),
        blockquote: ({ node, ...props }) => (
          <blockquote
            className={`mb-2 border-l-2 pl-3 text-xs ${
              isDark
                ? 'border-purple-400/60 text-gray-100/90'
                : 'border-purple-500/70 text-slate-800'
            }`}
            {...props}
          />
        ),
        a: ({ node, ...props }) => (
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
        img: ({ node, src, ...props }) => {
          const isAbsolute =
            typeof src === 'string' &&
            (src.startsWith('http://') || src.startsWith('https://'));

          const proxiedSrc =
            isAbsolute && typeof src === 'string'
              ? apiPath(`/proxy/image?url=${encodeURIComponent(src)}`)
              : src;

          // 对于 Markdown 中的 <img>：
          // - 保留作者在 Markdown 里写的宽高/样式（width/height/style）
          // - 同时限制最大宽高，避免超大外链图把整块内容撑满
          const { className, ...rest } = props as {
            className?: string;
            [key: string]: unknown;
          };

          return (
            <img
              src={proxiedSrc}
              loading="lazy"
              className={cn(
                'my-3 mx-auto block max-w-full max-h-[60vh] rounded-md border border-white/10 bg-black/20 object-contain',
                typeof className === 'string' ? className : undefined
              )}
              {...rest}
            />
          );
        },
        table: ({ node, ...props }) => (
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
        th: ({ node, ...props }) => (
          <th
            className={`border-b px-2 py-1 text-left font-semibold ${
              isDark
                ? 'border-white/10 bg-white/5'
                : 'border-slate-200 bg-slate-100'
            }`}
            {...props}
          />
        ),
        td: ({ node, ...props }) => (
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

export interface FilePreviewContentProps {
  file: {
    id: string;
    original_filename: string;
    mime_type: string;
    file_size: number;
    created_at: string;
  };
  loading: boolean;
  error: string | null;
  supported: boolean;
  isImage: boolean;
  isPDF: boolean;
  isMarkdown: boolean;
  isVideo: boolean;
  isAudio: boolean;
  isText: boolean;
  blobUrl: string | null;
  gifFirstFrameUrl: string | null;
  textContent: string | null;
  useHls: boolean;
  imageLoaded: boolean;
  imageTransformRef: React.RefObject<HTMLDivElement | null>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  loop: boolean;
  setImageLoaded: (v: boolean) => void;
  tryVideoAudioFallback: () => void;
  onImageError: () => void;
  onClose: () => void;
  formatDate: (dateStr: string) => string;
}

export function FilePreviewContent({
  file,
  loading,
  error,
  supported,
  isImage,
  isPDF,
  isMarkdown,
  isVideo,
  isAudio,
  isText,
  blobUrl,
  gifFirstFrameUrl,
  textContent,
  useHls,
  imageLoaded,
  imageTransformRef,
  videoRef,
  loop,
  setImageLoaded,
  tryVideoAudioFallback,
  onImageError,
  onClose,
  formatDate,
}: FilePreviewContentProps) {
  const [markdownTheme, setMarkdownTheme] = useState<'dark' | 'light'>('dark');
  return (
    <div
      className="relative z-0 flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden pl-[clamp(4.5rem,13vw,7rem)] pr-[clamp(4.5rem,13vw,7rem)] py-[clamp(1rem,4vh,2.5rem)]"
      onClick={onClose}
    >
      {loading && (
        <div className="flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/25 border-t-purple-500" />
          <span className="text-sm text-white/60">加载中…</span>
        </div>
      )}

      {error && !loading && (
        <div
          className="flex flex-col items-center gap-4 rounded-2xl bg-white/5 px-8 py-10 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
            <ErrorIcon />
          </div>
          <p className="text-lg text-white">{error}</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 rounded-full bg-white/10 px-6 py-2.5 text-sm text-white transition-colors hover:bg-white/20"
          >
            关闭
          </button>
        </div>
      )}

      {!loading && !error && supported && (
        <div className="flex min-h-0 w-full flex-1 items-center justify-center">
          {isImage && (blobUrl || gifFirstFrameUrl) && (
            <div className="relative flex h-full w-full min-h-0 items-center justify-center">
              <div
                ref={imageTransformRef}
                className={cn(
                  'flex h-full w-full min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-lg origin-center transition-transform duration-500 ease-out cursor-pointer',
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                )}
              >
                <ResponsivePicture
                  src={blobUrl ?? gifFirstFrameUrl ?? ''}
                  alt={file.original_filename}
                  className="max-h-full max-w-full object-contain"
                  decoding="async"
                  fetchPriority="high"
                  onLoad={() => setImageLoaded(true)}
                  onError={onImageError}
                />
              </div>
              {!imageLoaded && (
                <div className="absolute flex items-center justify-center inset-0">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-purple-500" />
                </div>
              )}
            </div>
          )}

          {isPDF && blobUrl && (
            <div className="flex h-full w-full min-h-0 items-center justify-center pointer-events-none">
              <div
                className="pointer-events-auto h-full max-h-full w-full max-w-full overflow-hidden rounded-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <iframe
                  src={blobUrl}
                  title={file.original_filename}
                  className="h-full w-full border-0 bg-white"
                />
              </div>
            </div>
          )}

          {isVideo && blobUrl && (
            <div className="flex h-full w-full min-h-0 items-center justify-center">
              <video
                ref={videoRef}
                key={blobUrl}
                src={useHls ? undefined : blobUrl}
                loop={loop}
                controls
                autoPlay
                preload="metadata"
                className="pointer-events-auto max-h-full max-w-full rounded-lg shadow-2xl object-contain cursor-pointer"
                onClick={(e) => e.stopPropagation()}
                onError={tryVideoAudioFallback}
              >
                <track kind="captions" />
                您的浏览器不支持视频播放
              </video>
            </div>
          )}

          {isAudio && blobUrl && (
            <div className="flex h-full w-full flex-col items-center justify-center pointer-events-none">
              <div
                className="pointer-events-auto flex flex-col items-center gap-6 rounded-2xl bg-white/5 px-12 py-10"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-purple-500/20">
                  <AudioIcon />
                </div>
                <audio
                  key={blobUrl}
                  src={blobUrl}
                  controls
                  autoPlay
                  className="w-80"
                  onError={tryVideoAudioFallback}
                >
                  您的浏览器不支持音频播放
                </audio>
              </div>
            </div>
          )}

          {isText && textContent !== null && (
            <div className="flex h-full w-full items-center justify-center pointer-events-none">
              <div
                className="pointer-events-auto h-[min(70vh,42rem)] w-[min(92vw,60rem)] overflow-hidden rounded-xl bg-gray-900/80 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
                  <span className="text-xs text-white/40">
                    {isMarkdown ? 'md' : file.mime_type}
                  </span>
                  <div className="flex items-center gap-3">
                    {isMarkdown && (
                      <div className="flex items-center gap-1 text-[0.7rem] text-white/50">
                        <span>主题</span>
                        <button
                          type="button"
                          className={cn(
                            'rounded-full px-2 py-0.5',
                            markdownTheme === 'dark'
                              ? 'bg-white/20 text-white'
                              : 'bg-transparent text-white/60 hover:bg-white/10'
                          )}
                          onClick={() => setMarkdownTheme('dark')}
                        >
                          深色
                        </button>
                        <button
                          type="button"
                          className={cn(
                            'rounded-full px-2 py-0.5',
                            markdownTheme === 'light'
                              ? 'bg-white/90 text-gray-900'
                              : 'bg-transparent text-white/60 hover:bg-white/10'
                          )}
                          onClick={() => setMarkdownTheme('light')}
                        >
                          浅色
                        </button>
                      </div>
                    )}
                    <span className="text-xs text-white/40">
                      {textContent.split('\n').length} 行
                    </span>
                  </div>
                </div>
                <div
                  className={cn(
                    'h-[calc(100%-40px)] overflow-auto p-4 text-sm leading-relaxed',
                    isMarkdown
                      ? markdownTheme === 'dark'
                        ? 'bg-transparent text-gray-100'
                        : 'bg-white text-slate-900'
                      : 'text-gray-100'
                  )}
                >
                  {isMarkdown ? (
                    <MarkdownPreview content={textContent} theme={markdownTheme} />
                  ) : (
                    <pre className="h-full overflow-auto text-sm leading-relaxed text-gray-200 whitespace-pre-wrap font-mono">
                      {textContent}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && !error && !supported && (
        <div className="flex h-full w-full items-center justify-center pointer-events-none">
          <article
            className="pointer-events-auto group relative rounded-md transition-colors bg-purple-900/40 backdrop-blur-md hover:bg-purple-800/50 max-w-[min(92vw,22rem)] scale-[2]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3">
              <div className="relative mb-3 aspect-square overflow-hidden rounded-lg bg-black/20">
                <div className="flex h-full w-full items-center justify-center rounded overflow-hidden shrink-0 bg-purple-900/30">
                  <FileIcon />
                </div>
              </div>
              <div className="flex w-full items-center justify-center">
                <div className="min-w-0 flex-1 space-y-0.5 text-center">
                  <h3
                    className="truncate whitespace-nowrap text-[clamp(7px,2vw,9px)] font-medium text-white"
                    title={file.original_filename}
                  >
                    不支持预览
                  </h3>
                  <p className="flex items-center justify-center gap-1 whitespace-nowrap text-[clamp(6px,1.6vw,7px)] text-gray-400">
                    <span>{formatFileSize(file.file_size)}</span>
                    <span className="h-0.5 w-0.5 rounded-full bg-gray-600" aria-hidden />
                    <span>{getMimeTypeLabel(file.mime_type, file.original_filename)}</span>
                  </p>
                  <p className="whitespace-nowrap text-[clamp(6px,1.6vw,7px)] text-gray-500">
                    {formatDate(file.created_at)}
                  </p>
                </div>
              </div>
            </div>
          </article>
        </div>
      )}
    </div>
  );
}
