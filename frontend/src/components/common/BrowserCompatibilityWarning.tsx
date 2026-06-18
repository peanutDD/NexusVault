import { useState } from "react";
import { TriangleAlert, X } from "lucide-react";
import {
  isBrowserSupported,
  detectBrowser,
} from "../../utils/browserDetection";
import { cn } from "../../utils/cn";

interface BrowserCompatibilityWarningProps {
  className?: string;
}

export default function BrowserCompatibilityWarning({
  className = "",
}: BrowserCompatibilityWarningProps) {
  const [showWarning, setShowWarning] = useState(() => !isBrowserSupported());
  const [browserInfo] = useState(detectBrowser());

  // 不需要 useEffect 来设置初始状态
  // 状态已经在初始化时设置好了

  if (!showWarning) {
    return null;
  }

  const browserNames: Record<string, string> = {
    chrome: "Chrome",
    firefox: "Firefox",
    safari: "Safari",
    edge: "Edge",
    unknown: "您的浏览器",
  };

  const browserName = browserNames[browserInfo.name] || "您的浏览器";
  const supportedVersions = {
    chrome: "88+",
    firefox: "85+",
    safari: "14+",
    edge: "88+",
    unknown: "最新版本",
  };
  const supportedVersion =
    supportedVersions[browserInfo.name as keyof typeof supportedVersions] ||
    "最新版本";

  return (
    <div
      className={cn(
        "appAlertMessage appAlertMessage--codepen appAlertMessage--warning",
        "fixed left-[clamp(0.78rem,1.8vw,1rem)] right-[clamp(0.78rem,1.8vw,1rem)] top-[clamp(0.78rem,1.8vw,1rem)] z-50",
        "mx-auto max-w-[min(64rem,calc(100vw-1.56rem))] overflow-hidden",
        "animate-fade-in transition-all duration-200",
        className,
      )}
      role="alert"
      data-oid="a4b.e6y"
    >
      <div
        className="appAlertMessageAmbient pointer-events-none absolute inset-0"
        data-oid="browser-alert-ambient"
      />
      <div
        className="appAlertMessageHairline pointer-events-none absolute inset-x-0 top-0"
        data-oid="browser-alert-hairline"
      />
      <div
        className="appAlertMessageContent relative z-10 flex min-w-0 flex-col gap-[clamp(0.75rem,1.6vw,0.9rem)] sm:flex-row sm:items-center sm:justify-between"
        data-oid="ob_p7ma"
      >
        <div className="flex min-w-0 items-start gap-[clamp(0.5rem,1.5vw,0.75rem)]" data-oid="eqrtarr">
          <div className="appAlertMessageIcon shrink-0" data-oid="browser-alert-icon">
            <TriangleAlert
              className="appAlertMessageIconSvg text-current"
              aria-hidden="true"
              data-oid="g0sfuh0"
            />
          </div>
          <div className="min-w-0 flex-1" data-oid="q8zfiym">
            <h3 className="appAlertMessageTitle" data-oid="dd9a.u5">
              浏览器版本过低
            </h3>
            <p className="appAlertMessageText" data-oid="syttaj2">
              {browserName} 版本过低，可能导致网站功能异常
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-[clamp(0.75rem,2vw,1rem)] sm:justify-end" data-oid="i8hzt96">
          <span className="appAlertMessageText" data-oid="408ly74">
            建议使用 {supportedVersion}
          </span>
          <button
            type="button"
            onClick={() => setShowWarning(false)}
            className="appAlertMessageClose shrink-0 rounded-[clamp(0.4rem,1vw,0.5rem)] p-[clamp(0.3rem,0.8vw,0.375rem)] text-[var(--color-text-muted)] transition-colors hover:bg-[rgba(var(--rgb-white),0.06)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            aria-label="关闭提示"
            title="关闭提示"
            data-oid="6ij2eek"
          >
            <X
              className="h-[clamp(1rem,2.5vw,1.25rem)] w-[clamp(1rem,2.5vw,1.25rem)]"
              aria-hidden="true"
              data-oid="kwhwt.7"
            />
          </button>
        </div>
      </div>
    </div>
  );
}
