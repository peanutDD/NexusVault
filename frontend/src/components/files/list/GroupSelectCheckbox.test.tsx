import { render, screen } from "@testing-library/react";
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it, vi } from "vitest";

import { GroupSelectCheckbox, GroupSelectCheckboxMixed } from "./GroupSelectCheckbox";

function readFileListGlassCss() {
  return readFileSync(resolve(__dirname, "FileListGlass.css"), "utf8");
}

function extractRule(css: string, selector: string) {
  const index = css.indexOf(selector);
  expect(index).toBeGreaterThanOrEqual(0);
  const bodyStart = css.indexOf("{", index);
  const bodyEnd = css.indexOf("}", bodyStart);
  return css.slice(bodyStart + 1, bodyEnd);
}

function extractLastRule(css: string, selector: string) {
  const index = css.lastIndexOf(selector);
  expect(index).toBeGreaterThanOrEqual(0);
  const bodyStart = css.indexOf("{", index);
  const bodyEnd = css.indexOf("}", bodyStart);
  return css.slice(bodyStart + 1, bodyEnd);
}

describe("GroupSelectCheckbox", () => {
  it("renders the unchecked group checkbox as a dedicated empty square control", () => {
    render(
      <GroupSelectCheckbox
        itemIds={["file-a", "file-b"]}
        selectedIds={new Set()}
        onToggle={vi.fn()}
      />,
    );

    const checkbox = screen.getByRole("button", { name: "全选此分组" });

    expect(checkbox).toHaveClass("fileListGroupSelectCheckbox");
    expect(checkbox).toHaveClass("fileListGroupSelectCheckboxUnchecked");
    expect(checkbox).not.toHaveClass("fileListGroupSelectCheckboxSelected");
    expect(checkbox.querySelector("i")).toBeNull();
    expect(checkbox.textContent).toBe("");
  });

  it("renders only fully checked group states as the purple filled square treatment", () => {
    const { rerender } = render(
      <GroupSelectCheckbox
        itemIds={["file-a"]}
        selectedIds={new Set(["file-a"])}
        onToggle={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "取消全选此分组" })).toHaveClass(
      "fileListGroupSelectCheckboxSelected",
    );

    rerender(
      <GroupSelectCheckboxMixed
        fileIds={["file-a", "file-b"]}
        folderIds={[]}
        selectedFileIds={new Set(["file-a"])}
        selectedFolderIds={new Set()}
        onToggle={vi.fn()}
      />,
    );

    const mixedCheckbox = screen.getByRole("button", { name: "全选此分组" });

    expect(mixedCheckbox).toHaveClass("fileListGroupSelectCheckboxMixed");
    expect(mixedCheckbox).not.toHaveClass("fileListGroupSelectCheckboxSelected");
    expect(mixedCheckbox.querySelector("i")).toBeNull();
    expect(mixedCheckbox.textContent).toBe("");
  });

  it("keeps the group checkbox CSS tokenized, fluid, and valid", () => {
    const css = readFileListGlassCss();
    const baseRule = extractRule(
      css,
      ".neuromorphic-style .fileListGlassScope .fileListGroupSelectCheckbox",
    );

    expect(baseRule).toContain("width: clamp(");
    expect(baseRule).toContain("height: clamp(");
    expect(baseRule).toContain("border-radius: clamp(");
    expect(baseRule).toContain("var(--neu-inset-bg)");
    expect(baseRule).toContain("inset");
    expect(baseRule).not.toContain("px");
    expect(css).toContain("var(--neu-primary)");
    expect(css).toContain("var(--neu-primary-dark)");
    expect(css).not.toContain("var(--dummy)");
  });

  it("adds a purple token ring to group checkboxes and the pinned group badge", () => {
    const css = readFileListGlassCss().replace(/\s+/g, " ");
    const groupUncheckedRule = extractLastRule(
      readFileListGlassCss(),
      ".neuromorphic-style .fileListGlassScope .fileListGroupSelectCheckboxUnchecked",
    );

    expect(css).toContain(".fileListGroupSelectCheckboxUnchecked");
    expect(css).toContain("0 0 0 0.08em color-mix(in srgb, var(--neu-primary)");
    expect(groupUncheckedRule).not.toContain("var(--selection-check-unselected-border)");
    expect(css).toContain(".fileListPinnedGroupIconBadge");
    expect(css).toContain(".fileListPinnedGroupIcon");
    expect(css).toContain("color: var(--neu-primary)");
    expect(css).toContain("border: 0.08em solid color-mix(in srgb, var(--neu-primary)");
    expect(css).toContain(".fileListPinnedGroupIconBadge { background: var(--neu-inset-bg); border:");
    expect(css).toContain(".fileListPinnedGroupIcon { display: block; color: var(--neu-primary); stroke: currentColor; stroke-width: 2.2; filter: none;");
    expect(css).not.toContain("drop-shadow(0 0 0.28em color-mix(in srgb, var(--neu-primary)");
    expect(css).not.toContain(".fileListAllFilesCheckboxUnchecked { box-shadow: inset 0.28em 0.28em 0.68em color-mix(in srgb, var(--neu-shadow-dark) 88%, transparent), inset -0.28em -0.28em 0.68em color-mix(in srgb, var(--neu-shadow-light) 56%, transparent), inset 0 0 0 0.08em var(--selection-check-unselected-border), 0 0 0 0.08em color-mix(in srgb, var(--neu-primary)");
  });
});
