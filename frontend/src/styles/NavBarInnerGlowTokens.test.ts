import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));

const THEME_SELECTORS: Record<string, RegExp> = {
  dark: /:root\[data-theme="dark"\],\s*:root\.dark\s*\{/,
  light: /:root\[data-theme="light"\],\s*:root\.light\s*\{/,
};

const LIGHT_NEU_SELECTOR =
  /:root\[data-theme="light"\],\s*:root\.light\s*\{/;

function readCssCustomProperties(selectorPattern: RegExp) {
  const css = readFileSync(resolve(__dirname, "tokens.css"), "utf8");
  const selector = selectorPattern.exec(css);
  expect(selector).not.toBeNull();

  if (!selector) {
    throw new Error(`Missing CSS selector: ${selectorPattern.source}`);
  }

  const ruleBody = css
    .slice(selector.index + selector[0].length)
    .match(/^[\s\S]*?(?=\s*})/)?.[0];
  expect(ruleBody).toBeDefined();

  const properties = new Map<string, string>();
  for (const [, name, value] of (ruleBody ?? "").matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    properties.set(name, value.trim());
  }

  return properties;
}

function readToken(tokens: Map<string, string>, name: string) {
  const value = tokens.get(name);
  expect(value, name).toBeDefined();
  return value ?? "";
}

describe("NavBar inner glow theme tokens", () => {
  it("keeps the base dark block on the restrained inner-glow nav button contract", () => {
    const selector = /:root\s*,\s*\[data-theme="dark"\]\s*,\s*\.dark\s*\{/;
    const tokens = readCssCustomProperties(selector);

    expect(readToken(tokens, "--nav-btn-radius")).toBe("9999px");
    expect(readToken(tokens, "--nav-btn-bg")).toBe("oklch(16% 0.02 280)");
    expect(readToken(tokens, "--nav-btn-bg-hover")).toBe(readToken(tokens, "--nav-btn-bg"));
    expect(readToken(tokens, "--nav-btn-shadow")).toBe("none");
    expect(readToken(tokens, "--nav-btn-shadow-hover")).toBe("0 0 20px oklch(70% 0.25 280 / 0.3)");
    expect(readToken(tokens, "--nav-btn-inner-glow")).toBe("inset 0 0 20px oklch(70% 0.25 280 / 0.3)");
    expect(readToken(tokens, "--nav-btn-inner-glow-hover")).toBe("inset 0 0 30px oklch(70% 0.25 280 / 0.5)");
    expect(readToken(tokens, "--nav-btn-border")).toBe("oklch(100% 0 0 / 0.1)");
    expect(readToken(tokens, "--nav-btn-border-hover")).toBe(readToken(tokens, "--nav-btn-border"));
  });

  it("maps the light theme top menu to the CodePen Neuromorphic tab treatment", () => {
    const tokens = readCssCustomProperties(LIGHT_NEU_SELECTOR);

    expect(readToken(tokens, "--nav-panel-bg")).toBe("var(--neu-inset-bg)");
    expect(readToken(tokens, "--nav-panel-shadow")).toBe("var(--neu-inset-shadow)");
    expect(readToken(tokens, "--nav-btn-bg")).toBe("transparent");
    expect(readToken(tokens, "--nav-btn-inner-glow")).toBe("0 0 0 transparent");
    expect(readToken(tokens, "--nav-btn-text")).toBe("#4b5563");
    expect(readToken(tokens, "--nav-tab-active-bg")).toBe("var(--neu-raised-bg)");
    expect(readToken(tokens, "--nav-tab-active-bg")).not.toBe(
      readToken(tokens, "--btn-primary-bg"),
    );
    expect(readToken(tokens, "--nav-tab-active-text")).toBe("var(--neu-primary-dark)");
    expect(readToken(tokens, "--nav-tab-active-shadow")).toBe("var(--neu-control-shadow)");
    expect(readToken(tokens, "--nav-tab-active-radius")).toBe("clamp(1.05rem, 2.35vw, 1.18rem)");
  });

  it("keeps the Light theme NexusVault title darker than the raised nav surface", () => {
    const tokens = readCssCustomProperties(LIGHT_NEU_SELECTOR);

    expect(readToken(tokens, "--nav-surface-bg")).toBe("var(--neu-raised-bg)");
    expect(readToken(tokens, "--nav-brand-title-bg")).toBe("linear-gradient(102deg, #6058d8, #6058d8)");
    expect(readToken(tokens, "--nav-brand-title-bg")).not.toContain("rgba(var(--rgb-sky-400)");
    expect(readToken(tokens, "--nav-brand-title-stroke")).toBe("0 transparent");
    expect(readToken(tokens, "--nav-brand-title-shadow")).toContain("rgba(var(--rgb-slate-950), 0.18)");
    expect(readToken(tokens, "--nav-brand-title-shadow")).not.toContain("rgba(var(--rgb-white)");
  });

  it("matches the requested brand title swatches for Dark and Light", () => {
    const darkTokens = readCssCustomProperties(THEME_SELECTORS.dark);
    const lightTokens = readCssCustomProperties(THEME_SELECTORS.light);

    expect(readToken(darkTokens, "--nav-brand-title-bg")).toBe("linear-gradient(102deg, #00b074, #00b074)");
    expect(readToken(lightTokens, "--nav-brand-title-bg")).toBe("linear-gradient(102deg, #6058d8, #6058d8)");
  });

  it("gives the Dark theme title the same treatment as Light except for the requested color", () => {
    const baseDarkTokens = readCssCustomProperties(/:root\s*,\s*\[data-theme="dark"\]\s*,\s*\.dark\s*\{/);
    const darkTokens = readCssCustomProperties(THEME_SELECTORS.dark);
    const lightTokens = readCssCustomProperties(THEME_SELECTORS.light);

    expect(readToken(baseDarkTokens, "--nav-brand-title-bg")).toBe("linear-gradient(102deg, #00b074, #00b074)");
    expect(readToken(darkTokens, "--nav-brand-title-bg")).toBe("linear-gradient(102deg, #00b074, #00b074)");
    expect(readToken(darkTokens, "--nav-brand-title-bg")).not.toBe(readToken(lightTokens, "--nav-brand-title-bg"));
    expect(readToken(baseDarkTokens, "--nav-brand-title-shadow")).toBe(readToken(lightTokens, "--nav-brand-title-shadow"));
    expect(readToken(darkTokens, "--nav-brand-title-shadow")).toBe(readToken(lightTokens, "--nav-brand-title-shadow"));
    expect(readToken(baseDarkTokens, "--nav-brand-title-stroke")).toBe(readToken(lightTokens, "--nav-brand-title-stroke"));
    expect(readToken(darkTokens, "--nav-brand-title-stroke")).toBe(readToken(lightTokens, "--nav-brand-title-stroke"));
  });

  it("maps both remaining theme identities to Neuromorphic nav surfaces", () => {
    for (const [theme, selector] of Object.entries(THEME_SELECTORS)) {
      const tokens = readCssCustomProperties(selector);

      expect(readToken(tokens, "--nav-panel-bg"), theme).toBe("var(--neu-inset-bg)");
      expect(readToken(tokens, "--nav-panel-shadow"), theme).toBe("var(--neu-inset-shadow)");
      expect(readToken(tokens, "--nav-btn-bg"), theme).toBe("transparent");
      expect(readToken(tokens, "--nav-btn-shadow"), theme).toBe("0 0 0 transparent");
      expect(readToken(tokens, "--nav-btn-inner-glow"), theme).toBe("0 0 0 transparent");
      expect(readToken(tokens, "--nav-tab-active-shadow"), theme).toBe("var(--neu-control-shadow)");
      expect(readToken(tokens, "--nav-tab-active-radius"), theme).toBe("clamp(1.05rem, 2.35vw, 1.18rem)");
    }
  });

  it("does not add pulse or colored theme-specific effects to nav buttons", () => {
    const css = readFileSync(resolve(__dirname, "tokens.css"), "utf8");
    const legacyThemeCss = Object.values(THEME_SELECTORS)
      .map((selector) => {
        const match = selector.exec(css);
        expect(match).not.toBeNull();
        return css.slice(match?.index ?? 0, match?.index ? match.index + 2400 : 2400);
      })
      .join("\n");

    expect(css).not.toContain('[data-theme="portfolio"] .nav-btn,\n    .portfolio .nav-btn');
    expect(css).not.toContain('[data-theme="purple"]');
    expect(css).not.toContain('[data-theme="portfolio"]');
    expect(css).not.toContain("rgba(var(--rgb-amber-400), 0.18), transparent 54%");
    expect(css).not.toContain("rgba(var(--rgb-fuchsia-500), 0.18), transparent 54%");
    expect(legacyThemeCss).not.toContain("--nav-btn-bg: linear-gradient");
    expect(legacyThemeCss).not.toContain("--nav-btn-shadow:\n        0 0.375rem");
    expect(css).toContain("--nav-btn-bg: oklch(16% 0.02 280)");
    expect(css).toContain("--nav-btn-inner-glow: inset 0 0 20px oklch(70% 0.25 280 / 0.3)");
    expect(css).not.toContain("--nav-tab-active-bg: linear-gradient(145deg, #6366f1, #4f46e5)");
  });

  it.each(Object.entries(THEME_SELECTORS))("%s theme gives the username chip the same Neuromorphic surface", (_theme, selector) => {
    const tokens = readCssCustomProperties(selector);

    expect(readToken(tokens, "--nav-chip-bg")).toBe(readToken(tokens, "--nav-btn-bg"));
    expect(readToken(tokens, "--nav-chip-border")).toBe(readToken(tokens, "--nav-btn-border"));
    expect(readToken(tokens, "--nav-chip-text")).toBe(readToken(tokens, "--nav-btn-text"));
    expect(readToken(tokens, "--nav-chip-shadow")).toBe(readToken(tokens, "--nav-btn-shadow"));
    expect(readToken(tokens, "--nav-chip-inner-glow")).toBe(readToken(tokens, "--nav-btn-inner-glow"));
  });
});
