import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("removed terminal theme tokens", () => {
  it("does not define a Terminal theme selector or terminal-only motion", () => {
    const css = readFileSync("src/styles/tokens.css", "utf8");

    expect(css).not.toContain('[data-theme="terminal"]');
    expect(css).not.toContain(".terminal");
    expect(css).not.toContain("--terminal-scanline-bg");
    expect(css).not.toContain("@keyframes terminal-glow-pulse");
    expect(css).not.toContain("@keyframes terminal-scanline-shimmer");
  });
});
