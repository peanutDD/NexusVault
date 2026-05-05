import { cn } from "../../utils/cn";

export function settingsLabelClass(className?: string) {
  return cn(
    "font-brand block text-[length:var(--settings-text-sm)] font-medium tracking-wide text-[var(--settings-form-label)] mb-2",
    className,
  );
}

export function settingsInputClass(hasError?: boolean, className?: string) {
  return cn(
    "w-full min-w-0 rounded-xl px-4 py-2.5",
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
    "font-brand mt-1 text-[length:var(--settings-text-xs)] font-normal tracking-wide text-[var(--settings-form-error)]",
    className,
  );
}

export function settingsHelperClass(className?: string) {
  return cn(
    "font-brand mt-1 text-[length:var(--settings-text-xs)] font-normal tracking-wide text-[var(--settings-form-helper)]",
    className,
  );
}

export function settingsPrimaryButtonClass(className?: string) {
  return cn(
    "font-brand rounded-xl px-4 py-2.5 font-semibold tracking-wide",
    "border border-[var(--settings-action-border)] bg-[var(--settings-action-bg)] text-[var(--settings-action-text)] shadow-[var(--settings-action-shadow)]",
    "hover:bg-[image:var(--settings-action-bg-hover)]",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    className,
  );
}

export function settingsSecondaryButtonClass(className?: string) {
  return cn(
    "font-brand rounded-xl px-4 py-2.5 text-[length:var(--settings-text-sm)] font-semibold tracking-wide",
    "border border-[var(--settings-secondary-border)] bg-[var(--settings-secondary-bg)] text-[var(--settings-secondary-text)]",
    "hover:bg-[var(--settings-secondary-bg-hover)] hover:border-[var(--settings-secondary-border-hover)]",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    className,
  );
}

export function settingsPanelClass(className?: string) {
  return cn(
    "rounded-xl border border-[var(--settings-panel-border)] bg-[var(--settings-panel-bg)] p-4",
    className,
  );
}
