/**
 * FilePreviewContent
 * 预览主内容区：加载态、错误态、图片/视频/音频/PDF/文本/Ugoira/不支持
 */

import { lazy, Suspense, useEffect, useState } from "react";
import { ResponsivePicture } from "../../common/ResponsivePicture";
import { formatFileSize } from "../../../utils/format";
import { getMimeTypeLabel, isGifType } from "../../../utils/mimeType";
import { cn } from "../../../utils/cn";
import {
  ErrorIcon,
  FileIcon,
  AudioIcon,
  SpinnerIcon,
} from "./FilePreviewIcons";

// -------------------------------------------------------------------------
// 动态加载的预览组件（降低首屏体积）
// -------------------------------------------------------------------------
const MarkdownPreview = lazy(() => import("./MarkdownPreview"));
const PdfPreview = lazy(() => import("./PdfPreview"));

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
  const [videoReady, setVideoReady] = useState(false);
  useEffect(() => {
    setVideoReady(false);
  }, [blobUrl, isVideo, useHls]);
  const isGif = isGifType(file.mime_type);
  const showImagePreview =
    (isImage && (blobUrl || gifFirstFrameUrl)) ||
    (isGif && !blobUrl && gifFirstFrameUrl);
  const imagePreviewSrc =
    isGif && !blobUrl ? gifFirstFrameUrl : (blobUrl ?? gifFirstFrameUrl);
  return (
    <div
      // 预览容器：统一处理视差透视与点击关闭
      // 注意：这里移除了 overflow-hidden，否则 3D 动画（如公转）超出容器时会被裁剪
      className="relative z-[3] flex min-h-0 flex-1 flex-col items-center justify-center pl-[clamp(4.5rem,13vw,7rem)] pr-[clamp(4.5rem,13vw,7rem)] py-[clamp(1rem,4vh,2.5rem)]"
      style={{ perspective: "1400px" }}
      onClick={onClose}
      data-oid="wc3_jmf"
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
            "translate3d(var(--preview-orbit-x, 0px), var(--preview-orbit-y, 0px), var(--preview-orbit-z, 0px)) rotateY(var(--preview-orbit-ry, 0deg)) rotateX(var(--preview-orbit-rx, 0deg))",
          transformStyle: "preserve-3d",
          willChange: "transform",
        }}
        onClick={(e) => e.stopPropagation()}
        data-oid="2r4n-hv"
      >
        {/* ----------------------------- */}
        {/* 视差倾斜层（鼠标轻微摆动） */}
        {/* ----------------------------- */}
        <div
          className="relative h-full w-full"
          style={{
            // 将倾斜缩放参数拆分到 CSS 变量，便于复用动画驱动
            transform:
              "rotateX(calc(var(--preview-tilt-x, 0deg) * var(--preview-tilt-scale, 1))) rotateY(calc(var(--preview-tilt-y, 0deg) * var(--preview-tilt-scale, 1)))",
            transformStyle: "preserve-3d",
            transition: "transform 120ms ease-out",
          }}
          data-oid="qwd4gor"
        >
          {/* 装饰光晕与描边，增强卡片层次 */}
          <div
            className="absolute -inset-6 rounded-[32px] bg-[var(--preview-orbit-glow)] blur-2xl"
            data-oid="xkiq63w"
          />

          <div
            className="absolute -inset-4 rounded-[30px] shadow-[var(--preview-orbit-shadow)]"
            data-oid="ch3s5ae"
          />

          <div
            className="preview-rainbow-pedestal pointer-events-none absolute left-1/2 top-full -translate-x-1/2 translate-y-[clamp(0.55rem,1.6vw,1rem)] [transform-style:preserve-3d]"
            data-oid="vp:mjap"
          >
            {/* Neck Component */}
            <div
              className="relative mx-auto h-[clamp(1.2rem,3.2vw,2.1rem)] w-[clamp(1.6rem,3.8vw,2.5rem)] [transform-style:preserve-3d]"
              data-oid="vau2.7."
            >
              {/* Thickness layers for neck */}
              <div
                className="absolute inset-0 rounded-[clamp(0.32rem,0.8vw,0.5rem)] bg-transparent border border-[var(--preview-shell-border)] [transform:translateZ(-4px)]"
                data-oid="0:fgate"
              />

              <div
                className="absolute inset-0 rounded-[clamp(0.32rem,0.8vw,0.5rem)] bg-transparent border border-[var(--preview-shell-border)] [transform:translateZ(-8px)]"
                data-oid="v7:un0l"
              />

              {/* Front Neck */}
              <div
                className="absolute inset-0 rounded-[clamp(0.32rem,0.8vw,0.5rem)] border border-[var(--preview-neck-front-border)] bg-[var(--preview-neck-front-bg)] shadow-[var(--preview-neck-front-shadow)] [transform:translateZ(0px)]"
                data-oid="oj:u3wt"
              >
                <div
                  className="absolute inset-[clamp(0.18rem,0.45vw,0.3rem)] rounded-[clamp(0.24rem,0.6vw,0.38rem)] border border-[var(--preview-neck-inner-border)] bg-[var(--preview-neck-inner-bg)]"
                  data-oid="634mi7s"
                />

                <div
                  className="absolute inset-x-[clamp(0.2rem,0.55vw,0.34rem)] bottom-[clamp(0.12rem,0.3vw,0.22rem)] h-[clamp(0.18rem,0.45vw,0.28rem)] rounded-full bg-[var(--preview-neck-bottom-bg)]"
                  data-oid="wycil24"
                />
              </div>
            </div>

            {/* Wide Base Component */}
            <div
              className="relative mx-auto -mt-[clamp(0.18rem,0.38vw,0.32rem)] h-[clamp(0.55rem,1.3vw,0.9rem)] w-[clamp(5.2rem,12.5vw,7rem)] [transform-style:preserve-3d]"
              data-oid="_7-13m."
            >
              {/* Thickness layers for wide base */}
              <div
                className="absolute inset-0 rounded-[clamp(0.7rem,1.6vw,1.1rem)] bg-transparent border border-[var(--preview-shell-border)] [transform:translateZ(-4px)]"
                data-oid="0ll0:pl"
              />

              <div
                className="absolute inset-0 rounded-[clamp(0.7rem,1.6vw,1.1rem)] bg-transparent border border-[var(--preview-shell-border)] [transform:translateZ(-8px)]"
                data-oid="6sybl4o"
              />

              {/* Front Wide Base */}
              <div
                className="absolute inset-0 rounded-[clamp(0.7rem,1.6vw,1.1rem)] border border-[var(--preview-base-border)] bg-[var(--preview-base-bg)] shadow-[var(--preview-base-shadow)] [transform:translateZ(0px)]"
                data-oid="fz.7z9t"
              >
                <div
                  className="absolute inset-[clamp(0.12rem,0.3vw,0.2rem)] rounded-[clamp(0.6rem,1.4vw,0.95rem)] border border-[var(--preview-base-inner-border)] bg-[var(--preview-base-inner-bg)]"
                  data-oid="l38d-6x"
                />

                <div
                  className="absolute left-1/2 top-0 h-[clamp(0.2rem,0.5vw,0.32rem)] w-[clamp(3.2rem,7.5vw,4.4rem)] -translate-x-1/2 rounded-b-full bg-[var(--preview-base-top-glow)] blur-[clamp(4px,1vw,8px)]"
                  data-oid="lj:03_9"
                />
              </div>
            </div>

            <div
              className="mx-auto -mt-[clamp(0.35rem,0.6vw,0.55rem)] h-[clamp(0.3rem,0.8vw,0.5rem)] w-[clamp(4.2rem,10vw,5.8rem)] rounded-full bg-[var(--preview-base-ambient)] blur-[clamp(6px,1.6vw,12px)]"
              data-oid="uvx2y7n"
            />
          </div>
          <div
            className="relative h-full w-full [transform-style:preserve-3d]"
            style={{ "--t-unit": "0.6vmin" } as React.CSSProperties}
            data-oid="_y1x2bh"
          >
            {/* ============================= */}
            {/* 3D 侧面与背板（模拟厚度 - 响应式） */}
            {/* ============================= */}
            {/* 侧面层叠 - 使用多个 translateZ 层模拟实体厚度 - 全透明玻璃边框 */}
            <div
              className="pointer-events-none absolute inset-0 rounded-[26px] bg-transparent [transform:translateZ(calc(var(--t-unit)*-1))] border border-[var(--preview-depth-border)]"
              data-oid="27s5zdz"
            />

            <div
              className="pointer-events-none absolute inset-0 rounded-[26px] bg-transparent [transform:translateZ(calc(var(--t-unit)*-2))] border border-[var(--preview-depth-border)]"
              data-oid="u825.m-"
            />

            <div
              className="pointer-events-none absolute inset-0 rounded-[26px] bg-transparent [transform:translateZ(calc(var(--t-unit)*-3))] border border-[var(--preview-depth-border)]"
              data-oid="9_b7rbs"
            />

            <div
              className="pointer-events-none absolute inset-0 rounded-[26px] bg-transparent [transform:translateZ(calc(var(--t-unit)*-4))] border border-[var(--preview-depth-border)]"
              data-oid="bo213kw"
            />

            <div
              className="pointer-events-none absolute inset-0 rounded-[26px] bg-transparent [transform:translateZ(calc(var(--t-unit)*-5))] border border-[var(--preview-depth-border)]"
              data-oid="3.62zo-"
            />

            <div
              className="pointer-events-none absolute inset-0 rounded-[26px] bg-transparent [transform:translateZ(calc(var(--t-unit)*-6))] border border-[var(--preview-depth-border)]"
              data-oid="1adlk0u"
            />

            <div
              className="pointer-events-none absolute inset-0 rounded-[26px] bg-transparent [transform:translateZ(calc(var(--t-unit)*-7))] border border-[var(--preview-depth-border)]"
              data-oid="q-d2pw2"
            />

            <div
              className="pointer-events-none absolute inset-0 rounded-[26px] bg-transparent [transform:translateZ(calc(var(--t-unit)*-8))] border border-[var(--preview-depth-border)]"
              data-oid="u8ii0uv"
            />

            <div
              className="pointer-events-none absolute inset-0 rounded-[26px] bg-transparent [transform:translateZ(calc(var(--t-unit)*-9))] border border-[var(--preview-depth-border)]"
              data-oid="svolvoe"
            />

            {/* 背板 - 最底层 - 全透明，仅保留边框 */}
            <div
              className="pointer-events-none absolute inset-0 rounded-[26px] bg-transparent shadow-[var(--preview-depth-shadow)] [transform:translateZ(calc(var(--t-unit)*-10))]"
              data-oid="evrzy6x"
            >
              <div
                className="absolute inset-0 rounded-[26px] ring-1 ring-[var(--preview-depth-ring)]"
                data-oid="zbnocm."
              />
            </div>

            {/* ============================= */}
            {/* 正面屏幕（内容区） */}
            {/* ============================= */}
            {/* 全透明背景，仅保留边框和模糊 */}
            <div
              className="relative h-full w-full overflow-hidden rounded-[26px] border border-[var(--preview-screen-border)] bg-transparent backdrop-blur-md shadow-2xl [transform:translateZ(0px)]"
              data-oid="-z5gcd."
            >
              {/* 浮空标签 - SSTV (赛博朋克风 + 响应式位置 - 右移) */}
              {!loading && !error && supported ? (
                <div
                  className="pointer-events-none absolute left-[clamp(1.2rem,3vw,2.5rem)] top-[clamp(0.6rem,1.6vw,1.2rem)] z-[100] [transform:translateZ(60px)]"
                  data-oid="bpc3euq"
                >
                  <div
                    className="text-[clamp(0.7rem,1.8vw,1.1rem)] font-semibold uppercase tracking-[0.35em] text-[var(--preview-label-text-solid)] drop-shadow-[var(--preview-label-text-shadow)]"
                    data-oid="o306q7e"
                  >
                    SSTV
                  </div>
                  <div
                    className="mt-[clamp(0.1rem,0.4vw,0.25rem)] h-[clamp(0.12rem,0.3vw,0.18rem)] w-[clamp(2.8rem,7vw,4.6rem)] rounded-full bg-[var(--preview-label-bar)] shadow-[var(--preview-label-bar-shadow)]"
                    data-oid="f320-zy"
                  />
                </div>
              ) : null}
              {/* ============================= */}
              {/* 加载与错误状态 */}
              {/* ============================= */}
              {loading ? (
                <div
                  className="flex h-full w-full flex-col items-center justify-center gap-4"
                  onClick={(e) => e.stopPropagation()}
                  data-oid="5aue1pr"
                >
                  <SpinnerIcon
                    className="h-12 w-12 text-[var(--preview-spinner)]"
                    data-oid="uavs90."
                  />

                  <span
                    className="text-sm text-[var(--preview-text-muted)]"
                    data-oid="kt5lscf"
                  >
                    加载中…
                  </span>
                </div>
              ) : null}

              {error && !loading ? (
                <div
                  className="flex h-full w-full flex-col items-center justify-center gap-4 rounded-2xl bg-[var(--preview-surface-soft)] px-8 py-10 text-center"
                  onClick={(e) => e.stopPropagation()}
                  data-oid="qocbftt"
                >
                  {/* 明确错误提示 + 快速关闭入口 */}
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--preview-error-icon-bg)]"
                    data-oid="c.t6alo"
                  >
                    <ErrorIcon data-oid="z2lzoc8" />
                  </div>
                  <p
                    className="text-lg text-[var(--preview-text-primary)]"
                    data-oid="3f477th"
                  >
                    {error}
                  </p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-2 rounded-full bg-[var(--preview-action-bg)] px-6 py-2.5 text-sm text-[var(--preview-text-primary)] transition-colors hover:bg-[var(--preview-action-bg-hover)]"
                    data-oid="l_pzhja"
                  >
                    关闭
                  </button>
                </div>
              ) : null}

              {/* ============================= */}
              {/* 支持的预览类型 */}
              {/* ============================= */}
              {!loading && !error && supported ? (
                <div
                  className="relative flex h-full w-full items-center justify-center p-[clamp(1rem,3vw,2rem)]"
                  data-oid="a0dxp_q"
                >
                  {/* ----------------------------- */}
                  {/* 图片 / GIF 首帧 */}
                  {/* ----------------------------- */}
                  {showImagePreview ? (
                    <div
                      className="relative flex h-full w-full min-h-0 items-center justify-center"
                      data-oid="nkhpa89"
                    >
                      <div
                        ref={imageTransformRef}
                        className={cn(
                          // 缩放与旋转由父层注入 transform，避免重新布局
                          "flex h-full w-full min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-lg origin-center transition-transform duration-500 ease-out cursor-pointer",
                          imageLoaded ? "opacity-100" : "opacity-0",
                        )}
                        data-oid="7dzq3rw"
                      >
                        <ResponsivePicture
                          src={imagePreviewSrc ?? ""}
                          alt={file.original_filename}
                          className="max-h-full max-w-full object-contain"
                          decoding="async"
                          fetchPriority="high"
                          onLoad={() => setImageLoaded(true)}
                          onError={onImageError}
                          data-oid="2j7js_c"
                        />
                      </div>
                      {/* 图片未完成解码时保持中心 Loading，避免抖动 */}
                      {!imageLoaded ? (
                        <div
                          className="absolute flex items-center justify-center inset-0"
                          data-oid="uk1f569"
                        >
                          <div
                            className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--preview-loading-border)] border-t-[var(--preview-loading-border-top)]"
                            data-oid="rk.oeiq"
                          />
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
                        <div
                          className="flex flex-col items-center gap-4"
                          data-oid="1wyaub2"
                        >
                          <SpinnerIcon
                            className="h-12 w-12 text-[var(--preview-spinner)]"
                            data-oid="d9ly4my"
                          />

                          <span
                            className="text-sm text-[var(--preview-text-muted)]"
                            data-oid="vr:uuey"
                          >
                            加载 PDF…
                          </span>
                        </div>
                      }
                      data-oid="6yxe8he"
                    >
                      <PdfPreview
                        blobUrl={blobUrl}
                        title={file.original_filename}
                        onClose={onClose}
                        data-oid="pb57mmw"
                      />
                    </Suspense>
                  ) : null}

                  {/* ----------------------------- */}
                  {/* 视频（含 HLS 回退逻辑） */}
                  {/* ----------------------------- */}
                  {isVideo && blobUrl ? (
                    <div
                      className="relative flex h-full w-full min-h-0 items-center justify-center"
                      data-oid="9_brskc"
                    >
                      {!videoReady && (
                        <div
                          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-transparent"
                          data-oid="2j7pt_5"
                        >
                          <SpinnerIcon
                            className="h-10 w-10 text-[var(--preview-spinner)]"
                            data-oid="u9r97lb"
                          />
                        </div>
                      )}
                      <video
                        ref={videoRef}
                        key={blobUrl}
                        src={useHls ? undefined : blobUrl}
                        loop={loop}
                        controls={videoReady}
                        autoPlay
                        preload="metadata"
                        poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='2' height='2'%3E%3C/svg%3E"
                        className={cn(
                          "pointer-events-auto max-h-full max-w-full rounded-lg shadow-2xl object-contain cursor-pointer transition-opacity duration-200",
                          videoReady ? "opacity-100" : "opacity-0",
                        )}
                        style={{ backgroundColor: "transparent" }}
                        onClick={(e) => e.stopPropagation()}
                        onLoadedMetadata={() => setVideoReady(true)}
                        onLoadedData={() => setVideoReady(true)}
                        onCanPlay={() => setVideoReady(true)}
                        onError={tryVideoAudioFallback}
                        data-oid=".camnr9"
                      >
                        <track kind="captions" data-oid="kc_azfx" />
                        您的浏览器不支持视频播放
                      </video>
                    </div>
                  ) : null}

                  {/* ----------------------------- */}
                  {/* 音频（独立的交互卡片） */}
                  {/* ----------------------------- */}
                  {isAudio && blobUrl ? (
                    <div
                      className="flex h-full w-full flex-col items-center justify-center pointer-events-none"
                      data-oid="h.1_-ta"
                    >
                      <div
                        className="pointer-events-auto flex flex-col items-center gap-6 rounded-2xl bg-[var(--preview-surface-soft)] px-12 py-10"
                        onClick={(e) => e.stopPropagation()}
                        data-oid="t97wgej"
                      >
                        <div
                          className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--preview-audio-icon-bg)]"
                          data-oid="vp:v1h2"
                        >
                          <AudioIcon data-oid="n5a.zv-" />
                        </div>
                        <audio
                          key={blobUrl}
                          src={blobUrl}
                          controls
                          autoPlay
                          className="w-80"
                          onError={tryVideoAudioFallback}
                          data-oid="ab7fcl9"
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
                    <div
                      className="flex h-full w-full items-center justify-center pointer-events-none"
                      data-oid="n_jiwxk"
                    >
                      <div
                        className="pointer-events-auto h-[min(70vh,42rem)] w-[min(92vw,60rem)] overflow-hidden rounded-md border border-[var(--preview-markdown-container-border)] bg-[var(--preview-markdown-container-bg)] shadow-none"
                        onClick={(e) => e.stopPropagation()}
                        data-oid="7x4qu_t"
                      >
                        <div
                          className="border-b border-[var(--preview-text-toolbar-border)]"
                          data-oid="6qzs0md"
                        >
                          <div
                            className="relative overflow-hidden bg-[var(--preview-text-toolbar-bg)] backdrop-blur-md"
                            data-oid="hzafmyc"
                          >
                            <div
                              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[var(--preview-text-toolbar-topline)]"
                              data-oid="ikx4ogz"
                            />

                            <div
                              className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-[var(--preview-text-toolbar-bottomline)]"
                              data-oid="uhlk8gq"
                            />

                            <div
                              className="pointer-events-none absolute inset-0 bg-[var(--preview-text-toolbar-glow)]"
                              data-oid="wf-ysz9"
                            />

                            <div
                              className="pointer-events-none absolute inset-0 opacity-90 [background:var(--preview-text-toolbar-ambient)]"
                              data-oid="3wl.2kg"
                            />

                            <div
                              className="relative flex h-14 items-center justify-end px-[clamp(0.6rem,1.2vw,1rem)]"
                              data-oid="d8fxf81"
                            >
                              <span
                                className="text-[clamp(0.5rem,0.45vw,0.65rem)] font-brand font-normal tracking-wider text-[var(--preview-text-muted)] drop-shadow-[var(--preview-text-toolbar-shadow)]"
                                data-oid="r9g-rri"
                              >
                                {textContent.split("\n").length} 行
                              </span>
                            </div>
                          </div>
                        </div>

                        <div
                          className={cn(
                            "h-[calc(100%-56px)] overflow-auto p-4 text-sm leading-relaxed",
                            isMarkdown
                              ? "bg-transparent text-[var(--preview-text-primary)]"
                              : "text-[var(--preview-text-primary)]",
                          )}
                          data-oid=":bsq4xg"
                        >
                          {isMarkdown ? (
                            <MarkdownPreview
                              content={textContent}
                              data-oid="k-e-1p_"
                            />
                          ) : (
                            <pre
                              className="h-full overflow-auto text-sm leading-relaxed text-[var(--preview-text-primary)] whitespace-pre-wrap font-mono"
                              data-oid="9bbe:_q"
                            >
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
                <div
                  className="flex h-full w-full items-center justify-center pointer-events-none"
                  data-oid="ceihfhe"
                >
                  <article
                    className="pointer-events-auto group relative rounded-md transition-colors bg-[var(--preview-unsupported-bg)] backdrop-blur-md hover:bg-[var(--preview-unsupported-hover-bg)] max-w-[min(92vw,22rem)] scale-[2]"
                    onClick={(e) => e.stopPropagation()}
                    data-oid="2r9sbbg"
                  >
                    <div className="p-3" data-oid="n4w.5t1">
                      {/* 文件类型图标 */}
                      <div
                        className="relative mb-3 aspect-square overflow-hidden rounded-lg bg-[var(--preview-unsupported-thumb-bg)]"
                        data-oid="qbxjgl1"
                      >
                        <div
                          className="flex h-full w-full items-center justify-center rounded overflow-hidden shrink-0 bg-[var(--preview-unsupported-thumb-inner-bg)]"
                          data-oid="p1rtcqy"
                        >
                          <FileIcon data-oid="drawj-u" />
                        </div>
                      </div>
                      {/* 基础元信息：大小 / 类型 / 日期 */}
                      <div
                        className="flex w-full items-center justify-center"
                        data-oid="6g:3:_1"
                      >
                        <div
                          className="min-w-0 flex-1 space-y-0.5 text-center"
                          data-oid="io9qq-d"
                        >
                          <p
                            className="truncate whitespace-nowrap text-[clamp(7px,2vw,9px)] font-medium text-[var(--preview-text-primary)]"
                            title={file.original_filename}
                            data-oid="zok_ezd"
                          >
                            不支持预览
                          </p>
                          <p
                            className="flex items-center justify-center gap-1 whitespace-nowrap text-[clamp(6px,1.6vw,7px)] text-[var(--preview-text-muted)]"
                            data-oid="i0gpk0l"
                          >
                            <span data-oid="c:psujv">
                              {formatFileSize(file.file_size)}
                            </span>
                            <span
                              className="h-0.5 w-0.5 rounded-full bg-[var(--preview-divider)]"
                              aria-hidden
                              data-oid="fttsaz0"
                            />

                            <span data-oid="evej9gx">
                              {getMimeTypeLabel(
                                file.mime_type,
                                file.original_filename,
                              )}
                            </span>
                          </p>
                          <p
                            className="whitespace-nowrap text-[clamp(6px,1.6vw,7px)] text-[var(--preview-text-muted)]"
                            data-oid="hbe.f:t"
                          >
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
