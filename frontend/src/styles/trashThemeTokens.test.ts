import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
  expect(value).toBeDefined();
  return value ?? "";
}

const TRASH_TECH_TOKENS = [
  "--trash-tech-grid",
  "--trash-tech-beam",
  "--trash-tech-scanline",
  "--trash-tech-panel",
  "--trash-tech-panel-strong",
  "--trash-tech-border",
  "--trash-tech-border-strong",
  "--trash-tech-corner",
  "--trash-tech-shadow",
];

function expectTrashTechTokens(tokens: Map<string, string>) {
  for (const token of TRASH_TECH_TOKENS) {
    expect(readToken(tokens, token), token).not.toHaveLength(0);
  }
}

describe("trash theme tokens", () => {
  it("defines Blackglass Reactor tokens for dark mode", () => {
    const tokens = readCssCustomProperties(/:root,\s*\[data-theme="dark"\],\s*\.dark\s*\{/);

    expectTrashTechTokens(tokens);
    expect(readToken(tokens, "--trash-tech-panel")).toContain("rgba(var(--rgb-slate-950)");
    expect(readToken(tokens, "--trash-tech-beam")).toContain("rgba(var(--rgb-cyan-400)");
    expect(readToken(tokens, "--trash-tech-corner")).toContain("rgba(var(--rgb-emerald-300)");
    expect(readToken(tokens, "--trash-page-bg")).toContain("rgba(var(--rgb-emerald-400)");
    expect(readToken(tokens, "--trash-panel-bg")).toContain("rgba(var(--rgb-slate-950)");
    expect(readToken(tokens, "--trash-panel-bg")).toContain("rgba(var(--rgb-emerald-400)");
    expect(readToken(tokens, "--trash-thumb-bg")).toContain("rgba(var(--rgb-slate-950)");
    expect(readToken(tokens, "--trash-thumb-bg")).toContain("rgba(var(--rgb-cyan-400)");
    expect(readToken(tokens, "--trash-countdown-text")).toContain("rgba(var(--rgb-emerald-400)");
    expect(readToken(tokens, "--trash-countdown-danger")).toContain("rgba(var(--rgb-rose-400)");
  });

  it("defines Opal Cyberglass tokens for light mode", () => {
    const tokens = readCssCustomProperties(/\[data-theme="light"\],\s*\.light\s*\{/);

    expectTrashTechTokens(tokens);
    expect(readToken(tokens, "--trash-tech-panel")).toContain("rgba(var(--rgb-white)");
    expect(readToken(tokens, "--trash-tech-grid")).toContain("rgba(var(--rgb-slate-950)");
    expect(readToken(tokens, "--trash-tech-beam")).toContain("rgba(var(--rgb-emerald-400)");
    expect(readToken(tokens, "--trash-page-bg")).toContain("rgba(var(--rgb-white)");
    expect(readToken(tokens, "--trash-page-bg")).toContain("rgba(var(--rgb-emerald-400)");
    expect(readToken(tokens, "--trash-panel-bg")).toContain("rgba(var(--rgb-emerald-400)");
    expect(readToken(tokens, "--trash-thumb-bg")).toContain("rgba(var(--rgb-slate-950)");
    expect(readToken(tokens, "--trash-countdown-text")).toContain("rgba(var(--rgb-emerald-400)");
    expect(readToken(tokens, "--trash-purge-text")).toContain("rgba(var(--rgb-rose-400)");
  });

  it("defines Nebula Vault tokens for purple mode", () => {
    const tokens = readCssCustomProperties(/\[data-theme="purple"\],\s*\.purple\s*\{/);

    expectTrashTechTokens(tokens);
    expect(readToken(tokens, "--trash-tech-panel")).toContain("rgba(var(--rgb-purple-950)");
    expect(readToken(tokens, "--trash-tech-beam")).toContain("rgba(var(--rgb-cyan-400)");
    expect(readToken(tokens, "--trash-tech-corner")).toContain("rgba(var(--rgb-fuchsia-500)");
    expect(readToken(tokens, "--trash-page-bg")).toContain("rgba(var(--rgb-purple-950)");
    expect(readToken(tokens, "--trash-page-bg")).toContain("rgba(var(--rgb-fuchsia-500)");
    expect(readToken(tokens, "--trash-panel-bg")).toContain("rgba(var(--rgb-purple-500)");
    expect(readToken(tokens, "--trash-thumb-bg")).toContain("rgba(var(--rgb-purple-950)");
    expect(readToken(tokens, "--trash-thumb-bg")).toContain("rgba(var(--rgb-cyan-400)");
    expect(readToken(tokens, "--trash-countdown-text")).toContain("rgba(var(--rgb-cyan-400)");
    expect(readToken(tokens, "--trash-countdown-danger")).toContain("rgba(var(--rgb-rose-400)");
  });
});
