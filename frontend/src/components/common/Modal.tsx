import { type ReactNode, useEffect } from 'react';
import { cn } from '../../utils/cn';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
  description?: string;
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
}: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/80 dark:bg-black/90 flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className={cn(
          'bg-gray-800 dark:bg-gray-900 rounded-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl transform transition-all duration-300 animate-fade-in',
          maxWidthClasses[maxWidth]
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2
            id="modal-title"
            className="text-xl font-semibold text-white dark:text-gray-100 transition-colors duration-200"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-white dark:hover:text-gray-200 text-2xl leading-none transition-colors duration-200 rounded-full hover:bg-gray-700/50 dark:hover:bg-gray-800/50 w-8 h-8 flex items-center justify-center"
            aria-label="关闭"
          >
            ×
          </button>
        </div>
        {description && (
          <p className="text-gray-300 dark:text-gray-400 mb-4 text-sm transition-colors duration-200">
            {description}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
