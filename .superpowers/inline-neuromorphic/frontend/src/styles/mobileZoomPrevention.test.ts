import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");

describe("mobile zoom prevention", () => {
  it("caps the viewport so mobile desktop-site double taps cannot page-zoom", () => {
    const html = readFileSync(resolve(projectRoot, "index.html"), "utf8");

    expect(html).toContain('name="viewport"');
    expect(html).toContain("width=device-width");
    expect(html).toContain("initial-scale=1.0");
    expect(html).toContain("maximum-scale=1.0");
    expect(html).toContain("user-scalable=no");
    expect(html).toContain("viewport-fit=cover");
  });

  it("uses a global touch-action guard against double-tap zoom without blocking scroll", () => {
    const css = readFileSync(resolve(__dirname, "base.css"), "utf8");

    expect(css).toMatch(/html,\s*body,\s*#root\s*\{\s*touch-action:\s*manipulation;/);
  });
});
