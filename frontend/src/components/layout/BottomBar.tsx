import { APP_NAME } from "../../config/env";

export default function BottomBar() {
  const year = new Date().getFullYear();

  return (
    <footer
      className="neu-raised relative flex-shrink-0 overflow-hidden"
      role="contentinfo"
      data-testid="bottom-bar"
      data-oid="o966s9d"
    >
      <div
        className="relative mx-auto max-w-[var(--app-shell-max-width)] px-[clamp(1rem,2.5vw,2rem)] py-[clamp(2rem,5vw,2.5rem)]"
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
            className="max-w-[var(--app-footer-copy-max-width)] text-[clamp(0.75rem,1.8vw,0.875rem)] text-[var(--footer-copy-text)] leading-relaxed tracking-wide"
            data-oid="mqi:ck8"
          >
            © {year} WEIZHANG. All rights reserved. Unauthorized copying,
            reproduction or commercial use is prohibited.
          </p>
          <div
            className="flex w-full max-w-[var(--app-footer-actions-max-width)] items-center justify-center gap-[clamp(0.5rem,1.5vw,0.75rem)]"
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
