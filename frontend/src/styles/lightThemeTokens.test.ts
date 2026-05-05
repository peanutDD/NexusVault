import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readLightThemeBlock() {
  const css = readFileSync(resolve(__dirname, "tokens.css"), "utf8");
  const start = css.indexOf('[data-theme="light"], .light {');
  expect(start).toBeGreaterThanOrEqual(0);

  const end = css.indexOf("\n}", start);
  expect(end).toBeGreaterThan(start);

  return css.slice(start, end);
}

function readPlatformCss() {
  return readFileSync(resolve(__dirname, "platform.css"), "utf8");
}

function readNavBarSource() {
  return readFileSync(resolve(__dirname, "../components/layout/NavBar.tsx"), "utf8");
}

describe("light theme tokens", () => {
  it("uses the Daylight Nebula palette for the page surface", () => {
    const block = readLightThemeBlock();
    const surfaceStart = block.indexOf("--surface-page-gradient:");
    const surfaceEnd = block.indexOf("--glass-bg-strong:", surfaceStart);
    expect(surfaceStart).toBeGreaterThanOrEqual(0);
    expect(surfaceEnd).toBeGreaterThan(surfaceStart);

    const surface = block.slice(surfaceStart, surfaceEnd);
    expect(surface).toContain("rgba(var(--rgb-sky-400)");
    expect(surface).toContain("rgba(var(--rgb-cyan-400)");
    expect(surface).toContain("rgba(var(--rgb-purple-500)");
    expect(surface).toContain("rgba(var(--rgb-fuchsia-500)");
  });

  it("uses premium dark chrome for the light nav and footer bars", () => {
    const block = readLightThemeBlock();
    const navStart = block.indexOf("--nav-surface-bg:");
    const navEnd = block.indexOf("--nav-top-glow:", navStart);
    const footerStart = block.indexOf("--footer-surface-bg:");
    const footerEnd = block.indexOf("--footer-grid-bg-image:", footerStart);
    expect(navStart).toBeGreaterThanOrEqual(0);
    expect(navEnd).toBeGreaterThan(navStart);
    expect(footerStart).toBeGreaterThanOrEqual(0);
    expect(footerEnd).toBeGreaterThan(footerStart);

    const navSurface = block.slice(navStart, navEnd);
    const footerSurface = block.slice(footerStart, footerEnd);
    expect(navSurface).toContain("rgba(var(--rgb-slate-950)");
    expect(navSurface).toContain("rgba(var(--rgb-cyan-400)");
    expect(navSurface).toContain("rgba(var(--rgb-purple-500)");
    expect(footerSurface).toContain("rgba(var(--rgb-slate-950)");
    expect(footerSurface).toContain("rgba(var(--rgb-cyan-400)");
    expect(footerSurface).toContain("rgba(var(--rgb-purple-500)");
  });

  it("keeps macOS light title bars in premium dark chrome instead of plain white", () => {
    const platformCss = readPlatformCss();
    const macosStart = platformCss.indexOf(".platform-macos {");
    const macosEnd = platformCss.indexOf(".platform-macos.dark", macosStart);
    expect(macosStart).toBeGreaterThanOrEqual(0);
    expect(macosEnd).toBeGreaterThan(macosStart);

    const macosBlock = platformCss.slice(macosStart, macosEnd);
    expect(macosBlock).toContain("--macos-titlebar-bg: rgb(var(--rgb-slate-950))");
    expect(macosBlock).toContain("--nav-surface-bg: linear-gradient");
    expect(macosBlock).toContain("rgba(var(--rgb-cyan-400)");
    expect(macosBlock).not.toContain("--macos-titlebar-bg: rgb(var(--rgb-white))");
  });

  it("renders nav surface tokens through background shorthand so gradients work", () => {
    const source = readNavBarSource();
    expect(source).toContain("[background:var(--nav-surface-bg)]");
  });
});
