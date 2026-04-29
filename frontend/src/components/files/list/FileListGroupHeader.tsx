import type { ReactNode } from "react";

interface FileListGroupHeaderProps {
  label: string;
  count: number;
  icon: ReactNode;
  checkbox: ReactNode;
}

export default function FileListGroupHeader({
  label,
  count,
  icon,
  checkbox,
}: FileListGroupHeaderProps) {
  return (
    <div className="mb-3 flex items-center gap-3">
      {checkbox}
      {icon}
      <span className="font-brand text-[clamp(0.7rem,1.4vw,0.8rem)] uppercase tracking-[0.18em] text-[var(--glass-text)]">
        {label}
        <span className="ml-2 text-[0.7em] text-[var(--glass-text-muted)]">
          ({count})
        </span>
      </span>
      <div className="h-px flex-1 bg-[var(--color-border-soft)]" />
    </div>
  );
}
