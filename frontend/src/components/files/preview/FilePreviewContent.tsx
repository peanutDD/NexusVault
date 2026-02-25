/**
 * FilePreviewContent
 * 预览主内容区：加载态、错误态、图片/视频/音频/PDF/文本/Ugoira/不支持
 */

import { useState, lazy, Suspense } from 'react';
import { ResponsivePicture } from '../../common/ResponsivePicture';
import { formatFileSize } from '../../../utils/format';
import { getMimeTypeLabel, isGifType } from '../../../utils/mimeType';
import { cn } from '../../../utils/cn';
import { ErrorIcon, FileIcon, AudioIcon, SpinnerIcon } from './FilePreviewIcons';

// -------------------------------------------------------------------------
// 动态加载的预览组件（降低首屏体积）
// -------------------------------------------------------------------------
const MarkdownPreview = lazy(() => import('./MarkdownPreview'));
const PdfPreview = lazy(() => import('./PdfPreview'));

// -------------------------------------------------------------------------
// 预览内容区所需参数（由父层负责数据准备与状态控制）
// -------------------------------------------------------------------------
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
  // -----------------------------------------------------------------------
  // 仅用于 Markdown 的主题切换（不影响其他类型）
  // -----------------------------------------------------------------------
  const [markdownTheme, setMarkdownTheme] = useState<'dark' | 'light'>('dark');
  const isGif = isGifType(file.mime_type);
  const showImagePreview =
    (isImage && (blobUrl || gifFirstFrameUrl)) || (isGif && !blobUrl && gifFirstFrameUrl);
  const imagePreviewSrc = isGif && !blobUrl ? gifFirstFrameUrl : blobUrl ?? gifFirstFrameUrl;
  return (
    <div
      // 预览容器：统一处理视差透视与点击关闭
      // 注意：这里移除了 overflow-hidden，否则 3D 动画（如公转）超出容器时会被裁剪
      className="relative z-[3] flex min-h-0 flex-1 flex-col items-center justify-center pl-[clamp(4.5rem,13vw,7rem)] pr-[clamp(4.5rem,13vw,7rem)] py-[clamp(1rem,4vh,2.5rem)]"
      style={{ perspective: '1400px' }}
      onClick={onClose}
    >
      {/* ----------------------------- */}
      {/* 3D 视差承载层（只负责位移与旋转） */}
      {/* ----------------------------- */}
      <div
        className="relative h-[min(72vh,44rem)] w-[min(92vw,70rem)] pointer-events-auto"
        data-preview-content
        style={{
          // 由外层 3D 交互驱动，保持视差与拖拽时的整体位移
          transform:
            'translate3d(var(--preview-orbit-x, 0px), var(--preview-orbit-y, 0px), var(--preview-orbit-z, 0px)) rotateY(var(--preview-orbit-ry, 0deg)) rotateX(var(--preview-orbit-rx, 0deg))',
          transformStyle: 'preserve-3d',
          willChange: 'transform',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ----------------------------- */}
        {/* 视差倾斜层（鼠标轻微摆动） */}
        {/* ----------------------------- */}
        <div
          className="relative h-full w-full"
          style={{
            // 将倾斜缩放参数拆分到 CSS 变量，便于复用动画驱动
            transform:
              'rotateX(calc(var(--preview-tilt-x, 0deg) * var(--preview-tilt-scale, 1))) rotateY(calc(var(--preview-tilt-y, 0deg) * var(--preview-tilt-scale, 1)))',
            transformStyle: 'preserve-3d',
            transition: 'transform 120ms ease-out',
          }}
        >
          {/* 装饰光晕与描边，增强卡片层次 */}
          <div className="absolute -inset-6 rounded-[32px] bg-gradient-to-br from-cyan-400/20 via-transparent to-fuchsia-500/20 blur-2xl" />
          <div className="absolute -inset-4 rounded-[30px] border border-cyan-300/30 shadow-[0_0_40px_rgba(34,211,238,0.25)]" />
          <div className="pointer-events-none absolute left-1/2 top-full -translate-x-1/2 translate-y-[clamp(0.55rem,1.6vw,1rem)] [transform-style:preserve-3d]">
            {/* Neck Component */}
            <div className="relative mx-auto h-[clamp(1.2rem,3.2vw,2.1rem)] w-[clamp(1.6rem,3.8vw,2.5rem)] [transform-style:preserve-3d]">
              {/* Thickness layers for neck */}
              <div className="absolute inset-0 rounded-[clamp(0.32rem,0.8vw,0.5rem)] bg-transparent border border-slate-700/50 [transform:translateZ(-4px)]" />
              <div className="absolute inset-0 rounded-[clamp(0.32rem,0.8vw,0.5rem)] bg-transparent border border-slate-700/50 [transform:translateZ(-8px)]" />
              
              {/* Front Neck */}
              <div className="absolute inset-0 rounded-[clamp(0.32rem,0.8vw,0.5rem)] border border-emerald-300/45 bg-gradient-to-b from-emerald-200/40 via-emerald-300/20 to-emerald-500/40 shadow-[0_12px_24px_rgba(10,255,160,0.38)] [transform:translateZ(0px)]">
                <div className="absolute inset-[clamp(0.18rem,0.45vw,0.3rem)] rounded-[clamp(0.24rem,0.6vw,0.38rem)] border border-emerald-100/30 bg-gradient-to-br from-white/20 via-emerald-100/10 to-transparent" />
                <div className="absolute inset-x-[clamp(0.2rem,0.55vw,0.34rem)] bottom-[clamp(0.12rem,0.3vw,0.22rem)] h-[clamp(0.18rem,0.45vw,0.28rem)] rounded-full bg-emerald-900/40" />
              </div>
            </div>

            {/* Wide Base Component */}
            <div className="relative mx-auto -mt-[clamp(0.18rem,0.38vw,0.32rem)] h-[clamp(0.55rem,1.3vw,0.9rem)] w-[clamp(5.2rem,12.5vw,7rem)] [transform-style:preserve-3d]">
              {/* Thickness layers for wide base */}
              <div className="absolute inset-0 rounded-[clamp(0.7rem,1.6vw,1.1rem)] bg-transparent border border-slate-700/50 [transform:translateZ(-4px)]" />
              <div className="absolute inset-0 rounded-[clamp(0.7rem,1.6vw,1.1rem)] bg-transparent border border-slate-700/50 [transform:translateZ(-8px)]" />

              {/* Front Wide Base */}
              <div className="absolute inset-0 rounded-[clamp(0.7rem,1.6vw,1.1rem)] border border-emerald-200/35 bg-gradient-to-r from-emerald-400/40 via-emerald-200/40 to-emerald-400/40 shadow-[0_14px_28px_rgba(10,255,160,0.45)] [transform:translateZ(0px)]">
                <div className="absolute inset-[clamp(0.12rem,0.3vw,0.2rem)] rounded-[clamp(0.6rem,1.4vw,0.95rem)] border border-white/20 bg-gradient-to-r from-white/10 via-transparent to-white/5" />
                <div className="absolute left-1/2 top-0 h-[clamp(0.2rem,0.5vw,0.32rem)] w-[clamp(3.2rem,7.5vw,4.4rem)] -translate-x-1/2 rounded-b-full bg-emerald-600/40 blur-[clamp(4px,1vw,8px)]" />
              </div>
            </div>

            <div className="mx-auto -mt-[clamp(0.35rem,0.6vw,0.55rem)] h-[clamp(0.3rem,0.8vw,0.5rem)] w-[clamp(4.2rem,10vw,5.8rem)] rounded-full bg-emerald-300/25 blur-[clamp(6px,1.6vw,12px)]" />
          </div>
          <div className="relative h-full w-full [transform-style:preserve-3d]" style={{ '--t-unit': '0.6vmin' } as React.CSSProperties}>
            {/* ============================= */}
            {/* 3D 侧面与背板（模拟厚度 - 响应式） */}
            {/* ============================= */}
            {/* 侧面层叠 - 使用多个 translateZ 层模拟实体厚度 - 全透明玻璃边框 */}
            <div className="pointer-events-none absolute inset-0 rounded-[26px] bg-transparent [transform:translateZ(calc(var(--t-unit)*-1))] border border-white/10" />
            <div className="pointer-events-none absolute inset-0 rounded-[26px] bg-transparent [transform:translateZ(calc(var(--t-unit)*-2))] border border-white/10" />
            <div className="pointer-events-none absolute inset-0 rounded-[26px] bg-transparent [transform:translateZ(calc(var(--t-unit)*-3))] border border-white/10" />
            <div className="pointer-events-none absolute inset-0 rounded-[26px] bg-transparent [transform:translateZ(calc(var(--t-unit)*-4))] border border-white/10" />
            <div className="pointer-events-none absolute inset-0 rounded-[26px] bg-transparent [transform:translateZ(calc(var(--t-unit)*-5))] border border-white/10" />
            <div className="pointer-events-none absolute inset-0 rounded-[26px] bg-transparent [transform:translateZ(calc(var(--t-unit)*-6))] border border-white/10" />
            <div className="pointer-events-none absolute inset-0 rounded-[26px] bg-transparent [transform:translateZ(calc(var(--t-unit)*-7))] border border-white/10" />
            <div className="pointer-events-none absolute inset-0 rounded-[26px] bg-transparent [transform:translateZ(calc(var(--t-unit)*-8))] border border-white/10" />
            <div className="pointer-events-none absolute inset-0 rounded-[26px] bg-transparent [transform:translateZ(calc(var(--t-unit)*-9))] border border-white/10" />
            
            {/* 背板 - 最底层 - 全透明，仅保留边框 */}
            <div className="pointer-events-none absolute inset-0 rounded-[26px] bg-transparent shadow-[0_30px_90px_rgba(0,0,0,0.5)] [transform:translateZ(calc(var(--t-unit)*-10))]">
               <div className="absolute inset-0 rounded-[26px] ring-1 ring-white/10" />
            </div>

             {/* ============================= */}
             {/* 正面屏幕（内容区） */}
             {/* ============================= */}
            {/* 全透明背景，仅保留边框和模糊 */}
            <div className="relative h-full w-full overflow-hidden rounded-[26px] border border-white/20 bg-transparent backdrop-blur-md shadow-2xl [transform:translateZ(0px)]">

             {/* 浮空标签 - SSTV (赛博朋克风 + 响应式位置 - 右移) */}
             {!loading && !error && supported ? (
               <div className="pointer-events-none absolute left-[clamp(1.2rem,3vw,2.5rem)] top-[clamp(0.6rem,1.6vw,1.2rem)] z-[100] [transform:translateZ(60px)]">
                 <div className="text-[clamp(0.7rem,1.8vw,1.1rem)] font-semibold uppercase tracking-[0.35em] bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-500 bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">
                   SSTV
                 </div>
                 <div className="mt-[clamp(0.1rem,0.4vw,0.25rem)] h-[clamp(0.12rem,0.3vw,0.18rem)] w-[clamp(2.8rem,7vw,4.6rem)] rounded-full bg-gradient-to-r from-emerald-400/80 via-purple-500/80 to-emerald-400/80 shadow-[0_0_12px_rgba(16,255,160,0.4)]" />
               </div>
             ) : null}
      {/* ============================= */}
      {/* 加载与错误状态 */}
      {/* ============================= */}
      {loading ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-4" onClick={(e) => e.stopPropagation()}>
          <SpinnerIcon className="h-12 w-12 text-purple-500" />
          <span className="text-sm text-white/60">加载中…</span>
        </div>
      ) : null}

      {error && !loading ? (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-4 rounded-2xl bg-white/5 px-8 py-10 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 明确错误提示 + 快速关闭入口 */}
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
      ) : null}

      {/* ============================= */}
      {/* 支持的预览类型 */}
      {/* ============================= */}
      {!loading && !error && supported ? (
        <div className="relative flex h-full w-full items-center justify-center p-[clamp(1rem,3vw,2rem)]">
          {/* ----------------------------- */}
          {/* 图片 / GIF 首帧 */}
          {/* ----------------------------- */}
          {showImagePreview ? (
            <div className="relative flex h-full w-full min-h-0 items-center justify-center">
              <div
                ref={imageTransformRef}
                className={cn(
                  // 缩放与旋转由父层注入 transform，避免重新布局
                  'flex h-full w-full min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-lg origin-center transition-transform duration-500 ease-out cursor-pointer',
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                )}
              >
                <ResponsivePicture
                  src={imagePreviewSrc ?? ''}
                  alt={file.original_filename}
                  className="max-h-full max-w-full object-contain"
                  decoding="async"
                  fetchPriority="high"
                  onLoad={() => setImageLoaded(true)}
                  onError={onImageError}
                />
              </div>
              {/* 图片未完成解码时保持中心 Loading，避免抖动 */}
              {!imageLoaded ? (
                <div className="absolute flex items-center justify-center inset-0">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-purple-500" />
                </div>
              ) : null}
            </div>
          ) : null}

          {/* ----------------------------- */}
          {/* PDF（按需加载） */}
          {/* ----------------------------- */}
          {isPDF && blobUrl ? (
            <Suspense
              fallback={
                <div className="flex flex-col items-center gap-4">
                  <SpinnerIcon className="h-12 w-12 text-purple-500" />
                  <span className="text-sm text-white/60">加载 PDF…</span>
                </div>
              }
            >
              <PdfPreview
                blobUrl={blobUrl}
                title={file.original_filename}
                onClose={onClose}
              />
            </Suspense>
          ) : null}

          {/* ----------------------------- */}
          {/* 视频（含 HLS 回退逻辑） */}
          {/* ----------------------------- */}
          {isVideo && blobUrl ? (
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
          ) : null}

          {/* ----------------------------- */}
          {/* 音频（独立的交互卡片） */}
          {/* ----------------------------- */}
          {isAudio && blobUrl ? (
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
          ) : null}

          {/* ----------------------------- */}
          {/* 文本 / Markdown */}
          {/* ----------------------------- */}
          {isText && textContent !== null ? (
            <div className="flex h-full w-full items-center justify-center pointer-events-none">
              <div
                className="pointer-events-auto h-[min(70vh,42rem)] w-[min(92vw,60rem)] overflow-hidden rounded-xl bg-transparent shadow-none"
                onClick={(e) => e.stopPropagation()}
              >
                {/* 顶部信息栏：类型、主题与行数 */}
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 bg-slate-900/50 backdrop-blur-sm">
                  <span className="text-xs text-white/40">
                    {isMarkdown ? 'md' : file.mime_type}
                  </span>
                  <div className="flex items-center gap-3">
                    {isMarkdown ? (
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
                    ) : null}
                    <span className="text-xs text-white/40">
                      {textContent.split('\n').length} 行
                    </span>
                  </div>
                </div>
                {/* 正文区域：Markdown 渲染 or 原始文本 */}
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
          ) : null}
        </div>
      ) : null}

      {/* ============================= */}
      {/* 不支持预览 */}
      {/* ============================= */}
      {!loading && !error && !supported ? (
        <div className="flex h-full w-full items-center justify-center pointer-events-none">
          <article
            className="pointer-events-auto group relative rounded-md transition-colors bg-purple-900/40 backdrop-blur-md hover:bg-purple-800/50 max-w-[min(92vw,22rem)] scale-[2]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3">
              {/* 文件类型图标 */}
              <div className="relative mb-3 aspect-square overflow-hidden rounded-lg bg-black/20">
                <div className="flex h-full w-full items-center justify-center rounded overflow-hidden shrink-0 bg-purple-900/30">
                  <FileIcon />
                </div>
              </div>
              {/* 基础元信息：大小 / 类型 / 日期 */}
              <div className="flex w-full items-center justify-center">
                <div className="min-w-0 flex-1 space-y-0.5 text-center">
                  <p
                    className="truncate whitespace-nowrap text-[clamp(7px,2vw,9px)] font-medium text-white"
                    title={file.original_filename}
                  >
                    不支持预览
                  </p>
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
      ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
