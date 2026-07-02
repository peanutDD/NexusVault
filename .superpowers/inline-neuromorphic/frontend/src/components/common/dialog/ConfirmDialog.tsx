import { type ReactNode, useEffect, useId, useRef } from "react";
import { cn } from "../../../utils/cn";
import { useDialog } from "../../../hooks/common/useDialog";

export type ConfirmVariant = "danger" | "warning" | "info";
export type ConfirmAppearance = "default" | "glass";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  appearance?: ConfirmAppearance;
  /** 可选：自定义头部图标 */
  icon?: ReactNode;
  /** 可选：自定义图标背景样式类 */
  iconBgClass?: string;
  /** 可选：自定义图标颜色样式类 */
  iconColorClass?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const CONFIRM_BUTTON_AUTO_FOCUS_DELAY_MS = 100;

const variantConfig = {
  danger: {
    icon: (
      <svg
        className="h-[clamp(1rem,2.25vw,1.25rem)] w-[clamp(1rem,2.25vw,1.25rem)]"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        data-oid="7-3dqa_"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          data-oid="_5qnf11"
        />
      </svg>
    ),

    iconBg: "neu-inset",
    iconColor: "text-[var(--confirm-danger-icon-text)]",
    buttonBg: "neu-raised-sm text-[var(--confirm-danger-icon-text)]",
  },
  warning: {
    icon: (
      <svg
        className="h-[clamp(1rem,2.25vw,1.25rem)] w-[clamp(1rem,2.25vw,1.25rem)]"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        data-oid="we7kgnd"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          data-oid="7cbv7ut"
        />
      </svg>
    ),

    iconBg: "neu-inset",
    iconColor: "text-[var(--confirm-warning-icon-text)]",
    buttonBg: "neu-raised-sm text-[var(--confirm-warning-icon-text)]",
  },
  info: {
    icon: (
      <svg
        className="h-[clamp(1rem,2.25vw,1.25rem)] w-[clamp(1rem,2.25vw,1.25rem)]"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        data-oid="-fnnotf"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          data-oid="g:xy64r"
        />
      </svg>
    ),

    iconBg: "neu-inset",
    iconColor: "text-[var(--confirm-info-icon-text)]",
    buttonBg: "neu-raised-sm text-[var(--confirm-info-icon-text)]",
  },
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "确认",
  cancelText = "取消",
  variant = "danger",
  appearance = "default",
  icon,
  iconBgClass,
  iconColorClass,
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();
  const config = variantConfig[variant];
  const isGlass = appearance === "glass";

  const displayIcon = icon ?? config.icon;
  const displayIconBg = iconBgClass ?? config.iconBg;
  const displayIconColor = iconColorClass ?? config.iconColor;

  useDialog({
    open,
    onClose: onCancel,
    loading,
    autoFocusRef: confirmButtonRef,
    closeOnEscape: true,
    closeOnBackdrop: true,
  });

  useEffect(() => {
    if (open) {
      setTimeout(
        () => confirmButtonRef.current?.focus(),
        CONFIRM_BUTTON_AUTO_FOCUS_DELAY_MS,
      );
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-[clamp(0.78rem,1.8vw,1rem)]"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      data-oid="b2u_l.9"
    >
      {/* 背景遮罩 */}
      <div
        className={cn(
          "absolute inset-0 animate-in fade-in bg-black/40 duration-150",
        )}
        onClick={() => !loading && onCancel()}
        data-oid="r8-ttbu"
      />

      {/* 对话框 */}
      <div
        className={cn(
          "neu-raised relative w-full overflow-hidden animate-in zoom-in-95 fade-in duration-150 text-[var(--confirm-title-text)]",
          isGlass
            ? "max-w-[clamp(22rem,92vw,28rem)] rounded-[clamp(0.8rem,2vw,1rem)]"
            : "max-w-[clamp(18rem,88vw,20rem)] rounded-[clamp(0.4rem,1vw,0.5rem)]",
        )}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        data-oid="6ko0hpy"
      >
        <div className="relative" data-oid="blq_hlw">
          {/* 凹槽头部：贴顶、内凹、内容在槽内不溢出 */}
          <div
            className={cn(
              "neu-inset confirm-dialog-groove flex items-center gap-[clamp(0.4875rem,1.125vw,0.625rem)] rounded-t-[clamp(0.8rem,2vw,1rem)] px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.4875rem,1.125vw,0.625rem)] min-h-0 overflow-hidden",
            )}
            data-oid="0m-vx_c"
          >
            <div
              className={cn(
                "flex h-[clamp(1.75rem,3.6vw,2rem)] w-[clamp(1.75rem,3.6vw,2rem)] shrink-0 items-center justify-center rounded-[clamp(0.4rem,1vw,0.5rem)]",
                displayIconBg,
                displayIconColor,
              )}
              data-oid=":w1nhqb"
            >
              {displayIcon}
            </div>
            <h3
              id={titleId}
              className={cn(
                "min-w-0 flex-1 truncate text-[clamp(0.75rem,1.8vw,0.875rem)] font-semibold text-[var(--confirm-title-text)]",
              )}
              data-oid="q.4_c_i"
            >
              {title}
            </h3>
          </div>

          {/* 正文：消息容器，支持任意 ReactNode 内容 */}
          <div
            className="px-[clamp(0.78rem,1.8vw,1rem)] pb-[clamp(0.78rem,1.8vw,1rem)]"
            data-oid="e0uht7g"
          >
            <div
              id={messageId}
              className={cn(
                "max-w-full py-[clamp(0.585rem,1.35vw,0.75rem)] text-[clamp(0.68rem,1.6vw,0.75rem)] leading-relaxed break-words whitespace-pre-line",
                "text-[var(--confirm-message-text)]",
              )}
              data-oid="uzv244-"
            >
              {message}
            </div>

            {/* 操作区：上边框区分 */}
            <div
              className={cn(
                "flex gap-[clamp(0.39rem,0.9vw,0.5rem)] pt-[clamp(0.585rem,1.35vw,0.75rem)]",
              )}
              data-oid="unt1r:p"
            >
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className={cn(
                  "neu-raised-sm flex-1 rounded-[clamp(0.4rem,1vw,0.5rem)] px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.39rem,0.9vw,0.5rem)] text-[clamp(0.75rem,1.8vw,0.875rem)] font-medium text-[var(--confirm-cancel-text)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--confirm-cancel-ring)] active:shadow-[var(--neu-pressed-shadow)] disabled:cursor-not-allowed disabled:opacity-50",
                )}
                data-oid="n20odi3"
              >
                {cancelText}
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                onClick={onConfirm}
                disabled={loading}
                className={cn(
                  "flex-1 rounded-[clamp(0.4rem,1vw,0.5rem)] px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.39rem,0.9vw,0.5rem)] text-[clamp(0.75rem,1.8vw,0.875rem)] font-medium transition-[box-shadow,color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] active:shadow-[var(--neu-pressed-shadow)]",
                  config.buttonBg,
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
                data-oid="o731x2c"
              >
                {loading ? (
                  <span
                    className="flex items-center justify-center gap-[clamp(0.39rem,0.9vw,0.5rem)]"
                    data-oid="9.o:c_-"
                  >
                    <svg
                      className="h-[clamp(0.78rem,1.8vw,1rem)] w-[clamp(0.78rem,1.8vw,1rem)] animate-spin"
                      viewBox="0 0 24 24"
                      data-oid="zgegsur"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                        data-oid="vezrvhd"
                      />

                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        data-oid="801glf3"
                      />
                    </svg>
                    处理中
                  </span>
                ) : (
                  confirmText
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
