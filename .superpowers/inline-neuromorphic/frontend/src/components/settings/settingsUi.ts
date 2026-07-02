import { cn } from "../../utils/cn";

export function settingsLabelClass(className?: string) {
  return cn(
    "block text-[length:var(--settings-text-sm)] font-medium text-[var(--settings-form-label)] mb-[clamp(0.39rem,0.9vw,0.5rem)]",
    className,
  );
}

export function settingsInputClass(hasError?: boolean, className?: string) {
  return cn(
    "neu-inset settings-neu-inset-control w-full min-w-0 rounded-[clamp(0.7rem,1.6vw,0.75rem)] border-0 px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.68rem,1.5vw,0.75rem)]",
    "transition-[box-shadow,color] duration-200",
    "text-[var(--settings-form-input-text)] placeholder:text-[var(--settings-form-placeholder)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--neu-surface-bg-green)] focus:shadow-[var(--neu-pressed-shadow)]",
    hasError &&
      "text-[var(--settings-form-error)] focus:ring-[var(--settings-form-error)]",
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
    "neu-raised-green settings-neu-primary-button inline-flex min-w-0 items-center justify-center whitespace-nowrap rounded-[clamp(0.7rem,1.6vw,0.75rem)] border-0 px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.68rem,1.5vw,0.75rem)] text-center text-[length:var(--settings-text-sm)] font-medium leading-none",
    "text-[var(--settings-action-text)]",
    "transition-[transform,box-shadow,color] duration-200 hover:-translate-y-[clamp(0.08rem,0.18vw,0.125rem)] active:translate-y-[clamp(0.04rem,0.1vw,0.0625rem)] active:shadow-[var(--neu-pressed-shadow)]",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    className,
  );
}

export function settingsPrimaryPillClass(className?: string) {
  return cn(
    "neu-raised-green settings-neu-primary-pill inline-flex min-w-0 items-center justify-center whitespace-nowrap rounded-full border-0 px-[clamp(0.95rem,2.4vw,1.4rem)] py-[clamp(0.62rem,1.35vw,0.78rem)] text-center text-[length:var(--settings-text-sm)] font-semibold leading-none tracking-wide",
    "text-[var(--settings-action-text)]",
    "transition-[transform,box-shadow,color] duration-200 hover:-translate-y-[clamp(0.08rem,0.18vw,0.125rem)] active:translate-y-[clamp(0.04rem,0.1vw,0.0625rem)] active:shadow-[var(--neu-pressed-shadow)]",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    className,
  );
}

export function settingsSecondaryButtonClass(className?: string) {
  return cn(
    "neu-raised-sm settings-neu-raised-button inline-flex min-w-0 items-center justify-center whitespace-nowrap rounded-[clamp(0.7rem,1.6vw,0.75rem)] border-0 px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.68rem,1.5vw,0.75rem)] text-center text-[length:var(--settings-text-sm)] font-medium leading-none",
    "text-[var(--settings-secondary-text)]",
    "transition-[box-shadow,color,transform] duration-200 hover:-translate-y-[clamp(0.08rem,0.18vw,0.125rem)] active:translate-y-[clamp(0.04rem,0.1vw,0.0625rem)] active:shadow-[var(--neu-pressed-shadow)]",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    className,
  );
}

export function settingsPanelClass(className?: string) {
  return cn(
    "neu-inset settings-neu-inset-panel rounded-[clamp(0.7rem,1.6vw,0.75rem)] border-0 p-[clamp(0.78rem,1.8vw,1rem)] transition-[box-shadow,filter] duration-200",
    className,
  );
}
