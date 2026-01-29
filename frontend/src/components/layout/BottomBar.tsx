import { APP_NAME } from '../../config/env';

export default function BottomBar() {
  const year = new Date().getFullYear();

  return (
    <footer
      className="relative overflow-hidden border-t border-white/5 flex-shrink-0"
      role="contentinfo"
    >
      {/* 科技感背景：网格 + 渐变光带 */}
      <div
        className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(168,85,247,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(168,85,247,0.5)_1px,transparent_1px)] [background-size:24px_24px]"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-fuchsia-500/5 to-cyan-500/10" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/60 via-cyan-400/60 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />

      {/* 顶部流动光效（CSS 动画） */}
      <div
        className="absolute inset-x-0 top-0 h-[2px] opacity-80 [background:linear-gradient(90deg,transparent,rgba(168,85,247,0.8),rgba(34,211,238,0.8),rgba(16,185,129,0.6),transparent)] [background-size:200%_100%] [animation:footerShimmer_4s_ease-in-out_infinite]"
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="flex flex-col items-center gap-4 text-center font-footer">
          <p className="text-sm sm:text-base font-semibold tracking-[0.35em] uppercase text-slate-400/95 letter-spacing-wider">
            {APP_NAME}
          </p>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xl leading-relaxed tracking-wide">
            © {year} WEIZHANG. All rights reserved. Unauthorized copying, reproduction or commercial use is prohibited.
          </p>
          <div className="flex items-center gap-3 w-full max-w-md justify-center">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-fuchsia-500/30" />
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400/60 shadow-[0_0_12px_rgba(34,211,238,0.5)]" />
            <span className="h-px flex-1 bg-gradient-to-l from-transparent to-cyan-500/30" />
          </div>
        </div>
      </div>
    </footer>
  );
}
