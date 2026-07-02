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
    <div className="mb-[clamp(0.6rem,1.4vw,0.75rem)] flex items-center gap-[clamp(0.6rem,1.4vw,0.75rem)]">
      {checkbox}
      {icon}
      <span className="font-brand text-[clamp(0.7rem,1.4vw,0.8rem)] uppercase tracking-[0.18em] text-[var(--color-text-primary)]">
        {label}
        <span className="ml-[clamp(0.4rem,1vw,0.5rem)] text-[0.7em] text-[var(--color-text-muted)]">
          ({count})
        </span>
      </span>
      <div className="h-px flex-1 bg-slate-500/35" />
    </div>
  );
}
