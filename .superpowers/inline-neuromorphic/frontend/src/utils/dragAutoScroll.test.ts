import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculateDragAutoScrollDelta,
  startDragAutoScroll,
  stopDragAutoScroll,
  updateDragAutoScroll,
} from "./dragAutoScroll";

describe("drag auto scroll", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      return window.setTimeout(() => callback(performance.now()), 16);
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
      window.clearTimeout(id);
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 800,
    });
  });

  afterEach(() => {
    stopDragAutoScroll();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("calculates upward and downward speed near viewport edges", () => {
    expect(calculateDragAutoScrollDelta(12, 800)).toBeLessThan(0);
    expect(calculateDragAutoScrollDelta(788, 800)).toBeGreaterThan(0);
    expect(calculateDragAutoScrollDelta(400, 800)).toBe(0);
  });

  it("keeps scrolling while drag pointer remains near the bottom edge", () => {
    const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => {});

    startDragAutoScroll();
    updateDragAutoScroll(790);
    vi.advanceTimersByTime(64);

    expect(scrollBy).toHaveBeenCalled();
    expect(scrollBy).toHaveBeenLastCalledWith({ top: expect.any(Number), behavior: "auto" });
  });
});
