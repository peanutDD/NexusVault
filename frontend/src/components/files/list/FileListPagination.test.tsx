import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FileListPagination from "./FileListPagination";

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds = [];
  disconnect = vi.fn();
  observe = vi.fn();
  takeRecords = vi.fn(() => []);
  unobserve = vi.fn();
}

function cssSource() {
  return readFileSync(resolve(__dirname, "FileListGlass.css"), "utf8");
}

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

describe("FileListPagination neuromorphic controls", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("marks Load more as a raised neuromorphic control instead of a cyber gradient", () => {
    render(
      <FileListPagination
        page={1}
        totalPages={3}
        hasMore
        loadingMore={false}
        onLoadMore={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Load more/i })).toHaveClass(
      "loadMoreCyber",
      "toolbarActionBtn",
    );

    const css = cssSource();
    const loadMoreRule = readRuleBody(
      css,
      /^\s*\.neuromorphic-style\s*\.fileListGlassScope\s*\.glass-btn\.toolbarActionBtn\.loadMoreCyber\s*\{/m,
    );

    expect(loadMoreRule).toContain("background: var(--filelist-load-more-bg)");
    expect(loadMoreRule).toContain("box-shadow: var(--neu-raised-sm-shadow)");
    expect(loadMoreRule).toContain("color: var(--filelist-load-more-text)");
    expect(loadMoreRule).not.toContain("emerald");
    expect(loadMoreRule).not.toContain("malachite");
    expect(loadMoreRule).not.toContain("linear-gradient");
    expect(css).not.toMatch(/loadMoreCyber[\s\S]*?malachite/);
    expect(css).not.toMatch(/loadMoreCyber[\s\S]*?emerald/);
  });

  it("gives Load more theme-specific text and background colors in light and dark", () => {
    const css = cssSource();
    const loadMoreRule = readRuleBody(
      css,
      /^\s*\.fileListGlassScope\s*\.glass-btn\.toolbarActionBtn\.loadMoreCyber\s*\{/m,
    );
    const loadMoreHoverRule = readRuleBody(
      css,
      /^\s*\.fileListGlassScope\s*\.glass-btn\.toolbarActionBtn\.loadMoreCyber:hover\s*\{/m,
    );

    expect(loadMoreRule).toContain("background: var(--filelist-load-more-bg)");
    expect(loadMoreRule).toContain("color: var(--filelist-load-more-text)");
    expect(loadMoreRule).toContain("border-color: var(--filelist-load-more-border)");
    expect(loadMoreHoverRule).toContain("background: var(--filelist-load-more-bg-hover)");
    expect(loadMoreHoverRule).toContain("color: var(--filelist-load-more-text-hover)");

    const tokensCss = readFileSync(
      resolve(__dirname, "../../../styles/tokens.css"),
      "utf8",
    );

    expect(tokensCss).toContain("--filelist-load-more-bg:");
    expect(tokensCss).toContain("--filelist-load-more-bg-hover:");
    expect(tokensCss).toContain("--filelist-load-more-text:");
    expect(tokensCss).toContain("--filelist-load-more-text-hover:");
    expect(tokensCss).toMatch(
      /:root\[data-theme="light"\],\s*:root\.light\s*\{[\s\S]*--filelist-load-more-bg:\s*linear-gradient\(145deg,\s*rgba\(var\(--rgb-white\),\s*0\.98\),\s*rgba\(var\(--rgb-slate-200\),\s*0\.94\)\);[\s\S]*--filelist-load-more-text:\s*rgba\(var\(--rgb-purple-900\),\s*0\.98\);/,
    );
    expect(tokensCss).toMatch(
      /:root\[data-theme="dark"\],\s*:root\.dark\s*\{[\s\S]*--filelist-load-more-bg:\s*linear-gradient\(145deg,\s*rgba\(var\(--rgb-purple-500\),\s*0\.92\),\s*rgba\(var\(--rgb-purple-900\),\s*0\.82\)\);[\s\S]*--filelist-load-more-text:\s*rgba\(var\(--rgb-white\),\s*0\.98\);/,
    );
  });

  it("marks traditional pagination buttons for neuromorphic raised and pressed states", () => {
    render(
      <FileListPagination
        page={2}
        totalPages={5}
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "上一页" })).toHaveClass(
      "paginationNeuButton",
    );
    expect(screen.getByRole("button", { name: "下一页" })).toHaveClass(
      "paginationNeuButton",
    );
    expect(screen.getByRole("button", { name: "2" })).toHaveClass(
      "paginationNeuButton",
      "paginationNeuButtonActive",
    );

    const css = cssSource();
    const pageRule = readRuleBody(
      css,
      /^\s*\.neuromorphic-style\s*\.fileListGlassScope\s*\.paginationNeuButton\s*\{/m,
    );
    const activeRule = readRuleBody(
      css,
      /^\s*\.neuromorphic-style\s*\.fileListGlassScope\s*\.paginationNeuButtonActive\s*\{/m,
    );

    expect(pageRule).toContain("background: var(--neu-raised-bg)");
    expect(pageRule).toContain("box-shadow: var(--neu-raised-sm-shadow)");
    expect(activeRule).toContain("background: var(--neu-inset-bg)");
    expect(activeRule).toContain("box-shadow: var(--neu-pressed-shadow)");
  });
});
