/**
 * PdfPreview
 * PDF 预览组件：
 *   - 桌面端：iframe 渲染（浏览器原生 PDF 查看器）
 *   - 移动端：PDF.js Canvas 渲染（彻底解决 iOS Safari / Android blob iframe 不支持问题）
 */

import { lazy, memo, Suspense, useEffect, useState } from "react";

// 移动端 Canvas 渲染器（懒加载，避免影响桌面端首屏体积）
const MobilePdfPreview = lazy(() => import("./MobilePdfPreview"));

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface PdfPreviewProps {
  blobUrl: string;
  title: string;
  onClose?: () => void;
}

// ---------------------------------------------------------------------------
// 移动端检测 Hook
// ---------------------------------------------------------------------------
function useIsMobileLike(): boolean {
  const [isMobileLike, setIsMobileLike] = useState(() => {
    const mql =
      window.matchMedia?.("(hover: none) and (pointer: coarse)") ??
      window.matchMedia?.("(pointer: coarse)");
    return Boolean(mql?.matches);
  });

  useEffect(() => {
    const update = () => {
      const mql =
        window.matchMedia?.("(hover: none) and (pointer: coarse)") ??
        window.matchMedia?.("(pointer: coarse)");
      setIsMobileLike(Boolean(mql?.matches));
    };
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return isMobileLike;
}

// ---------------------------------------------------------------------------
// 桌面端 iframe 渲染
// ---------------------------------------------------------------------------
function DesktopPdfPreview({
  blobUrl,
  title,
}: {
  blobUrl: string;
  title: string;
}) {
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const iframeLoaded = loadedFor === blobUrl;

  return (
    <div
      className="flex h-full w-full min-h-0 items-center justify-center pointer-events-none"
      data-oid="v_jgls0"
    >
      <div
        className="pointer-events-auto relative h-full max-h-full w-full max-w-full overflow-hidden rounded-[clamp(0.4rem,1vw,0.5rem)] shadow-2xl"
        data-oid="9qsx6qa"
      >
        {/* 加载指示 */}
        {!iframeLoaded && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-black/40"
            data-oid="s.p0dpy"
          >
            <div
              className="flex flex-col items-center gap-[clamp(0.585rem,1.35vw,0.75rem)]"
              data-oid="u4jnraz"
            >
              <div
                className="h-[clamp(2.25rem,4.5vw,2.5rem)] w-[clamp(2.25rem,4.5vw,2.5rem)] animate-spin rounded-full border-2 border-[var(--spinner-track-color)] border-t-[var(--spinner-accent-color)]"
                data-oid="lkl.snn"
              />

              <span className="text-[clamp(0.75rem,1.8vw,0.875rem)] text-[var(--loading-text)]" data-oid="ofg95wm">
                加载 PDF…
              </span>
            </div>
          </div>
        )}
        <iframe
          src={blobUrl}
          title={title}
          referrerPolicy="no-referrer"
          onLoad={() => setLoadedFor(blobUrl)}
          className="h-full w-full border-0 bg-transparent"
          data-oid=":_9e-mz"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------
function PdfPreview({ blobUrl, title }: PdfPreviewProps) {
  const isMobileLike = useIsMobileLike();

  if (isMobileLike) {
    return (
      <div
        className="flex h-full w-full min-h-0 items-stretch justify-center pointer-events-none"
        data-oid="jth7ifz"
      >
        <div className="pointer-events-auto h-full w-full" data-oid="gxa56q6">
          <Suspense
            fallback={
              <div
                className="flex h-full w-full min-h-[var(--preview-pdf-min-stage-height)] items-center justify-center"
                data-oid="y4swyuy"
              >
                <div
                  className="flex flex-col items-center gap-[clamp(0.585rem,1.35vw,0.75rem)]"
                  data-oid="dpcktor"
                >
                  <div
                    className="h-[clamp(2.25rem,4.5vw,2.5rem)] w-[clamp(2.25rem,4.5vw,2.5rem)] animate-spin rounded-full border-2 border-[var(--spinner-track-color)] border-t-[var(--spinner-accent-color)]"
                    data-oid="nig-vli"
                  />

                  <span className="text-[clamp(0.75rem,1.8vw,0.875rem)] text-[var(--loading-text)]" data-oid="5.k_xqi">
                    加载 PDF…
                  </span>
                </div>
              </div>
            }
            data-oid="mdjxh0l"
          >
            <MobilePdfPreview
              blobUrl={blobUrl}
              title={title}
              data-oid=".3uc7ov"
            />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <DesktopPdfPreview blobUrl={blobUrl} title={title} data-oid="pq4br2j" />
  );
}

export default memo(PdfPreview);
