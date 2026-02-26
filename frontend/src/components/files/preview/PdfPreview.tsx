/**
 * PdfPreview
 * PDF 预览组件，提取自 FilePreviewContent 以支持动态导入
 */

import { memo, useEffect, useState } from 'react';

interface PdfPreviewProps {
  blobUrl: string;
  title: string;
  onClose?: () => void;
}

function PdfPreview(props: PdfPreviewProps) {
  const { blobUrl, title, onClose } = props;
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [showFallbackHint, setShowFallbackHint] = useState(false);
  const [isMobileLike, setIsMobileLike] = useState(false);

  useEffect(() => {
    const update = () => {
      const mql =
        window.matchMedia?.('(hover: none) and (pointer: coarse)') ??
        window.matchMedia?.('(pointer: coarse)');
      setIsMobileLike(Boolean(mql?.matches));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    setIframeLoaded(false);
    setShowFallbackHint(false);
    if (!isMobileLike) return;
    const t = window.setTimeout(() => setShowFallbackHint(true), 2500);
    return () => window.clearTimeout(t);
  }, [blobUrl, isMobileLike]);

  return (
    <div className="flex h-full w-full min-h-0 items-center justify-center pointer-events-none">
      <div
        className="pointer-events-auto relative h-full max-h-full w-full max-w-full overflow-hidden rounded-lg shadow-2xl"
        onClick={(e) => {
          e.stopPropagation();
          if (!isMobileLike) onClose?.();
        }}
      >
        {isMobileLike ? (
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-end gap-2 px-2 py-2">
            {showFallbackHint && !iframeLoaded ? (
              <span className="text-[0.75rem] text-white/60">
                若未显示，请在新标签打开
              </span>
            ) : null}
            <a
              href={blobUrl}
              target="_blank"
              rel="noreferrer"
              referrerPolicy="no-referrer"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md border border-emerald-300/15 bg-slate-900/50 px-3 py-2 text-[0.75rem] font-semibold tracking-wide text-slate-200 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] hover:bg-slate-900/60 hover:border-emerald-300/30 active:translate-y-px transition-all duration-200"
            >
              新标签打开
            </a>
          </div>
        ) : null}
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

export default memo(PdfPreview);
