import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NeuDatePicker } from "./NeuDatePicker";

describe("NeuDatePicker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("portals the calendar outside clipped parent shells and centers month nav buttons", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(
      <section data-testid="clipped-shell" className="overflow-hidden rounded-3xl">
        <NeuDatePicker
          ariaLabel="开始日期"
          onChange={onChange}
          testIdPrefix="date-picker"
          value="2026-05-25"
        />
      </section>,
    );

    await user.click(screen.getByTestId("date-picker-trigger"));

    const popover = screen.getByTestId("date-picker-popover");
    expect(popover).toBeInTheDocument();
    expect(container.querySelector('[data-testid="date-picker-popover"]')).toBeNull();
    expect(screen.getByTestId("clipped-shell")).not.toContainElement(popover);

    const prevButton = screen.getByRole("button", { name: "上一个开始日期月份" });
    const nextButton = screen.getByRole("button", { name: "下一个开始日期月份" });

    expect(prevButton).toHaveClass("inline-flex", "items-center", "justify-center", "leading-none");
    expect(nextButton).toHaveClass("inline-flex", "items-center", "justify-center", "leading-none");
  });

  it("repositions the calendar upward when opening downward would overflow the viewport", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const innerHeight = window.innerHeight;
    const innerWidth = window.innerWidth;

    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 720,
      writable: true,
    });
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1280,
      writable: true,
    });

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.dataset.testid === "date-picker-trigger") {
        return {
          bottom: 620,
          height: 52,
          left: 94,
          right: 372,
          top: 568,
          width: 278,
          x: 94,
          y: 568,
          toJSON: () => ({}),
        } as DOMRect;
      }

      if (this.dataset.testid === "date-picker-popover") {
        return {
          bottom: 565,
          height: 360,
          left: 94,
          right: 372,
          top: 205,
          width: 278,
          x: 94,
          y: 205,
          toJSON: () => ({}),
        } as DOMRect;
      }

      return {
        bottom: 0,
        height: 0,
        left: 0,
        right: 0,
        top: 0,
        width: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    });

    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get(this: HTMLElement) {
        return this.dataset.testid === "date-picker-popover" ? 360 : 52;
      },
    });

    render(
      <NeuDatePicker
        ariaLabel="开始日期"
        onChange={onChange}
        testIdPrefix="date-picker"
        value="2026-05-25"
      />,
    );

    await user.click(screen.getByTestId("date-picker-trigger"));

    const popover = await screen.findByTestId("date-picker-popover");

    await waitFor(() => {
      expect(Number.parseFloat(popover.style.top)).toBeLessThan(568);
    });

    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: innerHeight,
      writable: true,
    });
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: innerWidth,
      writable: true,
    });
  });

  it("caps the popover height inside short viewports and enables internal scrolling", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const innerHeight = window.innerHeight;
    const innerWidth = window.innerWidth;

    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 504,
      writable: true,
    });
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 381,
      writable: true,
    });

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.dataset.testid === "date-picker-trigger") {
        return {
          bottom: 271,
          height: 38,
          left: 53,
          right: 337,
          top: 233,
          width: 284,
          x: 53,
          y: 233,
          toJSON: () => ({}),
        } as DOMRect;
      }

      if (this.dataset.testid === "date-picker-popover") {
        return {
          bottom: 660,
          height: 520,
          left: 53,
          right: 337,
          top: 140,
          width: 284,
          x: 53,
          y: 140,
          toJSON: () => ({}),
        } as DOMRect;
      }

      return {
        bottom: 0,
        height: 0,
        left: 0,
        right: 0,
        top: 0,
        width: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    });

    render(
      <NeuDatePicker
        ariaLabel="结束日期"
        onChange={onChange}
        testIdPrefix="date-picker-short"
        value="2026-05-25"
      />,
    );

    await user.click(screen.getByTestId("date-picker-short-trigger"));

    const popover = await screen.findByTestId("date-picker-short-popover");

    await waitFor(() => {
      expect(popover.style.maxHeight).toBe("472px");
    });
    expect(popover).toHaveClass("overflow-y-auto", "overscroll-contain");

    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: innerHeight,
      writable: true,
    });
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: innerWidth,
      writable: true,
    });
  });

  it("fills today with a background and disables future dates", async () => {
    const onChange = vi.fn();

    render(
      <NeuDatePicker
        ariaLabel="开始日期"
        onChange={onChange}
        testIdPrefix="date-picker"
        today={new Date(2026, 5, 28, 12)}
        value=""
      />,
    );

    fireEvent.click(screen.getByTestId("date-picker-trigger"));

    const today = await screen.findByTestId("date-picker-day-2026-06-28");
    const tomorrow = screen.getByTestId("date-picker-day-2026-06-29");
    const nextMonthDay = screen.getByTestId("date-picker-day-2026-07-01");

    expect(today).toHaveClass("neuDatePickerDayToday");
    expect(today).not.toHaveClass("ring-1");
    expect(tomorrow).toBeDisabled();
    expect(nextMonthDay).toBeDisabled();

    fireEvent.click(tomorrow);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps ordinary date cells separated without raised glow shadows", async () => {
    render(
      <NeuDatePicker
        ariaLabel="结束日期"
        onChange={vi.fn()}
        testIdPrefix="date-picker"
        today={new Date(2026, 5, 28, 12)}
        value=""
      />,
    );

    fireEvent.click(screen.getByTestId("date-picker-trigger"));

    expect(await screen.findByTestId("date-picker-day-2026-06-10")).toHaveClass(
      "neuDatePickerDay",
    );
    expect(screen.getByTestId("date-picker-day-2026-06-10")).not.toHaveClass(
      "neu-raised-sm",
      "shadow-[var(--neu-raised-sm-shadow)]",
    );
  });
});
