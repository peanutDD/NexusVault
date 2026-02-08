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
        'border border-emerald-300/15 bg-slate-950/30',
        'shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_18px_70px_rgba(0,0,0,0.45)]',
        'backdrop-blur-md',
        'p-5 sm:p-6',
        className
      )}
    >
      {/* Ambient glow + top hairline (match the Home / Nav style). */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-fuchsia-500/10 via-transparent to-emerald-400/10" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent" />

      <header className="relative z-10 flex items-start gap-3">
        {icon && (
          <div className="mt-0.5 shrink-0 rounded-xl border border-emerald-300/15 bg-slate-900/40 p-2 text-emerald-200/80">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="font-brand text-base font-semibold tracking-wide text-slate-100 sm:text-lg">
            {title}
          </h2>
          {description && (
            <p className="font-brand mt-1 text-sm font-normal leading-relaxed tracking-wide text-slate-400">
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

