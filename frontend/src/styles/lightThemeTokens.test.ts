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
});
