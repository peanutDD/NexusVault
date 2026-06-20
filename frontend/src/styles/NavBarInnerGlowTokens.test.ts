import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));

const THEME_SELECTORS = {
  light: /:root\[data-theme="light"\],\s*:root\.light\s*\{/,
  dark: /:root\[data-theme="dark"\],\s*:root\.dark\s*\{/,
} as const;

function readTokens(selectorPattern: RegExp) {
  const css = readFileSync(resolve(__dirname, "tokens.css"), "utf8");
  const selector = selectorPattern.exec(css);
  expect(selector).not.toBeNull();
  const body = css
    .slice((selector?.index ?? 0) + (selector?.[0].length ?? 0))
    .match(/^[\s\S]*?(?=\s*})/)?.[0] ?? "";
  return new Map([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [
    match[1],
    match[2].trim(),
  ]));
}

describe("NavBar global primitive tokens", () => {
  it.each(Object.entries(THEME_SELECTORS))(
    "maps %s navigation surfaces to the shared primitives",
    (_theme, selector) => {
      const tokens = readTokens(selector);

      expect(tokens.get("--nav-surface-bg")).toBe("var(--neu-raised-bg)");
      expect(tokens.get("--nav-panel-bg")).toBe("var(--neu-inset-bg)");
      expect(tokens.get("--nav-panel-border")).toBe("transparent");
      expect(tokens.get("--nav-panel-shadow")).toBe("var(--neu-inset-shadow)");
      expect(tokens.get("--nav-btn-border")).toBe("transparent");
      expect(tokens.get("--nav-btn-inner-glow")).toBe("0 0 0 transparent");
      expect(tokens.get("--nav-btn-inner-glow-hover")).toBe("0 0 0 transparent");
      expect(tokens.get("--nav-tab-active-shadow")).toBe("var(--neu-control-shadow)");
    },
  );

  it("does not reintroduce a theme-specific gradient navigation surface", () => {
    for (const selector of Object.values(THEME_SELECTORS)) {
      const tokens = readTokens(selector);

      expect(tokens.get("--nav-surface-bg")).not.toContain("gradient");
      expect(tokens.get("--nav-panel-bg")).not.toContain("gradient");
      expect(tokens.get("--nav-btn-bg")).not.toContain("gradient");
    }
  });
});
