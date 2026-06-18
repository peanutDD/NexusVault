import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AuthShapeWaveBackground from "./AuthShapeWaveBackground";

const gradient = {
  addColorStop: vi.fn(),
};

const canvasContext = {
  arc: vi.fn(),
  beginPath: vi.fn(),
  clearRect: vi.fn(),
  closePath: vi.fn(),
  createRadialGradient: vi.fn(() => gradient),
  fill: vi.fn(),
  fillRect: vi.fn(),
  lineTo: vi.fn(),
  moveTo: vi.fn(),
  restore: vi.fn(),
  rotate: vi.fn(),
  roundRect: vi.fn(),
  save: vi.fn(),
  scale: vi.fn(),
  setTransform: vi.fn(),
  translate: vi.fn(),
  fillStyle: "",
  globalAlpha: 1,
};

function setTheme(theme: string) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.className =
    theme === "light" ? "light neuromorphic" : theme === "dark" ? "dark" : theme;
}

function stubMatchMedia(reducedMotion: boolean) {
  const addEventListener = vi.fn();
  const removeEventListener = vi.fn();
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion") && reducedMotion,
    media: query,
    onchange: null,
    addEventListener,
    removeEventListener,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  return { addEventListener, removeEventListener };
}

describe("AuthShapeWaveBackground", () => {
  beforeEach(() => {
    setTheme("light");
    stubMatchMedia(false);
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: 1,
    });
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 768,
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      canvasContext as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(42);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.className = "";
    document.documentElement.style.removeProperty("--auth-page-bg");
    document.documentElement.style.removeProperty("--auth-shape-wave-wash");
  });

  it.each(["dark", "light", "neuromorphic"])(
    "starts as a decorative full-screen canvas for %s auth theme",
    (theme) => {
      setTheme(theme);

      render(<AuthShapeWaveBackground />);

      const canvas = screen.getByTestId("auth-shape-wave-background");
      expect(canvas).toHaveAttribute("aria-hidden", "true");
      expect(canvas).toHaveClass("pointer-events-none", "fixed", "inset-0");
      expect(canvas).toHaveClass("opacity-[var(--auth-shape-wave-opacity)]");
      expect(window.requestAnimationFrame).toHaveBeenCalled();
    },
  );

  it("does not fill the CodePen background over the auth page background", () => {
    document.documentElement.style.setProperty(
      "--auth-page-bg",
      "linear-gradient(145deg, rgb(229, 231, 235), rgb(209, 213, 219))",
    );
    document.documentElement.style.setProperty("--auth-shape-wave-wash", "rgba(255, 255, 255, 0.32)");

    render(<AuthShapeWaveBackground />);
    const canvas = screen.getByTestId("auth-shape-wave-background");

    expect(canvas).toHaveStyle({ background: "transparent" });
    expect(canvasContext.fillStyle).not.toBe("rgb(2, 6, 23)");
  });

  it("draws a still transparent frame instead of looping when reduced motion is preferred", () => {
    stubMatchMedia(true);

    render(<AuthShapeWaveBackground />);

    expect(canvasContext.fillRect).toHaveBeenCalled();
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("observes pointer activity without cancelling input focus defaults", () => {
    const addEventListener = vi.spyOn(window, "addEventListener");
    render(<AuthShapeWaveBackground />);
    const preventDefault = vi.fn();

    const pointerMove = addEventListener.mock.calls.find(([type]) => type === "pointermove")?.[1] as
      | ((event: PointerEvent) => void)
      | undefined;
    const click = addEventListener.mock.calls.find(([type]) => type === "click")?.[1] as
      | ((event: MouseEvent) => void)
      | undefined;
    pointerMove?.({ clientX: 320, clientY: 240, preventDefault } as unknown as PointerEvent);
    click?.({ clientX: 320, clientY: 240, preventDefault } as unknown as MouseEvent);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(window.requestAnimationFrame).toHaveBeenCalled();
  });

  it("cleans up RAF and runtime listeners on unmount", () => {
    const media = stubMatchMedia(false);
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<AuthShapeWaveBackground />);

    unmount();

    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(42);
    expect(removeEventListener).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith("pointermove", expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith("click", expect.any(Function));
    expect(media.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });
});

