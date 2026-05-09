import { useState } from "react";
import {
  isBrowserSupported,
  detectBrowser,
} from "../../utils/browserDetection";

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
      className={`fixed top-0 left-0 right-0 z-50 bg-[rgba(var(--rgb-pistachio-400),0.86)] text-[rgba(var(--rgb-slate-950),0.92)] p-[clamp(0.75rem,2vw,1rem)] shadow-lg ${className}`}
      data-oid="a4b.e6y"
    >
      <div
        className="container mx-auto flex items-center justify-between"
        data-oid="ob_p7ma"
      >
        <div className="flex items-center gap-[clamp(0.5rem,1.5vw,0.75rem)]" data-oid="eqrtarr">
          <svg
            className="h-[clamp(1.25rem,3vw,1.5rem)] w-[clamp(1.25rem,3vw,1.5rem)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            data-oid="g0sfuh0"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-.77-2.694-.77-3.464 0L3.34 16c-.77.77-.77 2.072.002 2.83z"
              data-oid="rv4o0j_"
            />
          </svg>
          <div data-oid="q8zfiym">
            <h3 className="font-medium" data-oid="dd9a.u5">
              浏览器版本过低
            </h3>
            <p className="text-[clamp(0.75rem,1.8vw,0.875rem)] opacity-90" data-oid="syttaj2">
              {browserName} 版本过低，可能导致网站功能异常
            </p>
          </div>
        </div>
        <div className="flex items-center gap-[clamp(0.75rem,2vw,1rem)]" data-oid="i8hzt96">
          <span className="text-[clamp(0.75rem,1.8vw,0.875rem)]" data-oid="408ly74">
            建议使用 {supportedVersion}
          </span>
          <button
            type="button"
            onClick={() => setShowWarning(false)}
            className="text-[rgba(var(--rgb-slate-950),0.92)] hover:text-[rgba(var(--rgb-black),0.92)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--rgb-slate-950),0.45)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(var(--rgb-pistachio-400),0.86)] rounded"
            aria-label="关闭提示"
            title="关闭提示"
            data-oid="6ij2eek"
          >
            <svg
              className="h-[clamp(1rem,2.5vw,1.25rem)] w-[clamp(1rem,2.5vw,1.25rem)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              data-oid="kwhwt.7"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
                data-oid="mq7k1pl"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
