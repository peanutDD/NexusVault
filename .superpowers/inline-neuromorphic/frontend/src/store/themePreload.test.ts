import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(__dirname, "../..");

function extractThemePreloadScript(): string {
  const html = readFileSync(resolve(frontendRoot, "index.html"), "utf8");
  const match = html.match(/<script id="theme-preload">([\s\S]*?)<\/script>/);
  return match?.[1] ?? "";
}

function readIndexHtml(): string {
  return readFileSync(resolve(frontendRoot, "index.html"), "utf8");
}

function resetDocumentTheme() {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.classList.remove(
    "light",
    "dark",
    "purple",
    "terminal",
    "portfolio",
    "neuromorphic",
    "neuromorphic-style",
  );
}

describe("theme preload script", () => {
  beforeEach(() => {
    resetDocumentTheme();
  });

  it("migrates persisted exact Neuromorphic identity to Dark before React hydrates", () => {
    localStorage.setItem(
      "theme-storage",
      JSON.stringify({
        state: {
          theme: "light",
          effectiveTheme: "neuromorphic",
        },
      }),
    );

    new Function(extractThemePreloadScript())();

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement).toHaveClass("dark", "neuromorphic-style");
    expect(document.documentElement).not.toHaveClass("light", "neuromorphic");

    const persistedTheme = JSON.parse(localStorage.getItem("theme-storage") ?? "{}");
    expect(persistedTheme.state.theme).toBe("dark");
    expect(persistedTheme.state.effectiveTheme).toBe("dark");
  });

  it("keeps Light's style hook without giving it exact Neuromorphic identity", () => {
    localStorage.setItem(
      "theme-storage",
      JSON.stringify({
        state: {
          theme: "light",
          effectiveTheme: "light",
        },
      }),
    );

    new Function(extractThemePreloadScript())();

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(document.documentElement).toHaveClass("light", "neuromorphic-style");
    expect(document.documentElement).not.toHaveClass("neuromorphic", "dark");
  });

  it("keeps Dark identity while enabling Neuromorphic helper styling before React hydrates", () => {
    localStorage.setItem(
      "theme-storage",
      JSON.stringify({
        state: {
          theme: "dark",
          effectiveTheme: "dark",
        },
      }),
    );

    new Function(extractThemePreloadScript())();

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement).toHaveClass("dark", "neuromorphic-style");
    expect(document.documentElement).not.toHaveClass("light", "neuromorphic");
  });

  it("uses NexusVault as the browser document title", () => {
    expect(readIndexHtml()).toContain("<title>NexusVault</title>");
    expect(readIndexHtml()).not.toContain("File Upload Download Server");
  });

});
