import { APP_NAME } from "../../config/env";

export default function BottomBar() {
  const year = new Date().getFullYear();

  return (
    <footer
      className="relative overflow-hidden border-t border-[var(--footer-border)] flex-shrink-0"
      role="contentinfo"
      data-oid="o966s9d"
    >
      {/* 科技感背景：网格 + 渐变光带 */}
      <div
        className="absolute inset-0 [background:var(--footer-surface-bg)]"
        data-oid="b8plw_1"
      />

      <div
        className="absolute inset-0 opacity-[0.07] [background-image:var(--footer-grid-bg-image)] [background-size:var(--footer-grid-bg-size)]"
        data-oid="tyd9q4h"
      />

      <div
        className="absolute inset-0 bg-[image:var(--footer-bg-gradient)]"
        data-oid="f03tbot"
      />

      <div
        className="absolute inset-x-0 top-0 h-px bg-[image:var(--footer-top-line)]"
        data-oid="-d84jy2"
      />

      <div
        className="absolute inset-x-0 bottom-0 h-px bg-[image:var(--footer-bottom-line)]"
        data-oid="vafjflx"
      />

      {/* 顶部流动光效（CSS 动画） */}
      <div
        className="absolute inset-x-0 top-0 h-[2px] opacity-80 [background:var(--footer-shimmer-bg)] [background-size:var(--footer-shimmer-bg-size)] [animation:footerShimmer_4s_ease-in-out_infinite]"
        data-oid="mm5c9s9"
      />

      <div
        className="relative mx-auto max-w-[80rem] px-[clamp(1rem,2.5vw,2rem)] py-[clamp(2rem,5vw,2.5rem)]"
        data-oid=".0dbe-l"
      >
        <div
          className="flex flex-col items-center gap-[clamp(0.75rem,2vw,1rem)] text-center font-footer"
          data-oid="pdlh.i:"
        >
          <p
            className="text-[clamp(0.875rem,2vw,1rem)] font-semibold tracking-[0.35em] uppercase text-[var(--footer-title-text)] letter-spacing-wider"
            data-oid="14m1uu8"
          >
            {APP_NAME}
          </p>
          <p
            className="max-w-[36rem] text-[clamp(0.75rem,1.8vw,0.875rem)] text-[var(--footer-copy-text)] leading-relaxed tracking-wide"
            data-oid="mqi:ck8"
          >
            © {year} WEIZHANG. All rights reserved. Unauthorized copying,
            reproduction or commercial use is prohibited.
          </p>
          <div
            className="flex w-full max-w-[28rem] items-center justify-center gap-[clamp(0.5rem,1.5vw,0.75rem)]"
            data-oid="7omu0xz"
          >
            <span
              className="h-px flex-1 bg-[image:var(--footer-divider-left)]"
              data-oid="xv-bzpc"
            />

            <span
              className="inline-block h-[clamp(0.3rem,0.9vw,0.375rem)] w-[clamp(0.3rem,0.9vw,0.375rem)] rounded-full bg-[var(--footer-dot-bg)] shadow-[var(--footer-dot-shadow)]"
              data-oid="kfl7.dq"
            />

            <span
              className="h-px flex-1 bg-[image:var(--footer-divider-right)]"
              data-oid="25ueqhn"
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
