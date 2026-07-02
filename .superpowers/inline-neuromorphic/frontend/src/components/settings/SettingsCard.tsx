import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

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
        "scroll-mt-[clamp(6.75rem,12.6vw,7rem)]",
        "neu-raised settings-neu-raised-card group/settings-card relative isolate overflow-hidden rounded-[clamp(1.25rem,3vw,1.5rem)]",
        "border-0",
        "transition-[box-shadow,transform] duration-300",
        "hover:shadow-[var(--neu-raised-shadow)]",
        "text-[length:var(--settings-text-md)]",
        "p-[clamp(1rem,2.25vw,1.25rem)] sm:p-[clamp(1.25rem,2.7vw,1.5rem)]",
        className,
      )}
      data-testid="settings-card-shell"
      data-oid="au1p9wx"
    >
      <header
        className="relative z-10 flex items-start gap-[clamp(0.585rem,1.35vw,0.75rem)]"
        data-oid="07m066k"
      >
        {icon && (
          <div
            className="neu-raised-sm mt-[clamp(0.0975rem,0.3vw,0.125rem)] shrink-0 rounded-[clamp(0.7rem,1.6vw,0.75rem)] border-0 p-[clamp(0.39rem,0.9vw,0.5rem)] text-[var(--settings-chip-icon)] transition-[box-shadow,color] duration-300"
            data-oid="9ktkh.m"
          >
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1" data-oid="6rho:-6">
          <h2
            className="font-brand text-[length:var(--settings-text-lg)] font-semibold tracking-wide text-[var(--settings-title)]"
            data-oid="h.-c1fg"
          >
            {title}
          </h2>
          {description && (
            <p
              className="font-brand mt-[clamp(0.195rem,0.45vw,0.25rem)] text-[length:var(--settings-text-sm)] font-normal leading-relaxed tracking-wide text-[var(--settings-subtitle)]"
              data-oid="vftcw.7"
            >
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="shrink-0" data-oid="dt:zj1u">
            {actions}
          </div>
        )}
      </header>

      <div className="relative z-10 mt-[clamp(1rem,2.25vw,1.25rem)]" data-oid="4462rmf">
        {children}
      </div>
    </section>
  );
}
