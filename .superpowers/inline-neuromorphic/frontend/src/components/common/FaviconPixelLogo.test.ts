import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(__dirname, "../../..");

describe("browser tab favicon", () => {
  it("points the browser tab to the local SVG favicon", () => {
    const html = readFileSync(resolve(frontendRoot, "index.html"), "utf8");

    expect(html).toContain(
      '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />',
    );
  });

  it("uses the exact CodePen Sonic pixel logo artwork", () => {
    const svg = readFileSync(
      resolve(frontendRoot, "public/favicon.svg"),
      "utf8",
    );

    expect(svg).toContain('viewBox="0 0 31 39"');
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).not.toContain("linearGradient");
    expect(svg).not.toContain("polygon");
    expect(svg.match(/<rect /g)).toHaveLength(661);
    expect(new Set(svg.match(/rgb\([^)]+\)/g))).toEqual(
      new Set([
        "rgb(0, 52, 206)",
        "rgb(0, 0, 152)",
        "rgb(52, 102, 249)",
        "rgb(239, 198, 136)",
        "rgb(151, 71, 8)",
        "rgb(245, 239, 249)",
        "rgb(178, 178, 178)",
        "rgb(220, 231, 237)",
        "rgb(128, 128, 128)",
        "rgb(1, 0, 0)",
        "rgb(151, 1, 0)",
        "rgb(253, 0, 7)",
      ]),
    );
  });
});

