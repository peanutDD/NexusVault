import { type ReactNode, useId, useRef } from "react";
import { cn } from "../../../utils/cn";
import { useDialog } from "../../../hooks/common/useDialog";

interface BaseDialogProps {
  /** 对话框是否打开 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 标题 */
  title: string;
  /** 描述（可选） */
  description?: string;
  /** 子内容 */
  children: ReactNode;
  /** 最大宽度 */
  maxWidth?: "sm" | "md" | "lg" | "xl";
  /** 样式变体 */
  variant?: "default" | "glass" | "upload";
  /** 是否在 loading 时禁止关闭 */
  loading?: boolean;
  /** 是否在按 ESC 时关闭，默认 true */
  closeOnEscape?: boolean;
  /** 是否在点击背景时关闭，默认 true */
  closeOnBackdrop?: boolean;
  /** 自动聚焦的元素引用 */
  autoFocusRef?: React.RefObject<HTMLElement | null>;
  /** 底部操作区 */
  footer?: ReactNode;
  /** 自定义类名 */
  className?: string;
}

const maxWidthClasses = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
} as const;

/**
 * 基础对话框组件
 * 提供统一的对话框结构、样式和交互逻辑
 */
export function BaseDialog({
  open,
  onClose,
  title,
  description,
  children,
  maxWidth = "md",
  variant = "default",
  loading = false,
  closeOnEscape = true,
  closeOnBackdrop = true,
  autoFocusRef,
  footer,
  className,
}: BaseDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const defaultFocusRef = useRef<HTMLButtonElement>(null);
  const focusRef = autoFocusRef ?? defaultFocusRef;

  const { handleBackdropClick, dialogRef } = useDialog({
    open,
    onClose,
    loading,
    autoFocusRef: focusRef,
    closeOnEscape,
    closeOnBackdrop,
  });

  if (!open) return null;

  const isUploadVariant = variant === "upload";

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in",
        variant === "glass" || isUploadVariant
          ? "bg-[var(--modal-backdrop-glass)]"
          : "bg-[var(--modal-backdrop)]",
        variant === "glass" && "modal-dialog-tech",
      )}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      data-oid=".fol8ys"
    >
      <div
        className={cn(
          variant === "glass"
            ? [
                "relative w-full max-h-[90vh] overflow-y-auto rounded-2xl p-6 shadow-2xl",
                "border border-[var(--modal-surface-glass-border)] bg-[var(--modal-surface-glass-bg)] text-[var(--color-text-primary)] ring-1 ring-[var(--modal-surface-ring)]",
                "backdrop-blur-xl backdrop-saturate-150",
                'before:pointer-events-none before:absolute before:inset-0 before:content-[""]',
                "before:bg-[image:var(--modal-surface-glass-highlight)]",
                "modal-dialog-tech-panel",
              ].join(" ")
            : isUploadVariant
              ? [
                  "relative w-full max-h-[90vh] overflow-y-auto rounded-2xl p-6 shadow-2xl text-[var(--color-text-primary)]",
                  "border border-[var(--modal-surface-glass-border)] bg-[var(--modal-surface-bg)] ring-1 ring-[var(--modal-surface-ring)]",
                  "backdrop-blur-xl backdrop-saturate-150",
                  'before:pointer-events-none before:absolute before:inset-0 before:rounded-2xl before:content-[""]',
                  "before:bg-[image:var(--modal-surface-glass-highlight)]",
                ].join(" ")
              : "bg-[var(--modal-surface-bg)] border border-[var(--modal-surface-border)] text-[var(--color-text-primary)] rounded-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl transform transition-all duration-300 animate-fade-in",
          maxWidthClasses[maxWidth],
          className,
        )}
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        data-oid="uliq6c0"
      >
        {variant === "glass" && (
          <>
            <div
              className="modal-dialog-tech-topline absolute inset-x-0 top-0 h-0.5 rounded-t-2xl pointer-events-none"
              aria-hidden
            />
            <div
              className="modal-dialog-tech-grid absolute inset-0 rounded-2xl pointer-events-none"
              aria-hidden
            />
          </>
        )}
        {/* Header */}
        <div
          className="relative flex justify-between items-center mb-4"
          data-oid=":fr4nb9"
        >
          <h2
            id={titleId}
            className={cn(
              "text-xl font-semibold transition-colors duration-200",
              "text-[var(--color-text-primary)]",
            )}
            data-oid="g13md7q"
          >
            {title}
          </h2>
          <button
            ref={autoFocusRef ? undefined : defaultFocusRef}
            type="button"
            onClick={onClose}
            disabled={loading}
            className={cn(
              "text-2xl leading-none transition-colors duration-200 w-8 h-8 flex items-center justify-center rounded-full",
              variant === "glass"
                ? "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--modal-close-hover-bg)]"
                : isUploadVariant
                  ? "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--modal-close-hover-bg-upload)] rounded-md"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--modal-close-hover-bg-upload)]",
              loading && "opacity-50 cursor-not-allowed",
            )}
            aria-label="关闭"
            data-oid="7vo3u61"
          >
            ×
          </button>
        </div>

        {/* Description */}
        {description && (
          <p
            id={descriptionId}
            className={cn(
              "relative mb-4 text-sm transition-colors duration-200",
              "text-[var(--color-text-secondary)]",
            )}
            data-oid="cse44gn"
          >
            {description}
          </p>
        )}

        {/* Content */}
        <div className="dialog-content relative" data-oid="sruyu4.">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="relative mt-6" data-oid="_mihut4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default BaseDialog;
