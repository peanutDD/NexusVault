import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FileListPortfolioFireworksBackground from "./FileListPortfolioFireworksBackground";

const canvasContext = {
  arc: vi.fn(),
  beginPath: vi.fn(),
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  lineTo: vi.fn(),
  moveTo: vi.fn(),
  setTransform: vi.fn(),
  stroke: vi.fn(),
  fillStyle: "",
  globalCompositeOperation: "source-over",
  lineWidth: 1,
  strokeStyle: "",
};

const rafCallbacks: FrameRequestCallback[] = [];

function setTheme(theme: string) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.className =
    theme === "dark" || theme === "portfolio" ? `dark ${theme}` : theme;
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

function drainFrames(count: number) {
  for (let index = 0; index < count; index += 1) {
    const callback = rafCallbacks.shift();
    if (!callback) return;
    callback(index * 16);
  }
}

describe("FileListPortfolioFireworksBackground", () => {
  beforeEach(() => {
    setTheme("light");
    stubMatchMedia(false);
    rafCallbacks.length = 0;
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: 2,
    });
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 800,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 600,
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      canvasContext as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    vi.spyOn(Math, "random").mockReturnValue(0.25);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.className = "";
    document.documentElement.style.removeProperty("--filelist-fireworks-bg");
    document.documentElement.style.removeProperty("--filelist-fireworks-trail-fill");
  });

  it.each(["dark", "light"])(
    "renders an inert canvas and starts for exact %s mode",
    (theme) => {
      setTheme(theme);

      render(<FileListPortfolioFireworksBackground />);

      const canvas = screen.getByTestId("filelist-portfolio-fireworks-background");
      expect(canvas).toHaveAttribute("aria-hidden", "true");
      expect(canvas).toHaveClass("pointer-events-none", "fixed", "inset-0");
      expect(canvas).toHaveClass("opacity-[var(--filelist-fireworks-opacity)]");
      expect(window.requestAnimationFrame).toHaveBeenCalled();
    },
  );

  it("uses a shared fireworks test id for the portfolio-derived animation", () => {
    render(<FileListPortfolioFireworksBackground />);

    const canvas = screen.getByTestId("filelist-portfolio-fireworks-background");
    expect(canvas).toBeInTheDocument();
  });

  it.each(["purple", "portfolio"])(
    "does not start animation for %s mode",
    (theme) => {
      setTheme(theme);

      render(<FileListPortfolioFireworksBackground />);

      expect(window.requestAnimationFrame).not.toHaveBeenCalled();
    },
  );

  it("does not start animation for removed exact neuromorphic mode", () => {
    setTheme("neuromorphic");

    render(<FileListPortfolioFireworksBackground />);

    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("draws a still black frame instead of looping when reduced motion is preferred", () => {
    const addEventListener = vi.spyOn(window, "addEventListener");
    stubMatchMedia(true);
    document.documentElement.style.setProperty("--filelist-fireworks-bg", "rgb(0, 0, 0)");

    render(<FileListPortfolioFireworksBackground />);

    expect(canvasContext.fillRect).toHaveBeenCalledWith(0, 0, 800, 600);
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
    expect(addEventListener).not.toHaveBeenCalledWith("pointerdown", expect.any(Function));
  });

  it("uses CodePen fireworks compositing and launches automatically from bottom center", () => {
    render(<FileListPortfolioFireworksBackground />);

    drainFrames(82);

    expect(canvasContext.globalCompositeOperation).toBe("lighter");
    expect(canvasContext.fillStyle).toBe("rgba(0, 0, 0, 0.5)");
    expect(canvasContext.moveTo).toHaveBeenCalledWith(400, 600);
    expect(canvasContext.arc).toHaveBeenCalledWith(200, 75, expect.any(Number), 0, Math.PI * 2);
  });

  it("launches toward the pointer while pressed and creates 30 particles on impact", () => {
    const addEventListener = vi.spyOn(window, "addEventListener");
    render(<FileListPortfolioFireworksBackground />);

    const pointerMove = addEventListener.mock.calls.find(([type]) => type === "pointermove")?.[1] as
      | ((event: PointerEvent) => void)
      | undefined;
    const pointerDown = addEventListener.mock.calls.find(([type]) => type === "pointerdown")?.[1] as
      | ((event: PointerEvent) => void)
      | undefined;

    pointerMove?.({ clientX: 400, clientY: 600 } as PointerEvent);
    pointerDown?.({ clientX: 400, clientY: 600, preventDefault: vi.fn() } as unknown as PointerEvent);
    drainFrames(7);

    expect(canvasContext.arc).toHaveBeenCalledWith(400, 600, expect.any(Number), 0, Math.PI * 2);
    expect(canvasContext.stroke).toHaveBeenCalled();
    expect(vi.mocked(Math.random).mock.calls.length).toBeGreaterThanOrEqual(150);
  });

  it("does not cancel pointer defaults so inputs can receive focus", () => {
    const addEventListener = vi.spyOn(window, "addEventListener");
    render(<FileListPortfolioFireworksBackground />);

    const pointerDown = addEventListener.mock.calls.find(([type]) => type === "pointerdown")?.[1] as
      | ((event: PointerEvent) => void)
      | undefined;
    const pointerUp = addEventListener.mock.calls.find(([type]) => type === "pointerup")?.[1] as
      | ((event: PointerEvent) => void)
      | undefined;
    const preventDefault = vi.fn();

    pointerDown?.({ clientX: 240, clientY: 180, preventDefault } as unknown as PointerEvent);
    pointerUp?.({ clientX: 240, clientY: 180, preventDefault } as unknown as PointerEvent);

    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("cleans up RAF and runtime listeners on unmount", () => {
    const media = stubMatchMedia(false);
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<FileListPortfolioFireworksBackground />);

    unmount();

    expect(window.cancelAnimationFrame).toHaveBeenCalled();
    expect(removeEventListener).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith("pointermove", expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith("pointerdown", expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith("pointerup", expect.any(Function));
    expect(media.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("clears drawn styling when the theme changes away from a fireworks theme", async () => {
    document.documentElement.style.setProperty("--filelist-fireworks-bg", "rgb(0, 0, 0)");
    render(<FileListPortfolioFireworksBackground />);
    const canvas = screen.getByTestId("filelist-portfolio-fireworks-background");

    expect(canvas).toHaveStyle({ background: "rgb(0, 0, 0)" });

    setTheme("purple");
    await Promise.resolve();

    expect(canvas).toHaveStyle({ background: "none" });
  });
});
