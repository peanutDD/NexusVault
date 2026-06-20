import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));

const LIGHT_NEU_SELECTOR =
  /:root\[data-theme="light"\],\s*:root\.light\s*\{/;

function readCssCustomProperties(selectorPattern: RegExp) {
  const css = readFileSync(resolve(__dirname, "tokens.css"), "utf8");
  const selector = selectorPattern.exec(css);
  expect(selector).not.toBeNull();

  if (!selector) {
    throw new Error(`Missing CSS selector: ${selectorPattern.source}`);
  }

  const ruleBody = css
    .slice(selector.index + selector[0].length)
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

function readFrontendSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = resolve(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      return entry === "node_modules" || entry === "dist" ? [] : readFrontendSourceFiles(fullPath);
    }
    return /\.(css|ts|tsx)$/.test(entry) ? [fullPath] : [];
  });
}

function collectComponentTextTokenReferences() {
  const srcRoot = resolve(__dirname, "..");
  const tokenNames = new Set<string>();
  for (const filePath of readFrontendSourceFiles(srcRoot)) {
    const source = readFileSync(filePath, "utf8");
    for (const [, tokenName] of source.matchAll(/text-\[var\((--[\w-]+)\)\]/g)) {
      tokenNames.add(tokenName);
    }
    for (const [, tokenName] of source.matchAll(/color:\s*var\((--[\w-]+)\)/g)) {
      tokenNames.add(tokenName);
    }
  }
  return [...tokenNames].sort();
}

describe("light theme tokens", () => {
  it("uses the exact light CodePen Neuromorphic primitives instead of the dark variant", () => {
    const css = readFileSync(resolve(__dirname, "tokens.css"), "utf8");
    const tokens = readCssCustomProperties(LIGHT_NEU_SELECTOR);

    expect(css).not.toContain('[data-theme="legacy-light"], .legacy-light');
    expect(css).not.toContain('[data-theme="light"], .light, [data-theme="neuromorphic"], .neuromorphic');
    expect(readToken(tokens, "--neu-surface-bg")).toBe("#e0e5ec");
    expect(readToken(tokens, "--neu-bg-primary")).toBe("var(--neu-surface-bg)");
    expect(readToken(tokens, "--neu-bg-secondary")).toBe("var(--neu-surface-bg)");
    expect(readToken(tokens, "--neu-shadow-dark")).toBe("#bec3c9");
    expect(readToken(tokens, "--neu-shadow-light")).toBe("#ffffff");
    expect(readToken(tokens, "--neu-primary")).toBe("#6366f1");
    expect(readToken(tokens, "--neu-primary-dark")).toBe("#4f46e5");
    expect(readToken(tokens, "--color-text-primary")).toBe("rgba(var(--rgb-slate-900), 0.92)");
    expect(readToken(tokens, "--color-text-secondary")).toBe("rgba(var(--rgb-slate-700), 0.84)");
  });

  it("maps light mode page, nav, cards, forms, and previews to Neuromorphic raised/inset surfaces", () => {
    const tokens = readCssCustomProperties(LIGHT_NEU_SELECTOR);

    expect(readToken(tokens, "--surface-page-gradient")).toBe("var(--neu-surface-bg)");
    expect(readToken(tokens, "--nav-panel-bg")).toBe("var(--neu-inset-bg)");
    expect(readToken(tokens, "--filelist-toolbar-bg")).toBe("var(--neu-raised-bg)");
    expect(readToken(tokens, "--filelist-card-bg")).toBe("var(--neu-raised-bg)");
    expect(readToken(tokens, "--settings-form-input-bg")).toBe("var(--neu-inset-bg)");
    expect(readToken(tokens, "--upload-dialog-bg")).toBe("var(--neu-raised-bg)");
    expect(readToken(tokens, "--preview-caption-bg")).toBe("var(--neu-raised-bg)");
    expect(readToken(tokens, "--trash-panel-bg")).toBe("var(--neu-raised-bg)");
  });

  it("keeps selected theme options visually distinct from light primary action buttons", () => {
    const tokens = readCssCustomProperties(LIGHT_NEU_SELECTOR);

    expect(readToken(tokens, "--settings-theme-option-active-bg")).not.toBe(
      readToken(tokens, "--settings-action-bg"),
    );
    expect(readToken(tokens, "--settings-theme-option-active-bg-hover")).not.toBe(
      readToken(tokens, "--settings-action-bg-hover"),
    );
    expect(readToken(tokens, "--settings-theme-option-active-text")).not.toBe(
      readToken(tokens, "--settings-action-text"),
    );
    expect(readToken(tokens, "--settings-theme-option-active-bg")).toContain(
      "rgba(99, 102, 241",
    );
    expect(readToken(tokens, "--settings-theme-option-active-text")).toBe(
      "var(--neu-primary-dark)",
    );
  });

  it("maps login and registration pages to Neuromorphic auth primitives", () => {
    const tokens = readCssCustomProperties(LIGHT_NEU_SELECTOR);

    expect(readToken(tokens, "--auth-card-bg")).toBe("var(--neu-raised-bg)");
    expect(readToken(tokens, "--auth-card-border")).toBe("transparent");
    expect(readToken(tokens, "--auth-card-shadow")).toBe("var(--neu-surface-shadow)");
    expect(readToken(tokens, "--auth-card-backdrop")).toBe("none");
    expect(tokens.has("--auth-card-glow-bg")).toBe(false);
    expect(tokens.has("--auth-card-edge-bg")).toBe(false);
    expect(tokens.has("--auth-logo-aura-bg")).toBe(false);
    expect(tokens.has("--auth-logo-aura-opacity")).toBe(false);
    expect(readToken(tokens, "--auth-logo-shell-bg")).toBe("var(--neu-inset-bg)");
    expect(readToken(tokens, "--auth-logo-shell-shadow")).toBe("var(--neu-inset-shadow)");
    expect(readToken(tokens, "--auth-input-bg")).toBe("var(--neu-inset-bg)");
    expect(readToken(tokens, "--auth-input-border")).toBe("transparent");
    expect(readToken(tokens, "--auth-input-shadow")).toBe("var(--neu-inset-shadow)");
    expect(readToken(tokens, "--auth-button-gradient")).toBe("var(--neu-primary)");
    expect(readToken(tokens, "--auth-button-shadow-active")).toBe("var(--neu-pressed-shadow)");
    expect(readToken(tokens, "--auth-oauth-button-bg")).toBe("var(--neu-raised-bg)");
    expect(readToken(tokens, "--auth-oauth-disabled-bg")).toBe("var(--neu-inset-bg)");
  });

  it("keeps the auth page flat without obsolete Shape Wave tokens", () => {
    const tokens = readCssCustomProperties(LIGHT_NEU_SELECTOR);

    expect(readToken(tokens, "--auth-page-bg")).toBe("var(--surface-page-gradient)");
    expect([...tokens.keys()].some((name) => name.startsWith("--auth-shape-wave"))).toBe(false);
  });

  it("uses pure primary action fills and opts light into the AJgeEd fireworks background", () => {
    const tokens = readCssCustomProperties(LIGHT_NEU_SELECTOR);

    expect(readToken(tokens, "--cta-primary-bg")).toBe("var(--neu-primary)");
    expect(readToken(tokens, "--settings-action-bg")).toBe("var(--neu-primary)");
    expect(readToken(tokens, "--dialog-primary-btn-bg")).toBe("var(--neu-primary)");
    expect(tokens.has("--filelist-shape-wave-bg")).toBe(false);
    expect(readToken(tokens, "--filelist-fireworks-bg")).toBe("#e5e7eb");
    expect(readToken(tokens, "--filelist-fireworks-opacity")).toBe("0.52");
    expect(readToken(tokens, "--filelist-fireworks-trail-fill")).toBe("rgba(229, 231, 235, 0.48)");
  });

  it("overrides shared text tokens so light Neuromorphic does not inherit dark-theme copy colors", () => {
    const tokens = readCssCustomProperties(LIGHT_NEU_SELECTOR);

    for (const [name, expected] of [
      ["--btn-secondary-text", "rgba(var(--rgb-slate-700), 0.9)"],
      ["--modal-title-text", "rgba(var(--rgb-slate-900), 0.92)"],
      ["--filters-text", "rgba(var(--rgb-slate-900), 0.88)"],
      ["--filelist-menu-text", "rgba(var(--rgb-slate-900), 0.9)"],
      ["--settings-form-input-text", "rgba(var(--rgb-slate-900), 0.9)"],
      ["--upload-item-text", "rgba(var(--rgb-slate-900), 0.9)"],
      ["--upload-stat-text", "rgba(var(--rgb-slate-700), 0.84)"],
      ["--error-boundary-title", "rgba(var(--rgb-slate-900), 0.94)"],
      ["--auth-title-text", "rgba(var(--rgb-slate-900), 0.94)"],
      ["--loading-text", "rgba(var(--rgb-slate-600), 0.72)"],
    ] as const) {
      expect(readToken(tokens, name)).toBe(expected);
    }
  });

  it("defines every component text color token inside the light Neuromorphic block", () => {
    const tokens = readCssCustomProperties(LIGHT_NEU_SELECTOR);
    const missing = collectComponentTextTokenReferences().filter((tokenName) => !tokens.has(tokenName));

    expect(missing).toEqual([]);
  });
});
