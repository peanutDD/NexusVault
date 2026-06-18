import { cn } from "../../utils/cn";

export function settingsLabelClass(className?: string) {
  return cn(
    "block text-[length:var(--settings-text-sm)] font-medium text-[var(--settings-form-label)] mb-[clamp(0.39rem,0.9vw,0.5rem)]",
    className,
  );
}

export function settingsInputClass(hasError?: boolean, className?: string) {
  return cn(
    "settings-neu-inset-control w-full min-w-0 rounded-[clamp(0.7rem,1.6vw,0.75rem)] px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.68rem,1.5vw,0.75rem)]",
    "[background:var(--settings-form-input-bg)] border border-[var(--settings-form-input-border)]",
    "shadow-[var(--settings-form-input-shadow)] transition-[border-color,box-shadow,background] duration-200",
    "text-[var(--settings-form-input-text)] placeholder:text-[var(--settings-form-placeholder)]",
    "hover:border-[var(--settings-form-input-border-focus)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--settings-form-input-ring)] focus:border-[var(--settings-form-input-border-focus)] focus:shadow-[var(--settings-form-input-shadow-focus)]",
    hasError &&
      "border-[var(--settings-form-error)] focus:ring-[var(--settings-form-error)]",
    className,
  );
}

export function settingsErrorClass(className?: string) {
  return cn(
    "font-brand mt-[clamp(0.195rem,0.45vw,0.25rem)] text-[length:var(--settings-text-xs)] font-normal tracking-wide text-[var(--settings-form-error)]",
    className,
  );
}

export function settingsHelperClass(className?: string) {
  return cn(
    "font-brand mt-[clamp(0.195rem,0.45vw,0.25rem)] text-[length:var(--settings-text-xs)] font-normal tracking-wide text-[var(--settings-form-helper)]",
    className,
  );
}

export function settingsPrimaryButtonClass(className?: string) {
  return cn(
    "settings-neu-primary-button inline-flex min-w-0 items-center justify-center whitespace-nowrap rounded-[clamp(0.7rem,1.6vw,0.75rem)] px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.68rem,1.5vw,0.75rem)] text-center text-[length:var(--settings-text-sm)] font-medium leading-none",
    "border border-[var(--settings-action-border)] [background:var(--settings-action-bg)] text-[var(--settings-action-text)] shadow-[var(--settings-action-shadow)]",
    "transition-[transform,box-shadow,background] duration-200 hover:[background:var(--settings-action-bg-hover)] hover:-translate-y-[clamp(0.08rem,0.18vw,0.125rem)] active:translate-y-[clamp(0.04rem,0.1vw,0.0625rem)] active:shadow-[var(--settings-action-shadow-active)]",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    className,
  );
}

export function settingsPrimaryPillClass(className?: string) {
  return cn(
    "settings-neu-primary-pill inline-flex min-w-0 items-center justify-center whitespace-nowrap rounded-full px-[clamp(0.95rem,2.4vw,1.4rem)] py-[clamp(0.62rem,1.35vw,0.78rem)] text-center text-[length:var(--settings-text-sm)] font-semibold leading-none tracking-wide",
    "border border-[var(--settings-action-border)] [background:var(--settings-action-bg)] text-[var(--settings-action-text)] shadow-[var(--settings-action-shadow)]",
    "transition-[transform,box-shadow,background] duration-200 hover:[background:var(--settings-action-bg-hover)] hover:-translate-y-[clamp(0.08rem,0.18vw,0.125rem)] active:translate-y-[clamp(0.04rem,0.1vw,0.0625rem)] active:shadow-[var(--settings-action-shadow-active)]",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    className,
  );
}

export function settingsSecondaryButtonClass(className?: string) {
  return cn(
    "settings-neu-raised-button inline-flex min-w-0 items-center justify-center whitespace-nowrap rounded-[clamp(0.7rem,1.6vw,0.75rem)] px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.68rem,1.5vw,0.75rem)] text-center text-[length:var(--settings-text-sm)] font-medium leading-none",
    "border border-[var(--settings-secondary-border)] [background:var(--settings-secondary-bg)] text-[var(--settings-secondary-text)] shadow-[var(--settings-secondary-shadow)]",
    "transition-[border-color,box-shadow,background,transform] duration-200 hover:[background:var(--settings-secondary-bg-hover)] hover:border-[var(--settings-secondary-border-hover)] hover:shadow-[var(--settings-secondary-shadow-hover)] hover:-translate-y-[clamp(0.08rem,0.18vw,0.125rem)] active:translate-y-[clamp(0.04rem,0.1vw,0.0625rem)] active:shadow-[var(--settings-secondary-shadow-active)]",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    className,
  );
}

export function settingsPanelClass(className?: string) {
  return cn(
    "settings-neu-inset-panel rounded-[clamp(0.7rem,1.6vw,0.75rem)] border border-transparent [background:var(--neu-inset-bg)] p-[clamp(0.78rem,1.8vw,1rem)] shadow-[var(--neu-inset-shadow)] transition-[box-shadow,background,filter] duration-200",
    className,
  );
}
