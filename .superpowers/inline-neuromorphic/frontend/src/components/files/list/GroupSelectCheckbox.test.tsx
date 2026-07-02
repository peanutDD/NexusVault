import { render, screen } from "@testing-library/react";
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it, vi } from "vitest";

import { GroupSelectCheckbox, GroupSelectCheckboxMixed } from "./GroupSelectCheckbox";

function readFileListGlassCss() {
  return readFileSync(resolve(__dirname, "FileListGlass.css"), "utf8");
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

  it("keeps mixed group state out of the checked fill rule", () => {
    const css = readFileListGlassCss();
    const checkedFillRule = css.match(
      /(?:\.filelist-check-control-checked|\.fileListAllFilesCheckboxSelected|\.fileListGroupSelectCheckboxSelected|\.fileListGroupSelectCheckboxMixed|[\s,])+\{[^}]*--filelist-check-bg-checked[^}]*\}/,
    )?.[0] ?? "";

    expect(checkedFillRule).toContain(".fileListGroupSelectCheckboxSelected");
    expect(checkedFillRule).not.toContain(".fileListGroupSelectCheckboxMixed");
  });

  it("keeps the group checkbox on the shared fluid checkbox primitive", () => {
    const css = readFileListGlassCss();
    const source = readFileSync(resolve(__dirname, "GroupSelectCheckbox.tsx"), "utf8");

    expect(source).toContain("filelist-check-control fileListGroupSelectCheckbox");
    expect(css).toContain(".filelist-check-control");
    expect(css).toContain("width: clamp(");
    expect(css).toContain("height: clamp(");
    expect(css).toContain("border-radius: clamp(");
    expect(css).toContain("background: var(--filelist-check-bg)");
    expect(css).toContain("box-shadow: var(--filelist-check-shadow)");
    expect(css).toContain("var(--filelist-check-bg-checked)");
    expect(css).toContain("box-shadow: var(--neu-pressed-shadow)");
    expect(css).not.toContain("var(--dummy)");
  });

  it("uses the same pressed and inset primitive states for group checkboxes", () => {
    const css = readFileListGlassCss().replace(/\s+/g, " ");

    expect(css).toContain(".filelist-check-control-checked");
    expect(css).toContain(".filelist-check-control-unchecked");
    expect(css).toContain(".fileListGroupSelectCheckboxUnchecked");
    expect(css).toContain(".fileListGroupSelectCheckboxSelected");
    expect(css).toContain(".fileListGroupSelectCheckboxMixed");
    expect(css).not.toContain("selection-check-unselected");
    expect(css).not.toContain("drop-shadow(");
  });

  it("routes checkbox fills and glyph colors through theme tokens for light contrast", () => {
    const css = readFileListGlassCss().replace(/\s+/g, " ");

    expect(css).toContain("background: var(--filelist-check-bg)");
    expect(css).toContain("background: var(--filelist-check-bg-checked)");
    expect(css).toContain("box-shadow: var(--filelist-check-shadow)");
    expect(css).toContain("box-shadow: var(--filelist-check-shadow-checked)");
    expect(css).toContain("color: var(--filelist-check-text-checked)");
    expect(css).not.toContain("color: white");
  });
});
