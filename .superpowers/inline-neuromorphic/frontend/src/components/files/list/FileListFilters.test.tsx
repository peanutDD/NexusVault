import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import FileListFilters from "./FileListFilters";

function compact(cssRule: string) {
  return cssRule.replace(/\s+/g, " ").trim();
}

describe("FileListFilters", () => {
  it("调用 onSearchChange 并显示/隐藏清除按钮", async () => {
    const user = userEvent.setup();
    const handleSearchChange = vi.fn();

    const { rerender, getByPlaceholderText, getByRole } = render(
      <FileListFilters
        search=""
        mimeType=""
        sortBy="created_at_desc"
        onSearchChange={handleSearchChange}
        onMimeTypeChange={() => {}}
        onSortChange={() => {}}
        data-oid="u4rss70"
      />,
    );

    const input = getByPlaceholderText("Search… (Ctrl+K)");
    await user.type(input, "test");

    expect(handleSearchChange).toHaveBeenCalled();

    // 重新渲染，模拟父组件把 search 状态更新为非空
    rerender(
      <FileListFilters
        search="test"
        mimeType=""
        sortBy="created_at_desc"
        onSearchChange={handleSearchChange}
        onMimeTypeChange={() => {}}
        onSortChange={() => {}}
        data-oid="kyehbne"
      />,
    );

    const clearButton = getByRole("button", { name: "Clear search" });
    await user.click(clearButton);

    expect(handleSearchChange).toHaveBeenCalledWith("");
  });

  it("keeps type and sort dropdowns inside the filter container", async () => {
    const user = userEvent.setup();
    const { container, getByRole } = render(
      <FileListFilters
        search=""
        mimeType=""
        sortBy="created_at_desc"
        onSearchChange={() => {}}
        onMimeTypeChange={() => {}}
        onSortChange={() => {}}
      />,
    );

    await user.click(getByRole("button", { name: "Type filter" }));
    const typeMenu = getByRole("menu", { name: "Type options" });
    expect(container).toContainElement(typeMenu);

    await user.click(getByRole("button", { name: "Sort order" }));
    const sortMenu = getByRole("menu", { name: "Sort options" });
    expect(container).toContainElement(sortMenu);
  });

  it("keeps dropdowns local, opaque, and above file content", () => {
    const css = readFileSync(
      resolve(__dirname, "FileListFilters.css"),
      "utf8",
    );
    const glassCss = readFileSync(
      resolve(__dirname, "FileListGlass.css"),
      "utf8",
    );

    expect(css).toContain("position: absolute;");
    expect(css).not.toContain("position: fixed;");
    expect(css).toContain("z-index: var(--filters-dropdown-z);");
    expect(glassCss).toContain("z-index: 45;");
  });

  it("maps the toolbar controls to the shared inset and raised primitives", () => {
    const filterCss = readFileSync(
      resolve(__dirname, "FileListFilters.css"),
      "utf8",
    );
    const source = readFileSync(
      resolve(__dirname, "FileListFilters.tsx"),
      "utf8",
    );
    const dropdownSource = readFileSync(
      resolve(__dirname, "../../common/DropdownMenu.tsx"),
      "utf8",
    );
    const combined = compact(`${filterCss}\n${source}\n${dropdownSource}`);

    expect(combined).toContain("neu-inset filtersSearchPill");
    expect(combined).toContain("neu-raised-sm filtersCard");
    expect(combined).toContain("neu-raised filtersDropdownPanel");
    expect(combined).toContain("neu-pressed filtersItem filtersItemSelected");
    expect(combined).not.toContain("linear-gradient");
    expect(combined).not.toContain("backdrop-filter");
  });

  it("keeps toolbar controls equal-height and focuses search along the inset groove", () => {
    const css = readFileSync(resolve(__dirname, "FileListFilters.css"), "utf8");
    const compactCss = compact(css);

    expect(compactCss).toContain(".filtersSearchPill::after");
    expect(compactCss).toContain(".filtersSearchPill:focus-within::after");
    expect(compactCss).toContain(".filtersSearchInput:focus-visible");
    expect(compactCss).toContain("box-shadow: inset 0 0 0");
    expect(compactCss).toContain(".filtersActions .toolbarActionBtn");
    expect(compactCss).toContain("height: var(--filters-control-h);");
    expect(compactCss).toContain("min-height: var(--filters-control-h);");
    expect(compactCss).not.toContain("outline: 2px solid");
  });

  it("keeps file filter CSS theme-neutral", () => {
    const css = readFileSync(resolve(__dirname, "FileListFilters.css"), "utf8");

    expect(css).not.toContain(".neuromorphic-style");
    expect(css).not.toContain(":root.dark");
    expect(css).not.toContain('[data-theme="light"]');
    expect(css).not.toContain("glass-");
  });
});
