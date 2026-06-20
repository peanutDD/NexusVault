import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "../../utils/cn";

interface NeuDatePickerProps {
  ariaLabel: string;
  onChange: (value: string) => void;
  testIdPrefix: string;
  value: string;
}

const weekdayLabels = ["日", "一", "二", "三", "四", "五", "六"] as const;

const triggerClassName =
  "neu-inset relative flex w-full min-w-0 min-h-[clamp(2.5rem,5.8vw,2.75rem)] items-center justify-between gap-[clamp(0.64rem,1.75vw,0.8rem)] rounded-[clamp(0.7rem,1.6vw,0.75rem)] px-[clamp(0.78rem,1.8vw,1rem)] pr-[clamp(2.7rem,6.4vw,3.1rem)] py-[clamp(0.68rem,1.5vw,0.75rem)] text-left text-[length:var(--settings-text-sm)] font-semibold text-[var(--settings-form-input-text)] focus:outline-none focus:ring-2 focus:ring-[var(--settings-form-input-ring)]";

const popoverClassName =
  "neu-raised fixed z-40 overflow-y-auto overscroll-contain rounded-[clamp(1rem,2vw,1.1rem)] p-[clamp(0.62rem,1.7vw,0.76rem)]";

const CALENDAR_POPOVER_GAP_PX = 9;
const CALENDAR_POPOVER_MAX_WIDTH_PX = 316;
const CALENDAR_POPOVER_MIN_WIDTH_PX = 264;
const CALENDAR_POPOVER_VIEWPORT_GUTTER_PX = 16;

interface PopoverPosition {
  left: number;
  maxHeight: number;
  top: number;
  width: number;
}

function getViewportWidth() {
  return Math.min(window.innerWidth, window.visualViewport?.width ?? window.innerWidth);
}

function getViewportHeight() {
  return Math.min(window.innerHeight, window.visualViewport?.height ?? window.innerHeight);
}

function resolvePopoverMaxHeight() {
  return Math.max(0, getViewportHeight() - CALENDAR_POPOVER_VIEWPORT_GUTTER_PX * 2);
}

function resolvePopoverLeft(triggerRect: DOMRect) {
  const viewportWidth = getViewportWidth();
  const maxWidth = Math.max(
    CALENDAR_POPOVER_MIN_WIDTH_PX,
    viewportWidth - CALENDAR_POPOVER_VIEWPORT_GUTTER_PX * 2,
  );
  const width = Math.min(
    Math.max(triggerRect.width, CALENDAR_POPOVER_MIN_WIDTH_PX),
    Math.min(CALENDAR_POPOVER_MAX_WIDTH_PX, maxWidth),
  );
  const maxLeft =
    viewportWidth - CALENDAR_POPOVER_VIEWPORT_GUTTER_PX - width;
  const left = Math.min(
    Math.max(triggerRect.left, CALENDAR_POPOVER_VIEWPORT_GUTTER_PX),
    Math.max(CALENDAR_POPOVER_VIEWPORT_GUTTER_PX, maxLeft),
  );

  return { left, width };
}

function resolvePopoverTop(triggerRect: DOMRect, popoverHeight: number) {
  const viewportHeight = getViewportHeight();
  const clampedHeight = Math.min(popoverHeight, resolvePopoverMaxHeight());

  if (clampedHeight <= 0) {
    return triggerRect.bottom + CALENDAR_POPOVER_GAP_PX;
  }

  const minTop = CALENDAR_POPOVER_VIEWPORT_GUTTER_PX;
  const availableBelow =
    viewportHeight - triggerRect.bottom - CALENDAR_POPOVER_VIEWPORT_GUTTER_PX;
  const availableAbove =
    triggerRect.top -
    CALENDAR_POPOVER_GAP_PX -
    CALENDAR_POPOVER_VIEWPORT_GUTTER_PX;

  if (availableBelow >= clampedHeight) {
    return triggerRect.bottom + CALENDAR_POPOVER_GAP_PX;
  }

  if (availableAbove >= clampedHeight) {
    return Math.max(
      minTop,
      triggerRect.top - CALENDAR_POPOVER_GAP_PX - clampedHeight,
    );
  }

  if (availableAbove > availableBelow) {
    return minTop;
  }

  return Math.max(
    minTop,
    viewportHeight -
      CALENDAR_POPOVER_VIEWPORT_GUTTER_PX -
      clampedHeight,
  );
}

function parseDateValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), 12);
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(value: string) {
  const parsed = parseDateValue(value);
  if (!parsed) return "选择日期";
  return `${parsed.getFullYear()}年${String(parsed.getMonth() + 1).padStart(2, "0")}月${String(parsed.getDate()).padStart(2, "0")}日`;
}

function shiftMonth(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1, 12);
}

function buildCalendarDays(viewMonth: Date) {
  const start = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth(),
    1 - new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1, 12).getDay(),
    12,
  );

  return Array.from({ length: 42 }, (_, index) => {
    return new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + index,
      12,
    );
  });
}

function isSameCalendarDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function NeuDatePicker({
  ariaLabel,
  onChange,
  testIdPrefix,
  value,
}: NeuDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => parseDateValue(value) ?? new Date());
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition | null>(null);

  const selectedDate = useMemo(() => parseDateValue(value), [value]);
  const calendarDays = useMemo(() => buildCalendarDays(viewMonth), [viewMonth]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
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

  useEffect(() => {
    if (!isOpen) return;

    const updatePopoverPosition = () => {
      if (!triggerRef.current) return;

      const rect = triggerRef.current.getBoundingClientRect();
      const { left, width } = resolvePopoverLeft(rect);
      const maxHeight = resolvePopoverMaxHeight();
      const top = resolvePopoverTop(
        rect,
        popoverRef.current?.getBoundingClientRect().height ?? 0,
      );

      setPopoverPosition({
        left,
        maxHeight,
        top,
        width,
      });
    };

    updatePopoverPosition();
    const frameId = window.requestAnimationFrame(updatePopoverPosition);
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current || !popoverRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const { left, width } = resolvePopoverLeft(rect);
    const maxHeight = resolvePopoverMaxHeight();
    const top = resolvePopoverTop(
      rect,
      popoverRef.current.getBoundingClientRect().height,
    );

    setPopoverPosition((current) => {
      if (
        current?.left === left &&
        current?.maxHeight === maxHeight &&
        current?.top === top &&
        current?.width === width
      ) {
        return current;
      }

      return { left, maxHeight, top, width };
    });
  }, [isOpen, popoverPosition?.width]);

  const openPicker = () => {
    setViewMonth(parseDateValue(value) ?? new Date());
    setIsOpen(true);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={ariaLabel}
        className={triggerClassName}
        data-testid={`${testIdPrefix}-trigger`}
        ref={triggerRef}
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : openPicker())}
      >
        <span className="inline-flex min-w-0 items-center gap-[clamp(0.48rem,1.35vw,0.62rem)]">
          <CalendarDays
            aria-hidden="true"
            className="h-[clamp(0.84rem,2vw,1rem)] w-[clamp(0.84rem,2vw,1rem)] shrink-0 text-[var(--settings-form-placeholder)]"
          />
          <span className="truncate text-[var(--settings-form-input-text)]">
            {formatDateLabel(value)}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute right-[clamp(0.78rem,2vw,0.96rem)] top-1/2 h-[clamp(0.88rem,2.2vw,1rem)] w-[clamp(0.88rem,2.2vw,1rem)] -translate-y-1/2 text-[var(--settings-form-placeholder)] transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen &&
        popoverPosition &&
        createPortal(
          <div
            aria-label={`${ariaLabel}日历`}
            className={popoverClassName}
            data-testid={`${testIdPrefix}-popover`}
            ref={popoverRef}
            role="dialog"
            style={{
              left: popoverPosition.left,
              maxHeight: `${popoverPosition.maxHeight}px`,
              top: popoverPosition.top,
              width: popoverPosition.width,
            }}
          >
          <div className="neu-inset mb-[clamp(0.62rem,1.6vw,0.76rem)] flex items-center justify-between gap-[clamp(0.64rem,1.75vw,0.8rem)] rounded-[clamp(0.84rem,2vw,1rem)] px-[clamp(0.7rem,1.85vw,0.86rem)] py-[clamp(0.58rem,1.6vw,0.72rem)]">
            <div className="min-w-0">
              <span className="block text-[length:var(--settings-text-xs)] font-semibold uppercase tracking-[0.14em] text-[var(--settings-panel-label)]">
                Calendar
              </span>
              <span className="mt-[clamp(0.06rem,0.18vw,0.1rem)] block truncate text-[length:var(--settings-text-sm)] font-semibold text-[var(--settings-title)]">
                {`${viewMonth.getFullYear()}年${String(viewMonth.getMonth() + 1).padStart(2, "0")}月`}
              </span>
            </div>
            <div className="neu-inset flex items-center gap-[clamp(0.34rem,0.9vw,0.46rem)] rounded-[clamp(0.84rem,2vw,1rem)] p-[clamp(0.18rem,0.52vw,0.26rem)]">
              <button
                aria-label={`上一个${ariaLabel}月份`}
                className="neu-raised-sm inline-flex h-[clamp(1.9rem,5vw,2.15rem)] min-w-[clamp(1.9rem,5vw,2.15rem)] shrink-0 items-center justify-center rounded-[clamp(0.74rem,1.8vw,0.9rem)] px-0 py-0 leading-none active:shadow-[var(--neu-pressed-shadow)]"
                type="button"
                onClick={() => setViewMonth((current) => shiftMonth(current, -1))}
              >
                <ChevronLeft className="h-[clamp(0.78rem,2vw,0.92rem)] w-[clamp(0.78rem,2vw,0.92rem)] shrink-0" />
              </button>
              <button
                aria-label={`下一个${ariaLabel}月份`}
                className="neu-raised-sm inline-flex h-[clamp(1.9rem,5vw,2.15rem)] min-w-[clamp(1.9rem,5vw,2.15rem)] shrink-0 items-center justify-center rounded-[clamp(0.74rem,1.8vw,0.9rem)] px-0 py-0 leading-none active:shadow-[var(--neu-pressed-shadow)]"
                type="button"
                onClick={() => setViewMonth((current) => shiftMonth(current, 1))}
              >
                <ChevronRight className="h-[clamp(0.78rem,2vw,0.92rem)] w-[clamp(0.78rem,2vw,0.92rem)] shrink-0" />
              </button>
            </div>
          </div>

          <div className="neu-inset rounded-[clamp(0.92rem,2.2vw,1rem)] p-[clamp(0.56rem,1.5vw,0.7rem)]">
            <div className="grid grid-cols-7 gap-[clamp(0.16rem,0.5vw,0.24rem)]">
              {weekdayLabels.map((weekday) => (
                <span
                  key={weekday}
                  className="pb-[clamp(0.12rem,0.4vw,0.2rem)] text-center text-[length:var(--settings-text-xs)] font-semibold text-[var(--settings-panel-label)]"
                >
                  {weekday}
                </span>
              ))}
              {calendarDays.map((day) => {
                const dayValue = formatDateValue(day);
                const inCurrentMonth = day.getMonth() === viewMonth.getMonth();
                const today = isSameCalendarDay(day, new Date());
                const selected =
                  selectedDate !== null && isSameCalendarDay(day, selectedDate);

                return (
                  <button
                    key={dayValue}
                    aria-pressed={selected}
                    className={cn(
                      "flex h-[clamp(1.8rem,4.7vw,2rem)] items-center justify-center rounded-[clamp(0.62rem,1.6vw,0.76rem)] text-[length:var(--settings-text-sm)] font-semibold transition-[background,box-shadow,transform,color] duration-200",
                      selected
                        ? "neu-pressed text-[var(--settings-action-text)]"
                        : inCurrentMonth
                          ? "neu-raised-sm text-[var(--settings-title)]"
                          : "neu-flat text-[var(--settings-panel-label)]/70",
                      today && !selected && "ring-1 ring-[var(--settings-form-input-ring)]",
                    )}
                    data-testid={`${testIdPrefix}-day-${dayValue}`}
                    type="button"
                    onClick={() => {
                      onChange(dayValue);
                      setViewMonth(day);
                      setIsOpen(false);
                    }}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="mt-[clamp(0.62rem,1.6vw,0.76rem)] flex items-center justify-between gap-[clamp(0.56rem,1.5vw,0.7rem)]">
              <button
                className="neu-raised-sm px-[clamp(0.7rem,1.85vw,0.86rem)] py-[clamp(0.34rem,0.95vw,0.46rem)] text-[length:var(--settings-text-xs)] active:shadow-[var(--neu-pressed-shadow)]"
                data-testid={`${testIdPrefix}-clear`}
                type="button"
                onClick={() => {
                  onChange("");
                  setIsOpen(false);
                }}
              >
                清除
              </button>
              <button
                className="neu-raised-sm px-[clamp(0.7rem,1.85vw,0.86rem)] py-[clamp(0.34rem,0.95vw,0.46rem)] text-[length:var(--settings-text-xs)] active:shadow-[var(--neu-pressed-shadow)]"
                data-testid={`${testIdPrefix}-today`}
                type="button"
                onClick={() => {
                  onChange(formatDateValue(new Date()));
                  setViewMonth(new Date());
                  setIsOpen(false);
                }}
              >
                今天
              </button>
            </div>
          </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
