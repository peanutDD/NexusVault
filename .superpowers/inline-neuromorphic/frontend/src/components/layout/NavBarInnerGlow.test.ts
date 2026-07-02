import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readRuleBody(css: string, selector: string) {
  const start = css.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf("}", start));
}

describe("NavBar Neuromorphic primitive contract", () => {
  const css = readFileSync(resolve(__dirname, "../../styles/nav.css"), "utf8");

  it("uses one raised navigation surface and one raised action panel", () => {
    const surface = readRuleBody(css, ".nav-surface-shell");
    const panel = readRuleBody(css, ".nav-panel");

    expect(surface).toContain("background: var(--neu-raised-bg)");
    expect(surface).toContain("background-image: none");
    expect(surface).toContain("border-color: transparent");
    expect(surface).toContain("box-shadow: var(--neu-raised-shadow)");
    expect(panel).toContain("background: var(--neu-raised-bg)");
    expect(panel).toContain("background-image: none");
    expect(panel).toContain("box-shadow: var(--neu-raised-shadow)");
  });

  it("renders chips inset and actions raised without legacy glow effects", () => {
    const chip = readRuleBody(css, ".nav-chip");
    const button = readRuleBody(css, ".nav-btn");
    const active = readRuleBody(css, ".nav-btn:active");

    expect(chip).toContain("background: var(--neu-inset-bg)");
    expect(chip).toContain("box-shadow: var(--neu-inset-shadow)");
    expect(button).toContain("background: var(--neu-raised-bg)");
    expect(button).toContain("box-shadow: var(--neu-raised-sm-shadow)");
    expect(active).toContain("box-shadow: var(--neu-pressed-shadow)");
    expect(css).not.toContain("inner-glow");
    expect(css).not.toContain("radial-gradient");
    expect(css).not.toContain("linear-gradient");
  });

  it("keeps the tooltip on the same raised primitive", () => {
    const tooltip = readRuleBody(css, ".nav-theme-tooltip::before");

    expect(tooltip).toContain("background: var(--neu-raised-bg)");
    expect(tooltip).toContain("background-image: none");
    expect(tooltip).toContain("box-shadow: var(--neu-raised-sm-shadow)");
  });

  it("removes the outer panel depth on compact viewports", () => {
    expect(css).toContain("@media (max-width: 640px)");
    expect(css).toContain("border-radius: 0");
    expect(css).toContain("box-shadow: none");
  });
});
