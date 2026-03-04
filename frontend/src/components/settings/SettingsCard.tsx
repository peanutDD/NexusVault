import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface SettingsCardProps {
  id?: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function SettingsCard({
  id,
  title,
  description,
  icon,
  actions,
  children,
  className,
}: SettingsCardProps) {
  return (
    <section
      id={id}
      className={cn(
        // Reserve space for the fixed NavBar when using anchor links.
        'scroll-mt-28',
        'relative overflow-hidden rounded-2xl',
        'border border-[var(--settings-surface-border)] bg-[var(--settings-surface-bg)]',
        'shadow-[var(--settings-surface-shadow)]',
        'backdrop-blur-md',
        'text-[length:var(--settings-text-md)]',
        'p-5 sm:p-6',
        className
      )}
    >
      {/* Ambient glow + top hairline (match the Home / Nav style). */}
      <div className="pointer-events-none absolute inset-0 bg-[image:var(--settings-surface-glow)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--settings-surface-hairline)] to-transparent" />

      <header className="relative z-10 flex items-start gap-3">
        {icon && (
          <div className="mt-0.5 shrink-0 rounded-xl border border-[var(--settings-chip-border)] bg-[var(--settings-chip-bg)] p-2 text-[var(--settings-chip-icon)]">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="font-brand text-[length:var(--settings-text-lg)] font-semibold tracking-wide text-[var(--settings-title)]">
            {title}
          </h2>
          {description && (
            <p className="font-brand mt-1 text-[length:var(--settings-text-sm)] font-normal leading-relaxed tracking-wide text-[var(--settings-subtitle)]">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </header>

      <div className="relative z-10 mt-5">{children}</div>
    </section>
  );
}
