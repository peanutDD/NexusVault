import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_DARK_SELECTOR = /:root,\s*\[data-theme="dark"\],\s*\.dark\s*\{/;

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

describe("settings typography tokens", () => {
  it("keeps settings copy scaling fluid across desktop widths instead of capping early", () => {
    const tokens = readCssCustomProperties(BASE_DARK_SELECTOR);

    expect(readToken(tokens, "--settings-text-xs")).toBe(
      "clamp(0.65rem, 0.18vw + 0.61rem, 0.75rem)",
    );
    expect(readToken(tokens, "--settings-text-sm")).toBe(
      "clamp(0.75rem, 0.24vw + 0.68rem, 0.875rem)",
    );
    expect(readToken(tokens, "--settings-text-md")).toBe(
      "clamp(0.825rem, 0.28vw + 0.76rem, 0.95rem)",
    );
    expect(readToken(tokens, "--settings-text-lg")).toBe(
      "clamp(0.95rem, 0.34vw + 0.88rem, 1.125rem)",
    );
    expect(readToken(tokens, "--settings-text-xl")).toBe(
      "clamp(1.05rem, 0.42vw + 0.96rem, 1.3rem)",
    );
  });
});
