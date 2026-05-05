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

  const ruleBody = css.slice(selector.index + selector[0].length).match(/^[\s\S]*?(?=\n\s*})/)?.[0];
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
    const footerSurface = readToken(tokens, "--footer-surface-bg");

    expect(navSurface).toMatch(/\blinear-gradient\s*\(/);
    expect(footerSurface).toMatch(/\blinear-gradient\s*\(/);
    expectTokenValueToUseRgbTokens(navSurface, ["--rgb-slate-950", "--rgb-cyan-400", "--rgb-purple-500"]);
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
