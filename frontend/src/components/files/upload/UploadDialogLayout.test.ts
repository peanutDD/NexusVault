import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  "src/components/files/upload/UploadDialog.css",
  "utf8",
);

function ruleBody(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`));
  return match?.[1] ?? "";
}

function compact(cssRule: string) {
  return cssRule.replace(/\s+/g, " ").trim();
}

describe("UploadDialog mobile layout", () => {
  it("keeps a safe dynamic-viewport gap around the upload window on mobile browsers", () => {
    const backdrop = compact(ruleBody(".uploadDialogCyberBackdrop"));
    const surface = compact(ruleBody(".uploadDialogCyberSurface"));

    expect(backdrop).toContain("--upload-dialog-viewport-gap");
    expect(backdrop).toContain("--upload-dialog-grid-step: clamp(");
    expect(backdrop).toContain("--upload-dialog-backdrop-blur: clamp(");
    expect(backdrop).toContain("height: 100dvh");
    expect(backdrop).toContain("box-sizing: border-box");
    expect(backdrop).toContain(
      "backdrop-filter: blur(var(--upload-dialog-backdrop-blur)) saturate(1.24)",
    );
    expect(backdrop).toContain(
      "padding-top: calc(var(--upload-dialog-viewport-gap) + env(safe-area-inset-top))",
    );
    expect(backdrop).toContain(
      "padding-right: calc(var(--upload-dialog-viewport-gap) + env(safe-area-inset-right))",
    );
    expect(backdrop).toContain(
      "padding-bottom: calc(var(--upload-dialog-viewport-gap) + env(safe-area-inset-bottom))",
    );
    expect(backdrop).toContain(
      "padding-left: calc(var(--upload-dialog-viewport-gap) + env(safe-area-inset-left))",
    );
    expect(surface).toContain(
      "max-height: calc(100dvh - var(--upload-dialog-vertical-gap))",
    );
    expect(surface).toContain(
      "max-width: min(42rem, calc(100dvw - var(--upload-dialog-horizontal-gap)))",
    );
  });
});
