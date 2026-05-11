import { cn } from "../../utils/cn";

export function settingsLabelClass(className?: string) {
  return cn(
    "font-brand block text-[length:var(--settings-text-sm)] font-medium tracking-wide text-[var(--settings-form-label)] mb-[clamp(0.39rem,0.9vw,0.5rem)]",
    className,
  );
}

export function settingsInputClass(hasError?: boolean, className?: string) {
  return cn(
    "w-full min-w-0 rounded-[clamp(0.6rem,1.4vw,0.75rem)] px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.4875rem,1.125vw,0.625rem)]",
    "bg-[var(--settings-form-input-bg)] border border-[var(--settings-form-input-border)]",
    "text-[var(--settings-form-input-text)] placeholder:text-[var(--settings-form-placeholder)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--settings-form-input-ring)] focus:border-[var(--settings-form-input-border-focus)]",
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
    "font-brand rounded-[clamp(0.6rem,1.4vw,0.75rem)] px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.4875rem,1.125vw,0.625rem)] font-semibold tracking-wide",
    "border border-[var(--settings-action-border)] bg-[var(--settings-action-bg)] text-[var(--settings-action-text)] shadow-[var(--settings-action-shadow)]",
    "hover:bg-[image:var(--settings-action-bg-hover)]",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    className,
  );
}

export function settingsSecondaryButtonClass(className?: string) {
  return cn(
    "font-brand rounded-[clamp(0.6rem,1.4vw,0.75rem)] px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.4875rem,1.125vw,0.625rem)] text-[length:var(--settings-text-sm)] font-semibold tracking-wide",
    "border border-[var(--settings-secondary-border)] bg-[var(--settings-secondary-bg)] text-[var(--settings-secondary-text)]",
    "hover:bg-[var(--settings-secondary-bg-hover)] hover:border-[var(--settings-secondary-border-hover)]",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    className,
  );
}

export function settingsPanelClass(className?: string) {
  return cn(
    "rounded-[clamp(0.6rem,1.4vw,0.75rem)] border border-[var(--settings-panel-border)] bg-[var(--settings-panel-bg)] p-[clamp(0.78rem,1.8vw,1rem)]",
    className,
  );
}
