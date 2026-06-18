import { beforeEach, describe, expect, it } from "vitest";
import {
  readPersistedThemeFromStorage,
  resolvePersistedTheme,
  useThemeStore,
} from "./themeStore";

function resetThemeStore() {
  localStorage.clear();
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
  useThemeStore.getState().setTheme("dark");
}

describe("theme store", () => {
  beforeEach(() => {
    resetThemeStore();
  });

  it("coerces legacy Terminal values back to Dark", () => {
    (useThemeStore.getState().setTheme as unknown as (theme: string) => void)("terminal");

    expect(useThemeStore.getState()).toMatchObject({
      theme: "dark",
      effectiveTheme: "dark",
    });
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement).toHaveClass("dark", "neuromorphic-style");
    expect(document.documentElement).not.toHaveClass("light", "purple", "terminal", "portfolio", "neuromorphic");

    const persistedTheme = JSON.parse(localStorage.getItem("theme-storage") ?? "{}");
    expect(persistedTheme.state.theme).toBe("dark");
    expect(persistedTheme.state.effectiveTheme).toBe("dark");
  });

  it("coerces legacy Purple values back to Dark", () => {
    (useThemeStore.getState().setTheme as unknown as (theme: string) => void)("purple");

    expect(useThemeStore.getState()).toMatchObject({
      theme: "dark",
      effectiveTheme: "dark",
    });
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement).toHaveClass("dark", "neuromorphic-style");
    expect(document.documentElement).not.toHaveClass("light", "purple", "terminal", "portfolio", "neuromorphic");

    const persistedTheme = JSON.parse(localStorage.getItem("theme-storage") ?? "{}");
    expect(persistedTheme.state.theme).toBe("dark");
    expect(persistedTheme.state.effectiveTheme).toBe("dark");
  });

  it("coerces removed Portfolio values back to Dark", () => {
    (useThemeStore.getState().setTheme as unknown as (theme: string) => void)("portfolio");

    expect(useThemeStore.getState()).toMatchObject({
      theme: "dark",
      effectiveTheme: "dark",
    });
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement).toHaveClass("dark", "neuromorphic-style");
    expect(document.documentElement).not.toHaveClass("light", "purple", "terminal", "portfolio", "neuromorphic");

    const persistedTheme = JSON.parse(localStorage.getItem("theme-storage") ?? "{}");
    expect(persistedTheme.state.theme).toBe("dark");
    expect(persistedTheme.state.effectiveTheme).toBe("dark");
  });

  it("coerces removed Neuromorphic values back to Dark", () => {
    (useThemeStore.getState().setTheme as unknown as (theme: string) => void)("neuromorphic");

    expect(useThemeStore.getState()).toMatchObject({
      theme: "dark",
      effectiveTheme: "dark",
    });
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement).toHaveClass("dark", "neuromorphic-style");
    expect(document.documentElement).not.toHaveClass("light", "purple", "terminal", "portfolio", "neuromorphic");

    const persistedTheme = JSON.parse(localStorage.getItem("theme-storage") ?? "{}");
    expect(persistedTheme.state.theme).toBe("dark");
    expect(persistedTheme.state.effectiveTheme).toBe("dark");
  });

  it("keeps Light visually neuromorphic without the exact Neuromorphic theme class", () => {
    useThemeStore.getState().setTheme("light");

    expect(useThemeStore.getState()).toMatchObject({
      theme: "light",
      effectiveTheme: "light",
    });
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(document.documentElement).toHaveClass("light", "neuromorphic-style");
    expect(document.documentElement).not.toHaveClass("dark", "purple", "terminal", "portfolio", "neuromorphic");
  });

  it("does not let Light classes survive after switching to Dark", () => {
    useThemeStore.getState().setTheme("light");
    useThemeStore.getState().setTheme("dark");

    expect(useThemeStore.getState()).toMatchObject({
      theme: "dark",
      effectiveTheme: "dark",
    });
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement).toHaveClass("dark", "neuromorphic-style");
    expect(document.documentElement).not.toHaveClass("light", "purple", "terminal", "portfolio", "neuromorphic");
  });

  it("keeps Dark identity while opting into Neuromorphic styling hooks", () => {
    useThemeStore.getState().setTheme("dark");

    expect(useThemeStore.getState()).toMatchObject({
      theme: "dark",
      effectiveTheme: "dark",
    });
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement).toHaveClass("dark", "neuromorphic-style");
    expect(document.documentElement).not.toHaveClass("light", "purple", "terminal", "portfolio", "neuromorphic");
  });

  it("prefers the persisted effective theme when legacy storage disagrees", () => {
    const legacyState = {
      theme: "light",
      effectiveTheme: "neuromorphic",
    } as unknown as Parameters<typeof resolvePersistedTheme>[0];

    expect(resolvePersistedTheme(legacyState)).toBe("dark");
  });

  it("migrates persisted Neuromorphic synchronously to Dark for initial store setup", () => {
    localStorage.setItem(
      "theme-storage",
      JSON.stringify({
        state: {
          theme: "light",
          effectiveTheme: "neuromorphic",
        },
      }),
    );

    expect(readPersistedThemeFromStorage()).toBe("dark");
  });

  it("falls back to Dark when persisted theme storage is invalid", () => {
    localStorage.setItem("theme-storage", "{not-json");

    expect(readPersistedThemeFromStorage()).toBe("dark");
  });

  it("falls back to the persisted theme when no effective theme exists", () => {
    expect(resolvePersistedTheme({
      theme: "neuromorphic",
    } as unknown as Parameters<typeof resolvePersistedTheme>[0])).toBe("dark");
  });

  it("cycles themes from dark to light and back to dark", () => {
    const toggleTheme = useThemeStore.getState().toggleTheme;

    toggleTheme();
    expect(useThemeStore.getState().effectiveTheme).toBe("light");

    toggleTheme();
    expect(useThemeStore.getState().effectiveTheme).toBe("dark");
  });
});
