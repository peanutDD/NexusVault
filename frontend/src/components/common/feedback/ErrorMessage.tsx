import { useEffect } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { cn } from "../../../utils/cn";

interface ErrorMessageProps {
  message: string;
  onClose?: () => void;
  type?: "error" | "warning" | "info";
  className?: string;
  /** 多少毫秒后自动关闭，不传则不自动关闭 */
  autoDismissMs?: number;
}

const textEncoder = new TextEncoder();

const getByteLength = (value: string) => textEncoder.encode(value).length;

const truncateMiddleByBytes = (value: string, maxBytes: number) => {
  if (maxBytes <= 0 || getByteLength(value) <= maxBytes) return value;
  const ellipsis = "...";
  const remainingBytes = maxBytes - getByteLength(ellipsis);
  if (remainingBytes <= 0) return ellipsis;
  const chars = [...value];
  let left = 0;
  let right = chars.length - 1;
  let leftPart = "";
  let rightPart = "";
  let usedBytes = 0;
  let takeLeft = true;

  while (left <= right) {
    const nextChar = takeLeft ? chars[left] : chars[right];
    const nextBytes = getByteLength(nextChar);
    if (usedBytes + nextBytes > remainingBytes) break;
    if (takeLeft) {
      leftPart += nextChar;
      left += 1;
    } else {
      rightPart = `${nextChar}${rightPart}`;
      right -= 1;
    }
    usedBytes += nextBytes;
    takeLeft = !takeLeft;
  }

  return `${leftPart}${ellipsis}${rightPart}`;
};

const normalizeMessage = (message: string) =>
  message
    .replace(/「([^」]+)」/g, (_, fileName: string) => {
      return `「${truncateMiddleByBytes(fileName, 25)}」`;
    })
    .replace(/“([^”]+)”/g, (_, fileName: string) => {
      return `“${truncateMiddleByBytes(fileName, 25)}”`;
    })
    .replace(/"([^"]+)"/g, (_, fileName: string) => {
      return `"${truncateMiddleByBytes(fileName, 25)}"`;
    })
    .replace(/'([^']+)'/g, (_, fileName: string) => {
      return `'${truncateMiddleByBytes(fileName, 25)}'`;
    })
    .replace(/‘([^’]+)’/g, (_, fileName: string) => {
      return `‘${truncateMiddleByBytes(fileName, 25)}’`;
    })
    .replace(
      /(^|\s)([^\s,，。；：:]+?\.[A-Za-z0-9]{1,10})(?=$|\s|,|，|。|；|：|:)/g,
      (_, prefix: string, fileName: string) => {
        return `${prefix}${truncateMiddleByBytes(fileName, 25)}`;
      },
    );

const typeConfig = {
  error: {
    icon: AlertCircle,
    iconClass: "text-[var(--notice-error)]",
    borderClass: "border-[var(--notice-error-border)]",
    accentClass:
      "from-[var(--notice-error-accent)] via-transparent to-transparent",
    hairlineClass: "via-[var(--notice-error-hairline)]",
  },
  warning: {
    icon: AlertCircle,
    iconClass: "text-[var(--notice-warning)]",
    borderClass: "border-[var(--notice-warning-border)]",
    accentClass:
      "from-[var(--notice-warning-accent)] via-transparent to-transparent",
    hairlineClass: "via-[var(--notice-warning-hairline)]",
  },
  info: {
    icon: CheckCircle2,
    iconClass: "text-[var(--notice-info)]",
    borderClass: "border-[var(--notice-info-border)]",
    accentClass:
      "from-[var(--notice-info-accent)] via-transparent to-[var(--notice-info-accent-to)]",
    hairlineClass: "via-[var(--notice-info-hairline)]",
  },
} as const;

export default function ErrorMessage({
  message,
  onClose,
  type = "error",
  className,
  autoDismissMs,
}: ErrorMessageProps) {
  const config = typeConfig[type];
  const Icon = config.icon;
  const displayMessage = normalizeMessage(message);

  useEffect(() => {
    if (autoDismissMs != null && autoDismissMs > 0 && onClose) {
      const timer = window.setTimeout(onClose, autoDismissMs);
      return () => window.clearTimeout(timer);
    }
  }, [autoDismissMs, onClose]);

  return (
    <div
      className={cn(
        "relative w-full min-w-0 overflow-hidden rounded-[clamp(1rem,2.5vw,1.5rem)] border-2 p-[clamp(0.75rem,2vw,1rem)] text-[clamp(0.65rem,1.5vw,0.75rem)]",
        "bg-[var(--notice-surface-bg)] backdrop-blur-xl",
        "shadow-[0_0_0_1px_rgba(var(--rgb-white),0.08),0_0.75rem_2.5rem_rgba(var(--rgb-black),0.5)]",
        config.borderClass,
        "animate-fade-in transition-all duration-200",
        className,
      )}
      role="alert"
      data-oid="zlnjhhp"
    >
      {/* Glassmorphism ambient glow */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-r",
          config.accentClass,
        )}
        data-oid="5ndz-4."
      />

      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent",
          config.hairlineClass,
        )}
        data-oid="lvqttey"
      />

      <div className="relative z-10 flex items-center gap-[clamp(0.5rem,1.5vw,0.75rem)]" data-oid="be8-oiu">
        <div
          className={cn(
            "shrink-0 rounded-[clamp(0.75rem,1.8vw,1rem)] border border-current/10 bg-current/5 p-[clamp(0.4rem,1vw,0.5rem)]",
            config.iconClass,
          )}
          data-oid="-.r0ji4"
        >
          <Icon
            className="h-[clamp(1rem,2.5vw,1.25rem)] w-[clamp(1rem,2.5vw,1.25rem)] text-current"
            aria-hidden="true"
            data-oid="ga-8l7x"
          />
        </div>
        <div className="min-w-0 flex-1" data-oid="hakyjqu">
          <p
            className={cn(
              "text-[0.625rem] font-medium tracking-wide",
              config.iconClass,
            )}
            data-oid="pfrbya2"
          >
            {displayMessage}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="shrink-0 rounded-[clamp(0.4rem,1vw,0.5rem)] p-[clamp(0.3rem,0.8vw,0.375rem)] text-[var(--color-text-muted)] transition-colors hover:bg-[rgba(var(--rgb-white),0.06)] hover:text-[var(--color-text-primary)]"
            aria-label="关闭"
            data-oid="q78a2sh"
          >
            <X className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)]" aria-hidden="true" data-oid="j8px__1" />
          </button>
        )}
      </div>
    </div>
  );
}
