import { cn } from '../../utils/cn';

interface ErrorMessageProps {
  message: string;
  onClose?: () => void;
  type?: 'error' | 'warning' | 'info';
}

const typeClasses = {
  error: 'bg-red-500/20 dark:bg-red-600/20 border-red-500/50 dark:border-red-600/50 text-red-200 dark:text-red-300',
  warning: 'bg-yellow-500/20 dark:bg-yellow-600/20 border-yellow-500/50 dark:border-yellow-600/50 text-yellow-200 dark:text-yellow-300',
  info: 'bg-blue-500/20 dark:bg-blue-600/20 border-blue-500/50 dark:border-blue-600/50 text-blue-200 dark:text-blue-300',
} as const;

export default function ErrorMessage({
  message,
  onClose,
  type = 'error',
}: ErrorMessageProps) {
  return (
    <div
      className={cn(
        'mb-4 p-4 border rounded-lg flex items-start gap-3 animate-fade-in transition-all duration-200',
        typeClasses[type]
      )}
      role="alert"
    >
      <div className="flex-1">
        <p className="text-sm font-medium">{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="flex-shrink-0 text-current opacity-70 hover:opacity-100 transition-opacity"
          aria-label="关闭错误提示"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      )}
    </div>
  );
}
