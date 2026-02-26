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
  const [iframeLoaded, setIframeLoaded] = useState(false);

  useEffect(() => {
    setIframeLoaded(false);
  }, [blobUrl]);

  return (
    <div className="flex h-full w-full min-h-0 items-center justify-center pointer-events-none">
      <div className="pointer-events-auto relative h-full max-h-full w-full max-w-full overflow-hidden rounded-lg shadow-2xl">
        {/* 加载指示 */}
        {!iframeLoaded && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900/60">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-purple-400" />
              <span className="text-sm text-white/50">加载 PDF…</span>
            </div>
          </div>
        )}
        <iframe
          src={blobUrl}
          title={title}
          referrerPolicy="no-referrer"
          onLoad={() => setIframeLoaded(true)}
          className="h-full w-full border-0 bg-white"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------
function PdfPreview({ blobUrl, title, onClose: _onClose }: PdfPreviewProps) {
  const isMobileLike = useIsMobileLike();

  if (isMobileLike) {
    return (
      <div className="flex h-full w-full min-h-0 items-stretch justify-center pointer-events-none">
        <div className="pointer-events-auto h-full w-full">
          <Suspense
            fallback={
              <div className="flex h-full w-full min-h-[200px] items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-purple-400" />
                  <span className="text-sm text-white/50">加载 PDF…</span>
                </div>
              </div>
            }
          >
            <MobilePdfPreview blobUrl={blobUrl} title={title} />
          </Suspense>
        </div>
      </div>
    );
  }

  return <DesktopPdfPreview blobUrl={blobUrl} title={title} />;
}

export default memo(PdfPreview);
