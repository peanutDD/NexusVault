import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FileListDarkShapeWaveBackground from "./FileListDarkShapeWaveBackground";

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
    theme === "dark" || theme === "light" ? theme : `dark ${theme}`;
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

describe("FileListDarkShapeWaveBackground", () => {
  beforeEach(() => {
    setTheme("dark");
    stubMatchMedia(false);
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
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(7);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.className = "";
  });

  it("renders an inert canvas and starts animation only for exact dark mode", () => {
    render(<FileListDarkShapeWaveBackground />);

    const canvas = screen.getByTestId("filelist-dark-shape-wave-background");
    expect(canvas).toHaveAttribute("aria-hidden", "true");
    expect(canvas).toHaveClass("pointer-events-none", "fixed", "inset-0");
    expect(window.requestAnimationFrame).toHaveBeenCalled();
  });

  it.each(["light", "purple", "portfolio", "neuromorphic"])(
    "does not start animation for %s mode",
    (theme) => {
      setTheme(theme);

      render(<FileListDarkShapeWaveBackground />);

      expect(window.requestAnimationFrame).not.toHaveBeenCalled();
    },
  );

  it("draws a still frame instead of looping when reduced motion is preferred", () => {
    stubMatchMedia(true);

    render(<FileListDarkShapeWaveBackground />);

    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledWith("2d");
    expect(canvasContext.fillRect).toHaveBeenCalled();
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("registers pointer and click listeners only while dark animation can run", () => {
    const addEventListener = vi.spyOn(window, "addEventListener");

    render(<FileListDarkShapeWaveBackground />);

    expect(addEventListener).toHaveBeenCalledWith("pointermove", expect.any(Function));
    expect(addEventListener).toHaveBeenCalledWith("click", expect.any(Function));
    expect(screen.getByTestId("filelist-dark-shape-wave-background")).toHaveClass(
      "pointer-events-none",
    );
  });

  it("cleans up RAF and runtime listeners on unmount", () => {
    const media = stubMatchMedia(false);
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<FileListDarkShapeWaveBackground />);

    unmount();

    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(7);
    expect(removeEventListener).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith("pointermove", expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith("click", expect.any(Function));
    expect(media.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("clears drawn styling when the theme changes away from exact dark", async () => {
    document.documentElement.style.setProperty("--filelist-shape-wave-bg", "rgb(1, 2, 3)");
    render(<FileListDarkShapeWaveBackground />);
    const canvas = screen.getByTestId("filelist-dark-shape-wave-background");

    expect(canvas).toHaveStyle({ background: "rgb(1, 2, 3)" });

    setTheme("purple");
    await Promise.resolve();

    expect(canvas).toHaveStyle({ background: "none" });
    document.documentElement.style.removeProperty("--filelist-shape-wave-bg");
  });
});
