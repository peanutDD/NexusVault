import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readLastCssDeclarations(source: string, selectorPattern: RegExp) {
  const matches = [
    ...source.matchAll(new RegExp(selectorPattern.source, `${selectorPattern.flags}g`)),
  ];
  const selector = matches.at(-1);
  expect(selector).toBeDefined();

  if (!selector) {
    throw new Error(`Missing CSS selector: ${selectorPattern.source}`);
  }

  const ruleBody = source
    .slice((selector.index ?? 0) + selector[0].length)
    .match(/^[\s\S]*?(?=\s*})/)?.[0];
  expect(ruleBody).toBeDefined();

  const declarations = new Map<string, string>();
  for (const [, name, value] of (ruleBody ?? "").matchAll(/([\w-]+)\s*:\s*([^;]+);/g)) {
    declarations.set(name, value.trim());
  }

  return declarations;
}

function readDeclaration(declarations: Map<string, string>, name: string) {
  const value = declarations.get(name);
  expect(value, name).toBeDefined();
  return value ?? "";
}

function expectDeclarations(
  declarations: Map<string, string>,
  expected: Record<string, string>,
) {
  for (const [name, value] of Object.entries(expected)) {
    expect(readDeclaration(declarations, name)).toBe(value);
  }
}

const DARK_SELECTOR = /:root\[data-theme="dark"\],\s*:root\.dark\s*\{/;
const LIGHT_SELECTOR = /:root\[data-theme="light"\],\s*:root\.light\s*\{/;

describe("global Neuromorphic primitive contract", () => {
  it("defines the exact pure-material source tokens in the final theme blocks", () => {
    const css = readFileSync(resolve(__dirname, "tokens.css"), "utf8");
    const themes = {
      dark: readLastCssDeclarations(css, DARK_SELECTOR),
      light: readLastCssDeclarations(css, LIGHT_SELECTOR),
    };
    const expected = {
      dark: { surface: "#2d3748", shadowDark: "#1a202c", shadowLight: "#4a5568" },
      light: { surface: "#e0e5ec", shadowDark: "#bec3c9", shadowLight: "#ffffff" },
    } as const;
    const shared = {
      "--neu-bg-primary": "var(--neu-surface-bg)",
      "--neu-bg-secondary": "var(--neu-surface-bg)",
      "--neu-primary": "#6366f1",
      "--neu-primary-dark": "#4f46e5",
      "--neu-raised-bg": "var(--neu-surface-bg)",
      "--neu-inset-bg": "var(--neu-surface-bg)",
      "--surface-page-gradient": "var(--neu-surface-bg)",
      "--neu-raised-shadow": "8px 8px 16px var(--neu-shadow-dark), -8px -8px 16px var(--neu-shadow-light)",
      "--neu-raised-sm-shadow": "4px 4px 8px var(--neu-shadow-dark), -4px -4px 8px var(--neu-shadow-light)",
      "--neu-inset-shadow": "inset 4px 4px 8px var(--neu-shadow-dark), inset -4px -4px 8px var(--neu-shadow-light)",
      "--neu-pressed-shadow": "inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light)",
    };

    for (const themeName of ["dark", "light"] as const) {
      expectDeclarations(themes[themeName], {
        ...shared,
        "--neu-surface-bg": expected[themeName].surface,
        "--neu-shadow-dark": expected[themeName].shadowDark,
        "--neu-shadow-light": expected[themeName].shadowLight,
      });
    }
  });

  it("provides flat, raised, inset, pressed, and semantic component primitives", () => {
    const primitivePath = resolve(__dirname, "neuromorphic.css");
    expect(existsSync(primitivePath)).toBe(true);

    if (!existsSync(primitivePath)) {
      return;
    }

    const css = readFileSync(primitivePath, "utf8");
    const selectors = [
      ".neu-flat", ".neu-raised", ".neu-raised-sm", ".neu-inset", ".neu-pressed", ".neu-semantic-raised",
    ];

    expect(css).toContain("@layer components");
    for (const selector of selectors) {
      const declarations = readLastCssDeclarations(
        css,
        new RegExp(`${selector.replace(".", "\\.")}\\s*\\{`),
      );

      expect(readDeclaration(declarations, "border-color")).toBe("transparent");
      expect(readDeclaration(declarations, "background-image")).toBe("none");
    }
  });
});
