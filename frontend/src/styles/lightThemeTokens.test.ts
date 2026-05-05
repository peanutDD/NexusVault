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
  it("gives all three themes distinct multi-layer page backgrounds", () => {
    const darkTokens = readCssCustomProperties("tokens.css", /(?:^|\})\s*\[data-theme="dark"\]\s*,\s*\.dark\s*\{/m);
    const lightTokens = readCssCustomProperties("tokens.css", /\[data-theme="light"\]\s*,\s*\.light\s*\{/);
    const purpleTokens = readCssCustomProperties("tokens.css", /\[data-theme="purple"\]\s*,\s*\.purple\s*\{/);

    const darkSurface = readToken(darkTokens, "--surface-page-gradient");
    const lightSurface = readToken(lightTokens, "--surface-page-gradient");
    const purpleSurface = readToken(purpleTokens, "--surface-page-gradient");

    for (const surface of [darkSurface, lightSurface, purpleSurface]) {
      expect(surface.match(/radial-gradient\s*\(/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
      expect(surface).toMatch(/\blinear-gradient\s*\(/);
    }

    expect(darkSurface).not.toEqual(lightSurface);
    expect(lightSurface).not.toEqual(purpleSurface);
    expect(purpleSurface).not.toEqual(darkSurface);
    expectTokenValueToUseRgbTokens(darkSurface, ["--rgb-emerald-400", "--rgb-cyan-400"]);
    expect(darkSurface).toContain("rgb(var(--rgb-slate-950))");
    expectTokenValueToUseRgbTokens(lightSurface, ["--rgb-sky-400", "--rgb-cyan-400", "--rgb-fuchsia-500"]);
    expectTokenValueToUseRgbTokens(purpleSurface, ["--rgb-purple-500", "--rgb-fuchsia-500", "--rgb-cyan-400"]);
  });

  it("uses themed image-capable backgrounds for the files page", () => {
    const css = readFileSync(resolve(__dirname, "../components/layout/PageLayout.tsx"), "utf8");
    const darkTokens = readCssCustomProperties("tokens.css", /(?:^|\})\s*\[data-theme="dark"\]\s*,\s*\.dark\s*\{/m);
    const lightTokens = readCssCustomProperties("tokens.css", /\[data-theme="light"\]\s*,\s*\.light\s*\{/);
    const purpleTokens = readCssCustomProperties("tokens.css", /\[data-theme="purple"\]\s*,\s*\.purple\s*\{/);

    expect(css).toContain("bg-[image:var(--filelist-page-bg)]");

    for (const tokens of [darkTokens, lightTokens, purpleTokens]) {
      const fileListSurface = readToken(tokens, "--filelist-page-bg");
      expect(fileListSurface).toMatch(/\blinear-gradient\s*\(/);
      expect(fileListSurface).not.toMatch(/^rgb\(/);
    }
  });

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
