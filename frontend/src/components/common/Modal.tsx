import { type ReactNode, useEffect } from 'react';
import { cn } from '../../utils/cn';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
  description?: string;
  variant?: 'default' | 'glass' | 'upload';
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
}: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const isUploadVariant = variant === 'upload';

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in',
        variant === 'glass' || isUploadVariant ? 'bg-black/70' : 'bg-black/80 dark:bg-black/90'
      )}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
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
          maxWidthClasses[maxWidth]
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2
            id="modal-title"
            className={cn(
              'text-xl font-semibold transition-colors duration-200',
              isUploadVariant ? 'text-white' : 'text-white dark:text-gray-100'
            )}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'text-2xl leading-none transition-colors duration-200 w-8 h-8 flex items-center justify-center rounded-full',
              variant === 'glass'
                ? 'text-white/70 hover:text-white hover:bg-white/10'
                : isUploadVariant
                  ? 'text-gray-500 hover:text-white hover:bg-gray-800 rounded-md'
                  : 'text-gray-400 dark:text-gray-500 hover:text-white dark:hover:text-gray-200 hover:bg-gray-700/50 dark:hover:bg-gray-800/50'
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
              isUploadVariant ? 'text-gray-500' : 'text-gray-300 dark:text-gray-400'
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
