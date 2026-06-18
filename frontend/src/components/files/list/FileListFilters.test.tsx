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

  it("uses an opaque dropdown panel instead of the transparent filter surface", () => {
    const css = readFileSync(
      resolve(__dirname, "FileListFilters.css"),
      "utf8",
    );

    expect(css).toContain("position: absolute;");
    expect(css).not.toContain("position: fixed;");
    expect(css).toContain("--filters-dropdown-surface-bg-top");
    expect(css).toContain("--filters-dropdown-surface-bg-bottom");
  });

  it("raises the transformed toolbar above file content while a dropdown is open", () => {
    const filterCss = readFileSync(
      resolve(__dirname, "FileListFilters.css"),
      "utf8",
    );
    const glassCss = readFileSync(
      resolve(__dirname, "FileListGlass.css"),
      "utf8",
    );

    expect(filterCss).toContain("z-index: var(--filters-dropdown-z);");
    expect(glassCss).toContain("z-index: var(--filters-dropdown-toolbar-z);");
  });

  it("maps the neuromorphic homepage toolbar row to CodePen inset and raised primitives", () => {
    const filterCss = readFileSync(
      resolve(__dirname, "FileListFilters.css"),
      "utf8",
    );
    const glassCss = readFileSync(
      resolve(__dirname, "FileListGlass.css"),
      "utf8",
    );
    const combinedCss = compact(`${filterCss}\n${glassCss}`);

    expect(combinedCss).toContain(
      '.neuromorphic-style .fileListGlassScope .glass-panel.glass-panel-toolbar.fileListToolbarScale75',
    );
    expect(combinedCss).toContain("background: var(--neu-inset-bg)");
    expect(combinedCss).toContain("box-shadow: var(--neu-inset-shadow)");
    expect(combinedCss).toContain(
      '.neuromorphic-style .filtersSearchPill',
    );
    expect(combinedCss).toContain(
      '.neuromorphic-style .filtersCard',
    );
    expect(combinedCss).toContain(
      '.neuromorphic-style .filtersCard::before',
    );
    expect(combinedCss).toContain("display: none");
    expect(combinedCss).toContain("background: var(--neu-raised-bg)");
    expect(combinedCss).toContain("box-shadow: var(--neu-raised-sm-shadow)");
    expect(combinedCss).toContain(
      '.neuromorphic-style .fileListGlassScope .toolbarActionBtn',
    );
  });

  it("keeps dark refresh filter dropdowns readable on raised Neuromorphic surfaces", () => {
    const filterCss = compact(
      readFileSync(resolve(__dirname, "FileListFilters.css"), "utf8"),
    );
    const tokenCss = compact(
      readFileSync(resolve(__dirname, "../../../styles/tokens.css"), "utf8"),
    );

    expect(filterCss).toContain(
      ":root.dark.neuromorphic-style .filtersDropdownPanel",
    );
    expect(filterCss).toContain("background: var(--neu-raised-bg) !important");
    expect(filterCss).toContain("box-shadow: var(--neu-raised-shadow) !important");
    expect(filterCss).toContain(
      ":root.dark.neuromorphic-style .filtersItem",
    );
    expect(filterCss).toContain("color: var(--filters-dropdown-item-text) !important");
    expect(filterCss).toContain(
      ":root.dark.neuromorphic-style .filtersItemSelected",
    );
    expect(filterCss).toContain(
      "background: linear-gradient(145deg, var(--neu-primary), var(--neu-primary-dark)) !important",
    );
    expect(tokenCss).toContain("--filters-dropdown-item-text: rgba(var(--rgb-slate-300), 0.94)");
  });

  it("overrides the old All Files and upload highlight buttons in neuromorphic", () => {
    const glassCss = readFileSync(
      resolve(__dirname, "FileListGlass.css"),
      "utf8",
    );
    const combinedCss = compact(glassCss);

    const legacyUploadIndex = combinedCss.indexOf(
      ".fileListGlassScope .glass-btn.uploadBtnHighlight",
    );
    const neuromorphicUploadIndex = combinedCss.indexOf(
      '.neuromorphic-style .fileListGlassScope .glass-btn.toolbarActionBtn.uploadBtnHighlight',
    );
    const neuromorphicAllFilesIndex = combinedCss.indexOf(
      '.neuromorphic-style .fileListGlassScope .glass-btn.toolbarActionBtn.allFilesBtnHighlight',
    );

    expect(legacyUploadIndex).toBeGreaterThan(-1);
    expect(neuromorphicUploadIndex).toBeGreaterThan(legacyUploadIndex);
    expect(neuromorphicAllFilesIndex).toBeGreaterThan(legacyUploadIndex);
    expect(combinedCss).toContain("background: var(--neu-raised-bg)");
    expect(combinedCss).toContain("box-shadow: var(--neu-raised-sm-shadow)");
    expect(combinedCss).toContain("text-shadow: none");
  });
});
