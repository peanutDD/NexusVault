import { type ReactNode } from 'react';
import { cn } from '../../../utils/cn';
import { useDialog } from '../../../hooks/common/useDialog';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
  description?: string;
  variant?: 'default' | 'glass' | 'upload';
  loading?: boolean;
}

const maxWidthClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
} as const;

export default function Modal({
  title,
  onClose,
  children,
  maxWidth = 'md',
  description,
  variant = 'default',
  loading = false,
}: ModalProps) {
  // 使用 useDialog hook 统一处理 ESC 关闭
  const { handleBackdropClick } = useDialog({
    open: true,
    onClose,
    loading,
  });

  const isUploadVariant = variant === 'upload';

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in',
        variant === 'glass' || isUploadVariant ? 'bg-[var(--modal-backdrop-glass)]' : 'bg-[var(--modal-backdrop)]'
      )}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className={cn(
          variant === 'glass'
            ? [
                'relative w-full max-h-[90vh] overflow-y-auto rounded-2xl p-6 shadow-2xl',
                'border border-[var(--modal-surface-glass-border)] bg-[var(--modal-surface-glass-bg)] text-[var(--color-text-primary)] ring-1 ring-[var(--modal-surface-ring)]',
                'backdrop-blur-xl backdrop-saturate-150',
                'before:pointer-events-none before:absolute before:inset-0 before:content-[""]',
                'before:bg-[image:var(--modal-surface-glass-highlight)]',
              ].join(' ')
            : isUploadVariant
              ? [
                  'relative w-full max-h-[90vh] overflow-y-auto rounded-2xl p-6 shadow-2xl text-[var(--color-text-primary)]',
                  'border border-[var(--modal-surface-glass-border)] bg-[var(--modal-surface-bg)] ring-1 ring-[var(--modal-surface-ring)]',
                  'backdrop-blur-xl backdrop-saturate-150',
                  'before:pointer-events-none before:absolute before:inset-0 before:rounded-2xl before:content-[""]',
                  'before:bg-[image:var(--modal-surface-glass-highlight)]',
                ].join(' ')
              : 'bg-[var(--modal-surface-bg)] border border-[var(--modal-surface-border)] text-[var(--color-text-primary)] rounded-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl transform transition-all duration-300 animate-fade-in',
          maxWidthClasses[maxWidth]
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2
            id="modal-title"
            className={cn(
              'text-xl font-semibold transition-colors duration-200',
              'text-[var(--color-text-primary)]'
            )}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className={cn(
              'text-2xl leading-none transition-colors duration-200 w-8 h-8 flex items-center justify-center rounded-full',
              variant === 'glass'
                ? 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[rgba(var(--rgb-white),0.08)]'
                : isUploadVariant
                  ? 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[rgba(var(--rgb-white),0.06)] rounded-md'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[rgba(var(--rgb-white),0.06)]',
              loading && 'opacity-50 cursor-not-allowed'
            )}
            aria-label="关闭"
          >
            ×
          </button>
        </div>
        {description && (
          <p
            className={cn(
              'mb-4 text-sm transition-colors duration-200',
              'text-[var(--color-text-secondary)]'
            )}
          >
            {description}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
