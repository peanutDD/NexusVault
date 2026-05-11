import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readCssCustomProperties(fileName: string, selectorPattern: RegExp) {
  const css = readFileSync(resolve(__dirname, fileName), "utf8");
  const selector = selectorPattern.exec(css);
  expect(selector).not.toBeNull();

  if (!selector) {
    throw new Error(`Missing CSS selector: ${selectorPattern.source}`);
  }

  const ruleBody = css.slice(selector.index + selector[0].length).match(/^[\s\S]*?(?=\s*})/)?.[0];
  expect(ruleBody).toBeDefined();

  const properties = new Map<string, string>();
  for (const [, name, value] of (ruleBody ?? "").matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    properties.set(name, value.trim());
  }

  return properties;
}

function readToken(tokens: Map<string, string>, name: string) {
  const value = tokens.get(name);
  expect(value).toBeDefined();
  return value ?? "";
}

function expectTokenValueToUseRgbTokens(value: string, rgbTokens: string[]) {
  for (const rgbToken of rgbTokens) {
    expect(value).toContain(`rgba(var(${rgbToken})`);
  }
}

describe("light theme tokens", () => {
  it("uses the Daylight Nebula palette for the page surface", () => {
    const tokens = readCssCustomProperties("tokens.css", /\[data-theme="light"\]\s*,\s*\.light\s*\{/);
    const surface = readToken(tokens, "--surface-page-gradient");

    expectTokenValueToUseRgbTokens(surface, [
      "--rgb-sky-400",
      "--rgb-cyan-400",
      "--rgb-purple-500",
      "--rgb-fuchsia-500",
    ]);
  });

  it("uses premium dark chrome for the light nav and footer bars", () => {
    const tokens = readCssCustomProperties("tokens.css", /\[data-theme="light"\]\s*,\s*\.light\s*\{/);
    const navSurface = readToken(tokens, "--nav-surface-bg");
    const navButton = readToken(tokens, "--nav-btn-bg");
    const navButtonHover = readToken(tokens, "--nav-btn-bg-hover");
    const navButtonShadow = readToken(tokens, "--nav-btn-shadow");
    const footerSurface = readToken(tokens, "--footer-surface-bg");

    expect(navSurface).toMatch(/\blinear-gradient\s*\(/);
    expect(navButton).toMatch(/\blinear-gradient\s*\(/);
    expect(navButtonHover).toMatch(/\blinear-gradient\s*\(/);
    expect(footerSurface).toMatch(/\blinear-gradient\s*\(/);
    expectTokenValueToUseRgbTokens(navSurface, ["--rgb-slate-950", "--rgb-cyan-400", "--rgb-purple-500"]);
    expectTokenValueToUseRgbTokens(navButton, ["--rgb-slate-950", "--rgb-slate-900"]);
    expectTokenValueToUseRgbTokens(navButtonHover, ["--rgb-slate-950", "--rgb-slate-900"]);
    expectTokenValueToUseRgbTokens(navButtonShadow, ["--rgb-slate-950", "--rgb-cyan-400", "--rgb-white"]);
    expectTokenValueToUseRgbTokens(footerSurface, ["--rgb-slate-950", "--rgb-cyan-400", "--rgb-purple-500"]);
  });

  it("uses a modern opal and electric mint palette for trash light mode", () => {
    const tokens = readCssCustomProperties("tokens.css", /\[data-theme="light"\]\s*,\s*\.light\s*\{/);
    const panel = readToken(tokens, "--trash-panel-bg");
    const page = readToken(tokens, "--trash-page-bg");
    const thumb = readToken(tokens, "--trash-thumb-bg");
    const placeholder = readToken(tokens, "--trash-placeholder-bg");
    const badge = readToken(tokens, "--trash-badge-bg");
    const countdown = readToken(tokens, "--trash-countdown-text");
    const danger = readToken(tokens, "--trash-countdown-danger");
    const restore = readToken(tokens, "--trash-restore-text");
    const purge = readToken(tokens, "--trash-purge-text");
    const title = readToken(tokens, "--trash-card-title");

    expect(page).toContain("rgba(var(--rgb-white)");
    expect(page).toContain("rgba(var(--rgb-emerald-400)");
    expect(panel).toContain("rgba(var(--rgb-slate-950)");
    expect(panel).toContain("rgba(var(--rgb-emerald-400)");
    expect(thumb).toContain("rgba(var(--rgb-slate-950)");
    expect(thumb).toContain("rgba(var(--rgb-emerald-400)");
    expect(placeholder).toContain("rgba(var(--rgb-slate-950)");
    expect(badge).toContain("rgba(var(--rgb-slate-950)");
    expect(countdown).toContain("rgba(var(--rgb-emerald-400)");
    expect(danger).toContain("rgba(var(--rgb-rose-400)");
    expect(restore).toContain("rgba(var(--rgb-emerald-400)");
    expect(purge).toContain("rgba(var(--rgb-rose-400)");
    expect(title).toContain("rgba(var(--rgb-slate-950)");
    expect(page).not.toContain("rgb(191, 204, 219)");
    expect(panel).not.toContain("rgba(var(--rgb-white), 0.99)");
    expect(thumb).not.toContain("rgba(var(--rgb-white), 0.94)");
    expect(countdown).not.toContain("rgba(var(--rgb-sky-400)");
  });

  it("keeps macOS light title bars in premium dark chrome instead of plain white", () => {
    const tokens = readCssCustomProperties("platform.css", /(?:^|\})\s*\.platform-macos\s*\{/m);
    const titlebar = readToken(tokens, "--macos-titlebar-bg");
    const navSurface = readToken(tokens, "--nav-surface-bg");

    expect(titlebar).toContain("rgb(var(--rgb-slate-950))");
    expect(titlebar).not.toContain("rgb(var(--rgb-white))");
    expect(navSurface).toMatch(/\blinear-gradient\s*\(/);
    expect(navSurface).toContain("rgba(var(--rgb-cyan-400)");
  });
});
