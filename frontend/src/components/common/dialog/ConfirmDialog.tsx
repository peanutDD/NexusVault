import { type ReactNode, useEffect, useId, useRef } from 'react';
import { cn } from '../../../utils/cn';
import { useDialog } from '../../../hooks/common/useDialog';

export type ConfirmVariant = 'danger' | 'warning' | 'info';
export type ConfirmAppearance = 'default' | 'glass';

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

const variantConfig = {
  danger: {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
    iconBg: 'bg-[var(--confirm-danger-icon-bg)]',
    iconColor: 'text-[var(--confirm-danger-icon-text)]',
    buttonBg: 'bg-[var(--confirm-danger-button-bg)] hover:bg-[var(--confirm-danger-button-bg-hover)]',
    accentColor: 'from-[var(--confirm-danger-icon-bg)] via-transparent',
  },
  warning: {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    iconBg: 'bg-[var(--confirm-warning-icon-bg)]',
    iconColor: 'text-[var(--confirm-warning-icon-text)]',
    buttonBg: 'bg-[var(--confirm-warning-button-bg)] hover:bg-[var(--confirm-warning-button-bg-hover)]',
    accentColor: 'from-[var(--confirm-warning-icon-bg)] via-transparent',
  },
  info: {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    iconBg: 'bg-[var(--confirm-info-icon-bg)]',
    iconColor: 'text-[var(--confirm-info-icon-text)]',
    buttonBg: 'bg-[var(--confirm-info-button-bg)] hover:bg-[var(--confirm-info-button-bg-hover)]',
    accentColor: 'from-[var(--confirm-info-icon-bg)] via-transparent',
  },
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'danger',
  appearance = 'default',
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
  const isGlass = appearance === 'glass';

  const displayIcon = icon ?? config.icon;
  const displayIconBg = iconBgClass ?? config.iconBg;
  const displayIconColor = iconColorClass ?? config.iconColor;

  const glassConfirmClass =
    variant === 'danger'
      ? 'border-[var(--confirm-danger-glass-border)] bg-[var(--confirm-danger-glass-bg)] hover:bg-[var(--confirm-danger-glass-bg-hover)] shadow-[var(--confirm-danger-glass-shadow)]'
      : variant === 'warning'
        ? 'border-[var(--confirm-warning-glass-border)] bg-[var(--confirm-warning-glass-bg)] hover:bg-[var(--confirm-warning-glass-bg-hover)] shadow-[var(--confirm-warning-glass-shadow)]'
        : 'border-[var(--confirm-info-glass-border)] bg-[var(--confirm-info-glass-bg)] hover:bg-[var(--confirm-info-glass-bg-hover)] shadow-[var(--confirm-info-glass-shadow)]';

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
      setTimeout(() => confirmButtonRef.current?.focus(), 100);
    }
  }, [open]);

  if (!open) return null;

  const isSciFi = isGlass && variant === 'danger';

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4',
        isSciFi && 'confirm-dialog-sci-fi'
      )}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={messageId}
    >
      {/* 背景遮罩 */}
      <div
        className={cn(
          'absolute inset-0 animate-in fade-in duration-150',
          isGlass ? 'bg-[var(--confirm-backdrop-glass)] backdrop-blur-sm' : 'bg-[var(--confirm-backdrop)]',
          isSciFi && 'confirm-dialog-sci-fi-backdrop'
        )}
        onClick={() => !loading && onCancel()}
      />

      {/* 对话框 */}
      <div
        className={cn(
          'relative w-full max-w-xs overflow-hidden shadow-2xl animate-in zoom-in-95 fade-in duration-150',
          isGlass
            ? [
                'glass-panel rounded-2xl ring-1',
                'ring-[var(--confirm-surface-ring)] border border-[var(--confirm-surface-glass-border)] bg-[var(--confirm-surface-glass-bg)] text-[var(--confirm-title-text)] backdrop-blur-2xl backdrop-saturate-150',
                'before:pointer-events-none before:absolute before:inset-0 before:content-[""]',
                'before:bg-[image:var(--confirm-surface-glass-highlight)]',
                isSciFi && 'confirm-dialog-sci-fi-panel',
              ].filter(Boolean).join(' ')
            : 'rounded-lg bg-[var(--confirm-surface-bg)] ring-1 ring-[var(--confirm-surface-ring)] border border-[var(--confirm-surface-border)] text-[var(--confirm-title-text)]'
        )}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 科幻风：顶部红/青渐变光带（凹槽上缘高光） */}
        {isSciFi && (
          <div
            className='absolute inset-x-0 top-0 h-0.5 rounded-t-2xl bg-[image:linear-gradient(to_right,transparent,var(--confirm-danger-sci-fi-a),transparent)] pointer-events-none'
            aria-hidden
          />
        )}
        {/* 科幻风：微弱网格纹理 */}
        {isSciFi && (
          <div
            className="confirm-dialog-sci-fi-grid absolute inset-0 rounded-2xl pointer-events-none"
            aria-hidden
          />
        )}

        <div className="relative">
          {/* 凹槽头部：贴顶、内凹、内容在槽内不溢出 */}
          <div
            className={cn(
              'confirm-dialog-groove flex items-center gap-2.5 rounded-t-2xl border-b px-4 py-2.5 min-h-0 overflow-hidden',
              isSciFi
                ? 'confirm-dialog-groove-sci-fi border-[var(--confirm-groove-border)]'
                : 'bg-[var(--confirm-groove-bg)] border-[var(--confirm-groove-border)] shadow-[var(--confirm-groove-shadow)]'
            )}
          >
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                displayIconBg,
                displayIconColor,
                isSciFi && 'confirm-dialog-sci-fi-icon'
              )}
            >
              {displayIcon}
            </div>
            <h3
              id={titleId}
              className={cn(
                'min-w-0 flex-1 truncate text-sm font-semibold text-[var(--confirm-title-text)]',
                isSciFi && 'tracking-wide drop-shadow-[0_0_12px_rgba(var(--rgb-malachite-500),0.2)]'
              )}
            >
              {title}
            </h3>
          </div>

          {/* 正文：消息容器，支持任意 ReactNode 内容 */}
          <div className="px-4 pb-4">
            <div
              id={messageId}
              className={cn(
                'max-w-full py-3 text-xs leading-relaxed break-words whitespace-pre-line',
                isSciFi ? 'text-[var(--confirm-message-text)]' : 'text-[var(--confirm-message-text-muted)]'
              )}
            >
              {message}
            </div>

          {/* 操作区：上边框区分 */}
          <div
            className={cn(
              'flex gap-2 pt-3 border-t',
              'border-[var(--confirm-divider)]'
            )}
          >
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className={cn(
                'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                isGlass
                  ? 'glass-btn text-[var(--confirm-cancel-text)] hover:text-[var(--confirm-cancel-text-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--confirm-cancel-ring)]'
                  : 'bg-[var(--confirm-cancel-bg)] text-[var(--confirm-cancel-text)] hover:bg-[var(--confirm-cancel-bg-hover)] hover:text-[var(--confirm-cancel-text-hover)]',
                isSciFi &&
                  'border border-[var(--confirm-danger-sci-fi-b)] hover:border-[var(--confirm-danger-sci-fi-a)] hover:bg-[var(--confirm-danger-sci-fi-b)]'
              )}
            >
              {cancelText}
            </button>
            <button
              ref={confirmButtonRef}
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={cn(
                'flex-1 rounded-lg px-4 py-2 text-sm font-medium text-[var(--confirm-title-text)] transition-all disabled:cursor-not-allowed disabled:opacity-50',
                isGlass
                  ? cn(
                      'glass-btn border text-[var(--confirm-title-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
                      glassConfirmClass,
                      isSciFi && 'confirm-dialog-sci-fi-confirm'
                    )
                  : cn(config.buttonBg, 'text-[var(--btn-danger-text)] disabled:cursor-not-allowed disabled:opacity-50'),
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
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
