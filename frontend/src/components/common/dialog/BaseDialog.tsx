import { type ReactNode, useRef } from 'react';
import { cn } from '../../../utils/cn';
import { useDialog } from '../../../hooks/common/useDialog';

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
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
  /** 样式变体 */
  variant?: 'default' | 'glass' | 'upload';
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
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
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
  maxWidth = 'md',
  variant = 'default',
  loading = false,
  closeOnEscape = true,
  closeOnBackdrop = true,
  autoFocusRef,
  footer,
  className,
}: BaseDialogProps) {
  const defaultFocusRef = useRef<HTMLButtonElement>(null);
  const focusRef = autoFocusRef ?? defaultFocusRef;

  const { handleBackdropClick } = useDialog({
    open,
    onClose,
    loading,
    autoFocusRef: focusRef,
    closeOnEscape,
    closeOnBackdrop,
  });

  if (!open) return null;

  const isUploadVariant = variant === 'upload';

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in',
        variant === 'glass' || isUploadVariant ? 'bg-black/70' : 'bg-black/80 dark:bg-black/90'
      )}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div
        className={cn(
          variant === 'glass'
            ? [
                'relative w-full max-h-[90vh] overflow-y-auto rounded-2xl p-6 shadow-2xl',
                'border border-white/15 bg-white/10 text-white',
                'backdrop-blur-xl backdrop-saturate-150',
                'before:pointer-events-none before:absolute before:inset-0 before:content-[""]',
                'before:bg-gradient-to-br before:from-white/25 before:via-fuchsia-400/10 before:to-transparent',
              ].join(' ')
            : isUploadVariant
              ? [
                  'relative w-full max-h-[90vh] overflow-y-auto rounded-2xl p-6 shadow-2xl text-white',
                  'border border-white/15 bg-[#1C1C28]/85',
                  'backdrop-blur-xl backdrop-saturate-150',
                  'before:pointer-events-none before:absolute before:inset-0 before:rounded-2xl before:content-[""]',
                  'before:bg-gradient-to-br before:from-[#6C5DD3]/10 before:via-transparent before:to-transparent',
                ].join(' ')
              : 'bg-gray-800 dark:bg-gray-900 rounded-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl transform transition-all duration-300 animate-fade-in',
          maxWidthClasses[maxWidth],
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2
            id="dialog-title"
            className={cn(
              'text-xl font-semibold transition-colors duration-200',
              isUploadVariant ? 'text-white' : 'text-white dark:text-gray-100'
            )}
          >
            {title}
          </h2>
          <button
            ref={autoFocusRef ? undefined : defaultFocusRef}
            type="button"
            onClick={onClose}
            disabled={loading}
            className={cn(
              'text-2xl leading-none transition-colors duration-200 w-8 h-8 flex items-center justify-center rounded-full',
              variant === 'glass'
                ? 'text-white/70 hover:text-white hover:bg-white/10'
                : isUploadVariant
                  ? 'text-gray-500 hover:text-white hover:bg-gray-800 rounded-md'
                  : 'text-gray-400 dark:text-gray-500 hover:text-white dark:hover:text-gray-200 hover:bg-gray-700/50 dark:hover:bg-gray-800/50',
              loading && 'opacity-50 cursor-not-allowed'
            )}
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        {/* Description */}
        {description && (
          <p
            className={cn(
              'mb-4 text-sm transition-colors duration-200',
              isUploadVariant ? 'text-gray-500' : 'text-gray-300 dark:text-gray-400'
            )}
          >
            {description}
          </p>
        )}

        {/* Content */}
        <div className="dialog-content">{children}</div>

        {/* Footer */}
        {footer && <div className="mt-6">{footer}</div>}
      </div>
    </div>
  );
}

export default BaseDialog;
