import { APP_NAME } from '../../config/env';

export default function BottomBar() {
  const year = new Date().getFullYear();

  return (
    <footer
      className="relative overflow-hidden border-t border-[var(--footer-border)] flex-shrink-0"
      role="contentinfo"
    >
      {/* 科技感背景：网格 + 渐变光带 */}
      <div className="absolute inset-0 [background:var(--footer-surface-bg)]" />
      <div
        className="absolute inset-0 opacity-[0.07] [background-image:var(--footer-grid-bg-image)] [background-size:var(--footer-grid-bg-size)]"
      />
      <div className="absolute inset-0 bg-[image:var(--footer-bg-gradient)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-[image:var(--footer-top-line)]" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-[image:var(--footer-bottom-line)]" />

      {/* 顶部流动光效（CSS 动画） */}
      <div
        className="absolute inset-x-0 top-0 h-[2px] opacity-80 [background:var(--footer-shimmer-bg)] [background-size:var(--footer-shimmer-bg-size)] [animation:footerShimmer_4s_ease-in-out_infinite]"
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="flex flex-col items-center gap-4 text-center font-footer">
          <p className="text-sm sm:text-base font-semibold tracking-[0.35em] uppercase text-[var(--footer-title-text)] letter-spacing-wider">
            {APP_NAME}
          </p>
          <p className="text-xs sm:text-sm text-[var(--footer-copy-text)] max-w-xl leading-relaxed tracking-wide">
            © {year} WEIZHANG. All rights reserved. Unauthorized copying, reproduction or commercial use is prohibited.
          </p>
          <div className="flex items-center gap-3 w-full max-w-md justify-center">
            <span className="h-px flex-1 bg-[image:var(--footer-divider-left)]" />
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--footer-dot-bg)] shadow-[var(--footer-dot-shadow)]" />
            <span className="h-px flex-1 bg-[image:var(--footer-divider-right)]" />
          </div>
        </div>
      </div>
    </footer>
  );
}
