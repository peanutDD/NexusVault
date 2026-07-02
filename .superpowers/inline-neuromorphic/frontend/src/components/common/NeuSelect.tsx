import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
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

const triggerClassName =
  "neu-inset settings-neu-inset-control relative flex w-full min-w-0 min-h-[clamp(2.5rem,5.8vw,2.75rem)] items-center justify-between gap-[clamp(0.64rem,1.75vw,0.8rem)] rounded-[clamp(0.7rem,1.6vw,0.75rem)] px-[clamp(0.78rem,1.8vw,1rem)] pr-[clamp(2.55rem,6vw,2.9rem)] py-[clamp(0.68rem,1.5vw,0.75rem)] text-left text-[length:var(--settings-text-sm)] font-semibold text-[var(--settings-form-input-text)] focus:outline-none focus:ring-2 focus:ring-[var(--settings-form-input-ring)]";

const menuClassName =
  "neu-inset settings-neu-inset-panel neuSelectFlatMenu absolute left-0 right-0 top-[calc(100%+clamp(0.48rem,1.35vw,0.62rem))] z-40 max-h-[min(60dvh,clamp(16rem,42vw,22rem))] overflow-y-auto overscroll-contain rounded-[clamp(0.82rem,1.9vw,1rem)] p-[clamp(0.22rem,0.65vw,0.34rem)]";

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
          <div className="grid gap-[clamp(0.08rem,0.25vw,0.14rem)]">
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <button
                  key={option.value}
                  aria-selected={selected}
                  className={cn(
                    "neuSelectOption neuSelectOptionHoverable flex w-full items-center gap-[clamp(0.62rem,1.6vw,0.76rem)] rounded-[clamp(0.58rem,1.35vw,0.72rem)] px-[clamp(0.7rem,1.85vw,0.86rem)] py-[clamp(0.5rem,1.35vw,0.64rem)] text-left text-[length:var(--settings-text-sm)] font-semibold transition-[background,color,filter] duration-200",
                    selected
                      ? "neuSelectOptionSelected text-[var(--settings-action-text)]"
                      : "neuSelectOptionIdle text-[var(--settings-title)]",
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
