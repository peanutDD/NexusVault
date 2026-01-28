import { useEffect, useRef } from 'react';
import { cn } from '../../utils/cn';

export type ConfirmVariant = 'danger' | 'warning' | 'info';
export type ConfirmAppearance = 'default' | 'glass';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  appearance?: ConfirmAppearance;
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
    iconBg: 'bg-red-500/15',
    iconColor: 'text-red-400',
    buttonBg: 'bg-red-600 hover:bg-red-500',
    accentColor: 'from-red-500/20 via-transparent',
  },
  warning: {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-400',
    buttonBg: 'bg-amber-600 hover:bg-amber-500',
    accentColor: 'from-amber-500/20 via-transparent',
  },
  info: {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    iconBg: 'bg-blue-500/15',
    iconColor: 'text-blue-400',
    buttonBg: 'bg-blue-600 hover:bg-blue-500',
    accentColor: 'from-blue-500/20 via-transparent',
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
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const config = variantConfig[variant];
  const isGlass = appearance === 'glass';

  const glassConfirmClass =
    variant === 'danger'
      ? 'border-rose-300/35 bg-rose-500/15 hover:bg-rose-500/20 shadow-[0_14px_40px_rgba(244,63,94,0.18)]'
      : variant === 'warning'
        ? 'border-amber-300/35 bg-amber-500/15 hover:bg-amber-500/20 shadow-[0_14px_40px_rgba(245,158,11,0.16)]'
        : 'border-sky-300/35 bg-sky-500/15 hover:bg-sky-500/20 shadow-[0_14px_40px_rgba(56,189,248,0.16)]';

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel, loading]);

  // 聚焦确认按钮
  useEffect(() => {
    if (open) {
      setTimeout(() => confirmButtonRef.current?.focus(), 100);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
    >
      {/* 背景遮罩 */}
      <div
        className={cn(
          'absolute inset-0 animate-in fade-in duration-150',
          // 玻璃拟态需要“看得见背景”，遮罩不要太黑
          isGlass ? 'bg-black/35 backdrop-blur-sm' : 'bg-black/80'
        )}
        onClick={() => !loading && onCancel()}
      />

      {/* 对话框 */}
      <div
        className={cn(
          'relative w-full max-w-xs overflow-hidden shadow-2xl animate-in zoom-in-95 fade-in duration-150',
          isGlass
            ? [
                // 强化“玻璃感”：优先复用文件列表的玻璃拟态（在 Files 页里会生效）
                'glass-panel rounded-2xl ring-1 ring-white/10',
                // 兜底：如果不在 fileListGlassScope 环境，也要有玻璃感
                'border border-white/20 bg-white/12 text-white backdrop-blur-2xl backdrop-saturate-150',
                'before:pointer-events-none before:absolute before:inset-0 before:content-[""]',
                'before:bg-gradient-to-br before:from-white/25 before:via-fuchsia-400/10 before:to-transparent',
              ].join(' ')
            : 'rounded-lg bg-[#1C1C28] ring-1 ring-white/10'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部渐变光晕 */}
        <div className={cn(
          'absolute inset-x-0 top-0 h-24 bg-gradient-to-b pointer-events-none',
          config.accentColor
        )} />

        <div className="relative p-5">
          {/* 图标 + 标题 行 */}
          <div className="flex items-center gap-3 mb-3">
            <div className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
              config.iconBg,
              config.iconColor
            )}>
              {config.icon}
            </div>
            <h3
              id="confirm-title"
              className="text-base font-medium text-white"
            >
              {title}
            </h3>
          </div>

          {/* 消息 */}
          <p
            id="confirm-message"
            className="text-sm text-gray-400 whitespace-pre-line mb-5 leading-relaxed"
          >
            {message}
          </p>

          {/* 按钮 */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className={cn(
                'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                isGlass
                  ? 'glass-btn text-white/85 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25'
                  : 'bg-[#2A2A3C] text-gray-300 hover:bg-[#3A3A4D] hover:text-white'
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
                'flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white transition-all disabled:cursor-not-allowed disabled:opacity-50',
                isGlass
                  ? cn(
                      'glass-btn border text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25',
                      glassConfirmClass
                    )
                  : cn(config.buttonBg, 'disabled:cursor-not-allowed disabled:opacity-50'),
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
  );
}
