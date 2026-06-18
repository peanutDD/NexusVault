import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readRuleBody(css: string, selectorPattern: RegExp) {
  const selector = selectorPattern.exec(css);
  expect(selector).not.toBeNull();

  if (!selector) {
    throw new Error(`Missing CSS selector: ${selectorPattern.source}`);
  }

  const ruleBody = css
    .slice(selector.index + selector[0].length)
    .match(/^[\s\S]*?(?=\s*})/)?.[0];
  expect(ruleBody).toBeDefined();
  return ruleBody ?? "";
}

describe("NavBar inner glow CSS contract", () => {
  it("paints the full title bar with the nav surface background shorthand", () => {
    const css = readFileSync(resolve(__dirname, "../../styles/nav.css"), "utf8");
    const surfaceRule = readRuleBody(css, /^\s*\.nav-surface-shell\s*\{/m);

    expect(surfaceRule).toContain("background: var(--nav-surface-bg)");
    expect(surfaceRule).toContain("border-bottom: 1px solid var(--nav-surface-border, transparent)");
    expect(surfaceRule).toContain("box-shadow: var(--nav-surface-shadow, none)");
  });

  it("gives the NexusVault title a refined display-font gradient treatment", () => {
    const css = readFileSync(resolve(__dirname, "../../styles/nav.css"), "utf8");
    const titleRule = readRuleBody(css, /^\s*\.nav-brand-title\s*\{/m);

    expect(titleRule).toContain("font-family: var(--font-brand-display)");
    expect(titleRule).toContain("background: var(--nav-brand-title-bg)");
    expect(titleRule).toContain("-webkit-background-clip: text");
    expect(titleRule).toContain("color: transparent");
    expect(titleRule).toContain("-webkit-text-stroke: var(--nav-brand-title-stroke)");
    expect(titleRule).toContain("text-shadow: var(--nav-brand-title-shadow)");
  });

  it("paints nav buttons as tokenized inner-glow controls by default", () => {
    const css = readFileSync(resolve(__dirname, "../../styles/nav.css"), "utf8");
    const panelRule = readRuleBody(css, /^\s*\.nav-panel\s*\{/m);
    const chipRule = readRuleBody(css, /^\s*\.nav-chip\s*\{/m);
    const buttonRule = readRuleBody(css, /^\s*\.nav-btn\s*\{/m);
    const hoverRule = readRuleBody(css, /^\s*\.nav-btn:hover\s*\{/m);

    expect(panelRule).toContain("border-radius: 0");
    expect(panelRule).toContain("border-color: transparent !important");
    expect(panelRule).toContain("box-shadow: none !important");
    expect(chipRule).toContain("border-radius: var(--nav-btn-radius)");
    expect(chipRule).toContain("background: var(--nav-chip-bg)");
    expect(chipRule).toContain("box-shadow: var(--nav-chip-shadow), var(--nav-chip-inner-glow)");
    expect(chipRule).not.toContain("transform");
    expect(buttonRule).toContain("border-radius: var(--nav-btn-radius)");
    expect(buttonRule).toContain("background: var(--nav-btn-bg)");
    expect(buttonRule).toContain("box-shadow: var(--nav-btn-shadow), var(--nav-btn-inner-glow)");
    expect(buttonRule).not.toContain("text-shadow");
    expect(buttonRule).not.toContain("isolation");
    expect(hoverRule).toContain("box-shadow: var(--nav-btn-shadow-hover), var(--nav-btn-inner-glow-hover)");
    expect(hoverRule).toContain("background: var(--nav-btn-bg-hover)");
    expect(hoverRule).toContain("transform: translateY(-2px)");
    expect(css).not.toContain(".light .nav-panel .nav-icon");
    expect(css).not.toContain("button[aria-label='Logout']");
  });

  it("keeps legacy dark square controls unreachable once Dark uses Neuromorphic styling", () => {
    const css = readFileSync(resolve(__dirname, "../../styles/nav.css"), "utf8");
    const darkRule = readRuleBody(
      css,
      /^\s*:root\[data-theme="dark"\]:not\(\.neuromorphic-style\)\s*\.nav-btn,\s*\n\s*:root\.dark:not\(\.neuromorphic-style\)\s*\.nav-btn,\s*\n\s*:root\[data-theme="dark"\]:not\(\.neuromorphic-style\)\s*\.nav-chip,\s*\n\s*:root\.dark:not\(\.neuromorphic-style\)\s*\.nav-chip\s*\{/m,
    );

    expect(darkRule).toContain("border-radius: 0");
    expect(css).not.toContain('[data-theme="light"] .nav-btn');
    expect(css).not.toContain('.neuromorphic-style .nav-chip {\n        border-radius: 0');
  });

  it("keeps the rounded outer panel only for desktop Neuromorphic", () => {
    const css = readFileSync(resolve(__dirname, "../../styles/nav.css"), "utf8");
    const neuromorphicPanelRule = readRuleBody(
      css,
      /^\s*\.neuromorphic-style\s*\.nav-panel,\s*\n\s*\.neuromorphic-style\s*\.nav-panel\s*\{/m,
    );

    expect(neuromorphicPanelRule).toContain("border-radius: var(--nav-panel-radius, var(--nav-btn-radius))");
    expect(neuromorphicPanelRule).toContain("border-color: var(--nav-panel-border) !important");
    expect(neuromorphicPanelRule).toContain("box-shadow: var(--nav-panel-shadow) !important");
    expect(css).toContain(".neuromorphic-style .nav-panel");
  });

  it("keeps Neuromorphic nav actions animated on desktop", () => {
    const css = readFileSync(resolve(__dirname, "../../styles/nav.css"), "utf8");
    const neuromorphicHoverRule = readRuleBody(
      css,
      /^\s*\.neuromorphic-style\s*\.nav-btn:hover,\s*\n\s*\.neuromorphic-style\s*\.nav-btn:hover\s*\{/m,
    );
    const neuromorphicActiveRule = readRuleBody(
      css,
      /^\s*\.neuromorphic-style\s*\.nav-btn:active,\s*\n\s*\.neuromorphic-style\s*\.nav-btn:active\s*\{/m,
    );

    expect(neuromorphicHoverRule).toContain("transform: translateY(-2px)");
    expect(neuromorphicHoverRule).toContain("box-shadow: var(--nav-btn-shadow-hover), var(--nav-btn-inner-glow-hover)");
    expect(neuromorphicActiveRule).toContain("transform: translateY(1px) !important");
    expect(neuromorphicActiveRule).toContain("box-shadow: var(--neu-pressed-shadow) !important");
  });

  it("removes the outer nav panel arc on mobile without squaring Neuromorphic Dark controls", () => {
    const css = readFileSync(resolve(__dirname, "../../styles/nav.css"), "utf8");

    expect(css).toContain("@media (max-width: 640px)");
    expect(css).toContain(".nav-panel {\n            border-radius: 0 !important");
    expect(css).toContain("border-color: transparent !important");
    expect(css).toContain("box-shadow: none !important");
    expect(css).toContain(':root[data-theme="dark"]:not(.neuromorphic-style) .nav-btn,\n        :root.dark:not(.neuromorphic-style) .nav-btn');
    expect(css).toContain(":root.dark:not(.neuromorphic-style) .nav-chip {\n            border-radius: 0 !important");
  });

  it("keeps the theme toggle from staying lifted after a theme switch", () => {
    const css = readFileSync(resolve(__dirname, "../../styles/nav.css"), "utf8");
    const themeToggleHoverRule = readRuleBody(css, /^\s*\.nav-theme-toggle:hover\s*\{/m);

    expect(themeToggleHoverRule).toContain("transform: translateY(0)");
    expect(themeToggleHoverRule).not.toContain("box-shadow");
    expect(themeToggleHoverRule).not.toContain("background");
  });

  it("keeps the Light theme toggle active background above utility classes and matches panel radius", () => {
    const css = readFileSync(resolve(__dirname, "../../styles/nav.css"), "utf8");
    const themeToggleRule = readRuleBody(
      css,
      /^\s*\.neuromorphic-style\s*\.nav-theme-toggle,\s*\n\s*\.neuromorphic-style\s*\.nav-theme-toggle\s*\{/m,
    );

    expect(themeToggleRule).toContain("background: var(--nav-tab-active-bg) !important");
    expect(themeToggleRule).toContain("border-radius: var(--nav-panel-radius, var(--nav-btn-radius))");
    expect(themeToggleRule).toContain("color: var(--nav-tab-active-text) !important");
    expect(themeToggleRule).toContain("box-shadow: var(--nav-tab-active-shadow) !important");
  });

  it("shows the theme toggle tooltip immediately below the button in the Neuromorphic style", () => {
    const css = readFileSync(resolve(__dirname, "../../styles/nav.css"), "utf8");
    const tooltipRule = readRuleBody(css, /^\s*\.nav-theme-tooltip\s*\{/m);
    const sharedPseudoRule = readRuleBody(
      css,
      /^\s*\.nav-theme-tooltip::before,\s*\n\s*\.nav-theme-tooltip::after\s*\{/m,
    );
    const bubbleRule = readRuleBody(css, /^\s*\.nav-theme-tooltip::before\s*\{/m);
    const arrowRule = readRuleBody(css, /^\s*\.nav-theme-tooltip::after\s*\{\s*\n\s*content: "";/m);
    const revealRule = readRuleBody(
      css,
      /^\s*\.nav-theme-tooltip:hover::before,\s*\n\s*\.nav-theme-tooltip:focus-visible::before,\s*\n\s*\.nav-theme-tooltip:hover::after,\s*\n\s*\.nav-theme-tooltip:focus-visible::after\s*\{/m,
    );

    expect(tooltipRule).toContain("position: relative");
    expect(sharedPseudoRule).toContain("transition: opacity 0ms linear, transform var(--transition-fast, 150ms) ease");
    expect(sharedPseudoRule).toContain("transition-delay: 0s");
    expect(bubbleRule).toContain("content: attr(data-tooltip)");
    expect(bubbleRule).toContain("top: calc(100% + 0.625rem)");
    expect(bubbleRule).toContain("background: var(--neu-raised-bg)");
    expect(bubbleRule).toContain("box-shadow: var(--neu-control-shadow)");
    expect(arrowRule).toContain("top: calc(100% + 0.3125rem)");
    expect(arrowRule).toContain("border-bottom-color: var(--neu-bg-primary)");
    expect(revealRule).toContain("opacity: 1");
    expect(revealRule).toContain("visibility: visible");
    expect(revealRule).toContain("transition-delay: 0s");
  });
});
