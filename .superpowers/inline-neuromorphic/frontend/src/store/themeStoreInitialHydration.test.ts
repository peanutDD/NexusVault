import { beforeEach, describe, expect, it, vi } from "vitest";

function resetRootTheme() {
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.classList.remove(
    "dark",
    "light",
    "purple",
    "terminal",
    "portfolio",
    "neuromorphic",
    "neuromorphic-style",
  );
}

describe("theme store initial hydration", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    resetRootTheme();
  });

  it("migrates persisted Neuromorphic to Dark during module init", async () => {
    localStorage.setItem(
      "theme-storage",
      JSON.stringify({
        state: {
          theme: "neuromorphic",
          effectiveTheme: "neuromorphic",
        },
      }),
    );

    await import("./themeStore");

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement).toHaveClass("dark", "neuromorphic-style");
    expect(document.documentElement).not.toHaveClass("neuromorphic", "light");

    const persistedTheme = JSON.parse(localStorage.getItem("theme-storage") ?? "{}");
    expect(persistedTheme.state.theme).toBe("dark");
    expect(persistedTheme.state.effectiveTheme).toBe("dark");
  });

  it("hydrates persisted Dark as Dark identity with Neuromorphic styling hooks", async () => {
    localStorage.setItem(
      "theme-storage",
      JSON.stringify({
        state: {
          theme: "dark",
          effectiveTheme: "dark",
        },
      }),
    );

    await import("./themeStore");

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement).toHaveClass("dark", "neuromorphic-style");
    expect(document.documentElement).not.toHaveClass("neuromorphic", "light");
  });
});
