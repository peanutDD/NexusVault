import { type ReactNode } from "react";
import { cn } from "../../../utils/cn";
import { useDialog } from "../../../hooks/common/useDialog";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl";
  description?: string;
  variant?: "default" | "glass" | "upload";
  loading?: boolean;
  panelClassName?: string;
  placement?: "nav-safe-start" | "nav-safe-center";
}

const maxWidthClasses = {
  sm: "max-w-[clamp(22rem,92vw,28rem)]",
  md: "max-w-[clamp(26rem,94vw,32rem)]",
  lg: "max-w-[clamp(34rem,96vw,42rem)]",
  xl: "max-w-[clamp(42rem,96vw,56rem)]",
} as const;

export default function Modal({
  title,
  onClose,
  children,
  maxWidth = "md",
  description,
  variant = "default",
  loading = false,
  panelClassName,
  placement = "nav-safe-start",
}: ModalProps) {
  // 使用 useDialog hook 统一处理 ESC 关闭
  const { handleBackdropClick } = useDialog({
    open: true,
    onClose,
    loading,
  });

  const isUploadVariant = variant === "upload";

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex justify-center px-[clamp(0.78rem,1.8vw,1rem)] pb-[clamp(0.78rem,1.8vw,1rem)] pt-[calc(clamp(5.5rem,10vw,8rem)+env(safe-area-inset-top))] animate-fade-in",
        placement === "nav-safe-center" ? "items-center" : "items-start",
        "bg-[var(--modal-backdrop)]",
      )}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      data-oid="h-i2b2e"
    >
      <div
        className={cn(
          "neu-raised relative w-full max-h-[calc(100dvh_-_clamp(6.5rem,12vw,9rem))] overflow-y-auto rounded-[clamp(0.8rem,2vw,1rem)] p-[clamp(1.25rem,2.7vw,1.5rem)] text-[var(--color-text-primary)] transform transition-all duration-300 animate-fade-in",
          maxWidthClasses[maxWidth],
          panelClassName,
        )}
        onClick={(e) => e.stopPropagation()}
        data-oid="o0:osfm"
      >
        <div
          className="relative flex justify-between items-center mb-[clamp(0.78rem,1.8vw,1rem)]"
          data-oid="5kruig."
        >
          <h2
            id="modal-title"
            className={cn(
              "text-[clamp(1.125rem,2.8vw,1.25rem)] font-semibold transition-colors duration-200",
              "text-[var(--color-text-primary)]",
            )}
            data-oid="y7p-zcy"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className={cn(
              "text-[clamp(1.25rem,3.5vw,1.5rem)] leading-none transition-colors duration-200 w-[clamp(1.75rem,3.6vw,2rem)] h-[clamp(1.75rem,3.6vw,2rem)] flex items-center justify-center rounded-full",
              isUploadVariant
                  ? "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--modal-close-hover-bg-upload)] rounded-[clamp(0.3rem,0.8vw,0.375rem)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--modal-close-hover-bg-upload)]",
              loading && "opacity-50 cursor-not-allowed",
            )}
            aria-label="关闭"
            data-oid="edez3_k"
          >
            ×
          </button>
        </div>
        {description && (
          <p
            className={cn(
              "relative mb-[clamp(0.78rem,1.8vw,1rem)] max-w-full min-w-0 text-[clamp(0.75rem,1.8vw,0.875rem)] transition-colors duration-200 [overflow-wrap:anywhere]",
              "text-[var(--color-text-secondary)]",
            )}
            data-oid="s-bcnks"
          >
            {description}
          </p>
        )}
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}
