import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FileListLightCanvasBackground from "./FileListLightCanvasBackground";

const canvasContext = {
  arc: vi.fn(),
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  closePath: vi.fn(),
  createRadialGradient: vi.fn(() => ({
    addColorStop: vi.fn(),
  })),
  fill: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
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
  document.documentElement.className = theme === "light" ? "light neuromorphic" : theme;
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

describe("FileListLightCanvasBackground", () => {
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
  });

  it("renders an inert canvas but does not start the old Shape Wave when light is Neuromorphic", () => {
    render(<FileListLightCanvasBackground />);

    const canvas = screen.getByTestId("filelist-light-canvas-background");
    expect(canvas).toHaveAttribute("aria-hidden", "true");
    expect(canvas).toHaveClass("pointer-events-none", "fixed", "inset-0");
    expect(canvas).toHaveClass("opacity-[var(--filelist-shape-wave-opacity)]");
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
    expect("stroke" in canvasContext).toBe(false);
  });

  it.each(["dark", "purple", "portfolio", "neuromorphic"])(
    "does not start animation for %s mode",
    (theme) => {
      setTheme(theme);

      render(<FileListLightCanvasBackground />);

      expect(window.requestAnimationFrame).not.toHaveBeenCalled();
    },
  );

  it("draws a still frame instead of looping when reduced motion is preferred", () => {
    document.documentElement.className = "light";
    stubMatchMedia(true);

    render(<FileListLightCanvasBackground />);

    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledWith("2d");
    expect(canvasContext.fillRect).toHaveBeenCalled();
    expect(canvasContext.createRadialGradient).toHaveBeenCalled();
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("registers pointer and click listeners while light Shape Wave can run", () => {
    document.documentElement.className = "light";
    const addEventListener = vi.spyOn(window, "addEventListener");

    render(<FileListLightCanvasBackground />);

    expect(addEventListener).toHaveBeenCalledWith("pointermove", expect.any(Function));
    expect(addEventListener).toHaveBeenCalledWith("click", expect.any(Function));
  });

  it("cleans up the scheduled animation frame and runtime listeners on unmount", () => {
    document.documentElement.className = "light";
    const media = stubMatchMedia(false);
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<FileListLightCanvasBackground />);

    unmount();

    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(42);
    expect(removeEventListener).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith("pointermove", expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith("click", expect.any(Function));
    expect(media.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("clears drawn canvas styling when the theme changes away from light", async () => {
    document.documentElement.className = "light";
    stubMatchMedia(true);
    document.documentElement.style.setProperty(
      "--filelist-shape-wave-bg",
      "rgb(244, 250, 255)",
    );
    render(<FileListLightCanvasBackground />);
    const canvas = screen.getByTestId("filelist-light-canvas-background");

    expect(canvas).toHaveStyle({ background: "rgb(244, 250, 255)" });

    setTheme("dark");
    await Promise.resolve();

    expect(canvas).toHaveStyle({ background: "none" });
    document.documentElement.style.removeProperty("--filelist-shape-wave-bg");
  });
});
