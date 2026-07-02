import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import BottomBar from "./BottomBar";

const __dirname = dirname(fileURLToPath(import.meta.url));

const LIGHT_NEU_SELECTOR =
  /:root\[data-theme="light"\],\s*:root\.light\s*\{/;
const DARK_NEU_SELECTOR =
  /:root\[data-theme="dark"\],\s*:root\.dark\s*\{/;

function readCssCustomProperties(selectorPattern: RegExp) {
  const css = readFileSync(resolve(__dirname, "../../styles/tokens.css"), "utf8");
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

describe("BottomBar", () => {
  it("exposes a Neuromorphic-ready footer surface without changing content", () => {
    render(<BottomBar />);

    expect(screen.getByTestId("bottom-bar")).toHaveClass("neu-raised");
    expect(screen.queryByTestId("bottom-bar-surface")).not.toBeInTheDocument();
    expect(screen.queryByTestId("bottom-bar-grid")).not.toBeInTheDocument();
    expect(screen.queryByTestId("bottom-bar-gradient")).not.toBeInTheDocument();
    expect(screen.queryByTestId("bottom-bar-shimmer")).not.toBeInTheDocument();
    expect(screen.getByText(/All rights reserved/i)).toBeInTheDocument();
  });

  it("maps Light footer tokens to a quiet raised surface", () => {
    const tokens = readCssCustomProperties(LIGHT_NEU_SELECTOR);

    expect(readToken(tokens, "--footer-surface-bg")).toBe("var(--neu-raised-bg)");
    expect(readToken(tokens, "--footer-border")).toBe("transparent");
    expect(readToken(tokens, "--footer-surface-shadow")).toBe("var(--neu-surface-shadow)");
    expect(readToken(tokens, "--footer-grid-bg-image")).toBe("none");
    expect(readToken(tokens, "--footer-bg-gradient")).toBe("none");
    expect(readToken(tokens, "--footer-top-line")).toBe("transparent");
    expect(readToken(tokens, "--footer-bottom-line")).toBe("transparent");
    expect(readToken(tokens, "--footer-shimmer-bg")).toBe("transparent");
    expect(readToken(tokens, "--footer-divider-left")).toContain("var(--neu-shadow-dark)");
    expect(readToken(tokens, "--footer-divider-right")).toContain("var(--neu-shadow-light)");
    expect(readToken(tokens, "--footer-dot-bg")).toBe("var(--neu-inset-bg)");
    expect(readToken(tokens, "--footer-dot-shadow")).toBe("var(--neu-inset-shadow)");
  });

  it("maps Dark footer tokens to the dark CodePen raised surface", () => {
    const tokens = readCssCustomProperties(DARK_NEU_SELECTOR);

    expect(readToken(tokens, "--footer-surface-bg")).toBe("var(--neu-raised-bg)");
    expect(readToken(tokens, "--footer-border")).toBe("transparent");
    expect(readToken(tokens, "--footer-surface-shadow")).toBe("var(--neu-surface-shadow)");
    expect(readToken(tokens, "--footer-grid-bg-image")).toBe("none");
    expect(readToken(tokens, "--footer-bg-gradient")).toBe("none");
    expect(readToken(tokens, "--footer-top-line")).toBe("transparent");
    expect(readToken(tokens, "--footer-bottom-line")).toBe("transparent");
    expect(readToken(tokens, "--footer-shimmer-bg")).toBe("transparent");
    expect(readToken(tokens, "--footer-title-text")).toBe("rgba(var(--rgb-white), 0.9)");
    expect(readToken(tokens, "--footer-copy-text")).toBe("rgba(var(--rgb-slate-400), 0.72)");
    expect(readToken(tokens, "--footer-divider-left")).toContain("var(--neu-shadow-dark)");
    expect(readToken(tokens, "--footer-divider-right")).toContain("var(--neu-shadow-light)");
    expect(readToken(tokens, "--footer-dot-bg")).toBe("var(--neu-inset-bg)");
    expect(readToken(tokens, "--footer-dot-shadow")).toBe("var(--neu-inset-shadow)");
  });
});
