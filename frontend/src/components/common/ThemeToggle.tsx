//! # Theme Toggle Component
//!
//! 主题切换按钮组件，支持深色/浅色模式切换。

import { useThemeStore } from '../../store/themeStore';
import { cn } from '../../utils/cn';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

/**
 * 主题切换按钮
 *
 * 点击可在深色和浅色模式之间切换。
 */
export default function ThemeToggle({ className, showLabel = false }: ThemeToggleProps) {
  const { effectiveTheme, toggleTheme } = useThemeStore();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        'nav-btn inline-flex items-center justify-center whitespace-nowrap',
        'nav-ui-fluid font-semibold tracking-wide text-[var(--nav-btn-text)]',
        'bg-[var(--nav-btn-bg)] border border-[var(--nav-btn-border)]',
        'hover:bg-[var(--nav-btn-bg-hover)] hover:border-[var(--nav-btn-border-hover)]',
        'active:translate-y-px transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-emerald-500/25 dark:focus:ring-emerald-300/25 focus:ring-offset-2 focus:ring-offset-white/80 dark:focus:ring-offset-slate-950/60',
        className
      )}
      aria-label={`切换到${effectiveTheme === 'dark' ? '浅色' : '深色'}模式`}
      title={`当前: ${effectiveTheme === 'dark' ? '深色' : '浅色'}模式`}
    >
      <div className={cn('flex items-center', showLabel ? 'gap-2' : 'gap-0')}>
        {effectiveTheme === 'dark' ? (
          <svg
            className={cn(
              'w-5 h-5 transition-transform duration-200 hover:rotate-12',
              'block'
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
        ) : (
          <svg
            className={cn(
              'w-5 h-5 transition-transform duration-200 hover:rotate-12',
              'block'
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
            />
          </svg>
        )}
        {showLabel && (
          <span className="text-sm">
            {effectiveTheme === 'dark' ? '浅色' : '深色'}
          </span>
        )}
      </div>
    </button>
  );
}
