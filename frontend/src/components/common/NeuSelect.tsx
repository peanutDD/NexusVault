import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { settingsInputClass } from "../settings/settingsUi";
import { cn } from "../../utils/cn";

export interface NeuSelectOption {
  label: string;
  value: string;
}

interface NeuSelectProps {
  ariaLabel: string;
  onChange: (value: string) => void;
  options: readonly NeuSelectOption[];
  testIdPrefix: string;
  value: string;
}

const triggerClassName = settingsInputClass(
  false,
  "settings-neu-inset-control flex min-h-[clamp(2.5rem,5.8vw,2.75rem)] items-center justify-between gap-[clamp(0.64rem,1.75vw,0.8rem)] pr-[clamp(2.55rem,6vw,2.9rem)] text-left text-[length:var(--settings-text-sm)] font-semibold",
);

const menuClassName =
  "settings-neu-raised-card absolute left-0 right-0 top-[calc(100%+clamp(0.48rem,1.35vw,0.62rem))] z-40 rounded-[clamp(1rem,2vw,1.1rem)] border border-[var(--settings-surface-border)] [background:var(--settings-surface-bg)] p-[clamp(0.38rem,1vw,0.5rem)] shadow-[var(--settings-surface-shadow)]";

export function NeuSelect({
  ariaLabel,
  onChange,
  options,
  testIdPrefix,
  value,
}: NeuSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? options[0],
    [options, value],
  );

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={triggerClassName}
        data-testid={`${testIdPrefix}-trigger`}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="truncate text-[var(--settings-form-input-text)]">
          {selectedOption?.label ?? ""}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute right-[clamp(0.78rem,2vw,0.96rem)] top-1/2 h-[clamp(0.88rem,2.2vw,1rem)] w-[clamp(0.88rem,2.2vw,1rem)] -translate-y-1/2 text-[var(--settings-form-placeholder)] transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen && (
        <div
          aria-label={`${ariaLabel}选项`}
          className={menuClassName}
          data-testid={`${testIdPrefix}-menu`}
          role="listbox"
        >
          <div className="grid gap-[clamp(0.2rem,0.6vw,0.28rem)]">
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <button
                  key={option.value}
                  aria-selected={selected}
                  className={cn(
                    "flex w-full items-center gap-[clamp(0.62rem,1.6vw,0.76rem)] rounded-[clamp(0.8rem,1.9vw,0.96rem)] border px-[clamp(0.7rem,1.85vw,0.86rem)] py-[clamp(0.62rem,1.7vw,0.78rem)] text-left text-[length:var(--settings-text-sm)] font-semibold transition-[background,border-color,box-shadow,transform] duration-200",
                    selected
                      ? "border-[var(--settings-action-border)] [background:var(--settings-action-bg)] text-[var(--settings-action-text)] shadow-[var(--settings-action-shadow-active)]"
                      : "border-transparent [background:var(--settings-panel-bg)] text-[var(--settings-title)] shadow-[var(--settings-panel-shadow)] hover:border-[var(--settings-panel-border)] hover:-translate-y-[clamp(0.03rem,0.09vw,0.05rem)]",
                  )}
                  role="option"
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                >
                  <span className="flex h-[clamp(0.88rem,2.2vw,1rem)] w-[clamp(0.88rem,2.2vw,1rem)] items-center justify-center">
                    {selected && <Check className="h-[clamp(0.8rem,2vw,0.94rem)] w-[clamp(0.8rem,2vw,0.94rem)]" />}
                  </span>
                  <span className="truncate">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
