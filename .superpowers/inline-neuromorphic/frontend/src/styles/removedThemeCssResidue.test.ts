import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../../");

const cssFiles = [
  "src/styles/base.css",
  "src/styles/confirm-dialog.css",
  "src/styles/hljs.css",
  "src/styles/nav.css",
  "src/styles/platform.css",
  "src/styles/preview.css",
  "src/styles/tokens.css",
  "src/components/files/list/FileListFilters.css",
  "src/components/files/list/FileListGlass.css",
  "src/components/files/upload/UploadDialog.css",
  "src/components/files/upload/UploadFileItem.css",
];

const sourceFilesWithThemeHooks = [
  ...cssFiles,
  "src/components/files/preview/FilePreview.tsx",
  "src/components/common/dialog/ConfirmDialog.tsx",
];

function readProjectFile(path: string) {
  return readFileSync(resolve(ROOT, path), "utf8");
}

describe("removed theme CSS residue", () => {
  it("does not keep selectors for removed theme identities", () => {
    for (const file of cssFiles) {
      const css = readProjectFile(file);

      expect(css, file).not.toMatch(
        /\[data-theme="(?:purple|terminal|portfolio|neuromorphic)"\]/,
      );
      expect(css, file).not.toMatch(
        /(^|[^-\w.])\.(?:purple|terminal|portfolio|neuromorphic)(?![-\w])/,
      );
    }
  });

  it("does not keep portfolio or terminal-only animation layers", () => {
    const css = readProjectFile("src/styles/tokens.css");

    expect(css).not.toContain("--portfolio-");
    expect(css).not.toContain("--terminal-");
    expect(css).not.toContain("portfolio-glow-pulse");
    expect(css).not.toContain("portfolio-grid-drift");
    expect(css).not.toContain("terminal-scanline");
  });

  it("removes unused liquid dialog CSS and misleading legacy shell class names", () => {
    expect(
      existsSync(resolve(ROOT, "src/components/files/dialogs/CreateFolderDialog.css")),
    ).toBe(false);

    for (const file of sourceFilesWithThemeHooks) {
      const source = readProjectFile(file);

      expect(source, file).not.toContain("preview-cyberpunk-root");
      expect(source, file).not.toContain("confirm-dialog-sci-fi");
      expect(source, file).not.toContain("confirm-danger-sci-fi");
      expect(source, file).not.toContain("dialog-liquid");
    }
  });
});
