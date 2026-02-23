import { useEffect } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { cn } from '../../../utils/cn';

interface ErrorMessageProps {
  message: string;
  onClose?: () => void;
  type?: 'error' | 'warning' | 'info';
  className?: string;
  /** 多少毫秒后自动关闭，不传则不自动关闭 */
  autoDismissMs?: number;
}

const typeConfig = {
  error: {
    icon: AlertCircle,
    iconClass: 'text-rose-400',
    borderClass: 'border-rose-400/50',
    accentClass: 'from-rose-500/15 via-transparent to-transparent',
    hairlineClass: 'via-rose-400/50',
  },
  warning: {
    icon: AlertCircle,
    iconClass: 'text-amber-400',
    borderClass: 'border-amber-400/50',
    accentClass: 'from-amber-500/15 via-transparent to-transparent',
    hairlineClass: 'via-amber-400/50',
  },
  info: {
    icon: CheckCircle2,
    iconClass: 'text-emerald-400',
    borderClass: 'border-emerald-400/50',
    accentClass: 'from-emerald-500/15 via-transparent to-cyan-500/15',
    hairlineClass: 'via-emerald-300/50',
  },
} as const;

export default function ErrorMessage({
  message,
  onClose,
  type = 'error',
  className,
  autoDismissMs,
}: ErrorMessageProps) {
  const config = typeConfig[type];
  const Icon = config.icon;

  useEffect(() => {
    if (autoDismissMs != null && autoDismissMs > 0 && onClose) {
      const timer = window.setTimeout(onClose, autoDismissMs);
      return () => window.clearTimeout(timer);
    }
  }, [autoDismissMs, onClose]);

  return (
    <div
      className={cn(
        'relative w-full min-w-0 overflow-hidden rounded-2xl border-2 p-4',
        'bg-slate-900/80 backdrop-blur-xl',
        'shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_12px_40px_rgba(0,0,0,0.5)]',
        config.borderClass,
        'animate-fade-in transition-all duration-200',
        className
      )}
      role="alert"
    >
      {/* Glassmorphism ambient glow */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 bg-gradient-to-r',
          config.accentClass
        )}
      />
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent',
          config.hairlineClass
        )}
      />

      <div className="relative z-10 flex items-center gap-3">
        <div
          className={cn(
            'shrink-0 rounded-xl border border-current/10 bg-current/5 p-2',
            config.iconClass
          )}
        >
          <Icon className="h-5 w-5 text-current" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm font-medium tracking-wide', config.iconClass)}>
            {message}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-slate-200"
            aria-label="关闭"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
