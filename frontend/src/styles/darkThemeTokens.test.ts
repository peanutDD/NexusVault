import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readLastCssCustomProperties(selectorPattern: RegExp) {
  const css = readFileSync(resolve(__dirname, "tokens.css"), "utf8");
  const matches = [...css.matchAll(new RegExp(selectorPattern.source, `${selectorPattern.flags}g`))];
  const selector = matches.at(-1);
  expect(selector).toBeDefined();

  if (!selector) {
    throw new Error(`Missing CSS selector: ${selectorPattern.source}`);
  }

  const ruleBody = css
    .slice((selector.index ?? 0) + selector[0].length)
    .match(/^[\s\S]*?(?=\s*})/)?.[0];
  expect(ruleBody).toBeDefined();

  const properties = new Map<string, string>();
  for (const [, name, value] of (ruleBody ?? "").matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    properties.set(name, value.trim());
  }

  return properties;
}

function readToken(tokens: Map<string, string>, name: string) {
  const value = tokens.get(name);
  expect(value, name).toBeDefined();
  return value ?? "";
}

const DARK_NEUROMORPHIC_SELECTOR = /:root\[data-theme="dark"\],\s*:root\.dark\s*\{/;

describe("dark theme Neuromorphic tokens", () => {
  it("defines shared RGB primitives used by dark and component tokens", () => {
    const css = readFileSync(resolve(__dirname, "tokens.css"), "utf8");

    expect(css).toContain("--rgb-slate-200: 226, 232, 240;");
  });

  it("defines Dark as the CodePen Neuromorphic primitive palette", () => {
    const tokens = readLastCssCustomProperties(DARK_NEUROMORPHIC_SELECTOR);

    expect(readToken(tokens, "--neu-bg-primary")).toBe("#374151");
    expect(readToken(tokens, "--neu-bg-secondary")).toBe("#1f2937");
    expect(readToken(tokens, "--neu-shadow-dark")).toBe("#111827");
    expect(readToken(tokens, "--neu-shadow-light")).toBe("#4b5563");
    expect(readToken(tokens, "--neu-primary")).toBe("#9333ea");
    expect(readToken(tokens, "--neu-primary-dark")).toBe("#7c3aed");
    expect(readToken(tokens, "--surface-page-gradient")).toBe(
      "linear-gradient(145deg, var(--neu-bg-primary), var(--neu-bg-secondary))",
    );
    expect(readToken(tokens, "--filelist-page-bg")).toBe(
      "linear-gradient(145deg, var(--neu-bg-primary), var(--neu-bg-secondary))",
    );
  });

  it("maps Dark app surfaces to raised and inset Neuromorphic primitives", () => {
    const tokens = readLastCssCustomProperties(DARK_NEUROMORPHIC_SELECTOR);

    expect(readToken(tokens, "--neu-raised-shadow")).toBe(
      "8px 8px 16px var(--neu-shadow-dark), -8px -8px 16px var(--neu-shadow-light)",
    );
    expect(readToken(tokens, "--neu-inset-shadow")).toBe(
      "inset 4px 4px 8px var(--neu-shadow-dark), inset -4px -4px 8px var(--neu-shadow-light)",
    );
    expect(readToken(tokens, "--nav-panel-bg")).toBe("var(--neu-inset-bg)");
    expect(readToken(tokens, "--nav-panel-shadow")).toBe("var(--neu-inset-shadow)");
    expect(readToken(tokens, "--settings-surface-bg")).toBe("var(--neu-raised-bg)");
    expect(readToken(tokens, "--upload-dialog-bg")).toBe("var(--neu-raised-bg)");
    expect(readToken(tokens, "--preview-caption-bg")).toBe("var(--neu-raised-bg)");
    expect(readToken(tokens, "--trash-panel-bg")).toBe("var(--neu-raised-bg)");
    expect(readToken(tokens, "--footer-surface-bg")).toBe("var(--neu-raised-bg)");
  });

  it("maps every dark file-list glass primitive away from legacy cyber colors", () => {
    const tokens = readLastCssCustomProperties(DARK_NEUROMORPHIC_SELECTOR);

    expect(readToken(tokens, "--filelist-glass-bg-strong")).toBe("var(--neu-raised-bg)");
    expect(readToken(tokens, "--filelist-glass-bg-soft")).toBe("var(--neu-raised-bg)");
    expect(readToken(tokens, "--filelist-glass-highlight-strong")).toBe("transparent");
    expect(readToken(tokens, "--filelist-glass-highlight-soft")).toBe("transparent");
    expect(readToken(tokens, "--filelist-glass-border")).toBe("transparent");
    expect(readToken(tokens, "--filelist-glass-border-strong")).toBe("transparent");
    expect(readToken(tokens, "--filelist-shadow-panel")).toBe("var(--neu-surface-shadow)");
    expect(readToken(tokens, "--filelist-shadow-panel-soft")).toBe("var(--neu-control-shadow)");
    expect(readToken(tokens, "--filelist-toolbar-bg-strong")).toBe("var(--neu-bg-primary)");
    expect(readToken(tokens, "--filelist-toolbar-bg-soft")).toBe("var(--neu-bg-secondary)");
    expect(readToken(tokens, "--filelist-bar-border")).toBe("transparent");
    expect(readToken(tokens, "--filelist-bar-bg-top")).toBe("var(--neu-bg-primary)");
    expect(readToken(tokens, "--filelist-bar-bg-bottom")).toBe("var(--neu-bg-secondary)");
    expect(readToken(tokens, "--filelist-bar-inset")).toBe("transparent");
    expect(readToken(tokens, "--filelist-bar-glow")).toBe("transparent");
    expect(readToken(tokens, "--filelist-tech-glow-purple")).toBe("transparent");
    expect(readToken(tokens, "--filelist-tech-glow-cyan")).toBe("transparent");
    expect(readToken(tokens, "--filelist-tech-glow-green")).toBe("transparent");
    expect(readToken(tokens, "--filelist-toolbar-btn-bg")).toBe("var(--neu-raised-bg)");
    expect(readToken(tokens, "--filelist-toolbar-btn-border")).toBe("transparent");
  });

  it("keeps dark filter fallback surfaces on concrete Neuromorphic colors", () => {
    const tokens = readLastCssCustomProperties(DARK_NEUROMORPHIC_SELECTOR);

    expect(readToken(tokens, "--filters-surface-bg-top")).toBe("var(--neu-bg-primary)");
    expect(readToken(tokens, "--filters-surface-bg-bottom")).toBe("var(--neu-bg-secondary)");
    expect(readToken(tokens, "--filters-dropdown-surface-bg-top")).toBe("var(--neu-bg-primary)");
    expect(readToken(tokens, "--filters-dropdown-surface-bg-bottom")).toBe("var(--neu-bg-secondary)");
    expect(readToken(tokens, "--filters-surface-hi")).toBe("transparent");
    expect(readToken(tokens, "--filters-surface-border")).toBe("transparent");
  });

  it("removes legacy dark Shape Wave tokens from the final Dark visual contract", () => {
    const tokens = readLastCssCustomProperties(DARK_NEUROMORPHIC_SELECTOR);

    expect(tokens.has("--filelist-shape-wave-bg")).toBe(false);
    expect(tokens.has("--filelist-shape-wave-opacity")).toBe(false);
    expect(readToken(tokens, "--filelist-fireworks-bg")).toBe("#111827");
    expect(readToken(tokens, "--filelist-fireworks-opacity")).toBe("0.72");
    expect(readToken(tokens, "--filelist-fireworks-trail-fill")).toBe("rgba(17, 24, 39, 0.5)");
  });

  it("uses purple Neuromorphic primary actions instead of the old green dark accent", () => {
    const tokens = readLastCssCustomProperties(DARK_NEUROMORPHIC_SELECTOR);

    expect(readToken(tokens, "--cta-primary-bg")).toBe(
      "linear-gradient(145deg, var(--neu-primary), var(--neu-primary-dark))",
    );
    expect(readToken(tokens, "--settings-action-bg")).toBe(
      "linear-gradient(145deg, var(--neu-primary), var(--neu-primary-dark))",
    );
    expect(readToken(tokens, "--dialog-primary-btn-bg")).toBe(
      "linear-gradient(145deg, var(--neu-primary), var(--neu-primary-dark))",
    );
    expect(readToken(tokens, "--filelist-folder-icon")).toBe("var(--neu-accent-text)");
    expect(readToken(tokens, "--notice-info")).toBe("var(--neu-accent-text)");
  });
});
