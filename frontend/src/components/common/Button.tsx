import { type ButtonHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const variants: Record<Variant, string> = {
  primary:
    "[background:var(--btn-primary-bg)] text-[var(--btn-primary-text)] shadow-[var(--neu-control-shadow)] hover:[background:var(--btn-primary-bg-hover)] focus:ring-[var(--btn-primary-ring)]",
  secondary:
    "border border-[var(--btn-secondary-border)] [background:var(--btn-secondary-bg)] text-[var(--btn-secondary-text)] shadow-[var(--neu-control-shadow)] hover:[background:var(--btn-secondary-bg-hover)] focus:ring-[var(--btn-secondary-ring)]",
  danger:
    "[background:var(--btn-danger-bg)] text-[var(--btn-danger-text)] shadow-[var(--neu-control-shadow)] hover:[background:var(--btn-danger-bg-hover)] focus:ring-[var(--btn-danger-ring)]",
  ghost:
    "bg-transparent text-[var(--btn-ghost-text)] hover:text-[var(--btn-ghost-text-hover)] focus:ring-[var(--btn-ghost-ring)]",
};

const base =
  "rounded-[clamp(0.4rem,1vw,0.5rem)] px-[clamp(0.75rem,2vw,1rem)] py-[clamp(0.4rem,1vw,0.5rem)] font-medium transition-[background,box-shadow,transform] duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--btn-primary-ring-offset)] disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95 active:shadow-[var(--neu-pressed-shadow)]";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
}

export default function Button({
  variant = "primary",
  loading = false,
  fullWidth = false,
  disabled,
  className,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled ?? loading}
      className={cn(base, variants[variant], fullWidth && "w-full", className)}
      {...rest}
      data-oid="wp46s9l"
    >
      {loading ? "加载中…" : children}
    </button>
  );
}
