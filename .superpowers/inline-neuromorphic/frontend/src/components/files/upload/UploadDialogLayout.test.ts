import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  "src/components/files/upload/UploadDialog.css",
  "utf8",
);
const dialogSource = readFileSync(
  "src/components/files/upload/UploadDialog.tsx",
  "utf8",
);
const dropzoneSource = readFileSync(
  "src/components/files/upload/UploadDropzone.tsx",
  "utf8",
);
const urlUploadSource = readFileSync(
  "src/components/files/upload/UrlUploadForm.tsx",
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
  it("keeps the upload window below the fixed top navigation", () => {
    const backdrop = compact(ruleBody(".uploadDialogNeuBackdrop"));
    const surface = compact(ruleBody(".uploadDialogNeuSurface"));

    expect(dialogSource).toContain(
      "top-[calc(clamp(4.75rem,7.6vw,6.25rem)+env(safe-area-inset-top))]",
    );
    expect(dialogSource).toContain("fixed inset-x-0 bottom-0");
    expect(dialogSource).not.toContain("fixed inset-0");

    expect(backdrop).toContain("--upload-dialog-viewport-gap");
    expect(backdrop).toContain(
      "--upload-dialog-nav-offset: calc(clamp(4.75rem, 7.6vw, 6.25rem) + env(safe-area-inset-top))",
    );
    expect(backdrop).toContain("height: auto");
    expect(backdrop).toContain("box-sizing: border-box");
    expect(backdrop).toContain("padding-top: var(--upload-dialog-viewport-gap)");
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
      "max-height: calc(100dvh - var(--upload-dialog-nav-offset) - var(--upload-dialog-vertical-gap))",
    );
    expect(surface).toContain(
      "max-width: min(42rem, calc(100dvw - var(--upload-dialog-horizontal-gap)))",
    );
  });
});

describe("UploadDialog primitive contract", () => {
  it("keeps semantic hooks while using the global neuromorphic primitives", () => {
    expect(dialogSource).toContain("data-ready-to-upload={hasFiles}");
    expect(dialogSource).toContain("uploadDialogCancelBtn");
    expect(dialogSource).toContain("uploadDialogAttachBtn");
    expect(dialogSource).toContain("uploadDialogNeuBackdrop");
    expect(dialogSource).toContain("uploadDialogNeuSurface");
    expect(dialogSource).toContain("neu-raised");
    expect(dialogSource).toContain("neu-raised-sm");
    expect(dropzoneSource).toContain("uploadDialogSelectFilesBtn");
    expect(dropzoneSource).toContain("uploadDialogNeuDropzone");
    expect(dropzoneSource).toContain("neu-inset");
    expect(urlUploadSource).toContain("uploadDialogUrlUploadBtn");
    expect(urlUploadSource).toContain("uploadDialogNeuInput");
    expect(urlUploadSource).toContain("uploadUrlControls");
    expect(urlUploadSource).toContain("uploadUrlInput");
  });

  it("maps upload surfaces and controls to pure raised, inset, and pressed primitives", () => {
    const compactCss = compact(css);

    expect(compactCss).toContain(".uploadDialogNeuSurface");
    expect(compactCss).toContain("background: var(--neu-raised-bg)");
    expect(compactCss).toContain("box-shadow: var(--neu-raised-shadow)");
    expect(compactCss).toContain(".uploadDialogNeuDropzone");
    expect(compactCss).toContain("background: var(--neu-inset-bg)");
    expect(compactCss).toContain("box-shadow: var(--neu-inset-shadow)");
    expect(compactCss).toContain(".uploadDialogNeuDropzoneActive");
    expect(compactCss).toContain("box-shadow: var(--neu-pressed-shadow)");
    expect(compactCss).toContain(".uploadDropzoneCore");
    expect(compactCss).toContain("box-shadow: var(--neu-raised-sm-shadow)");
    expect(compactCss).toContain(".uploadStatRow");
    expect(compactCss).toContain("color: var(--neu-primary)");
  });

  it("routes the upload backdrop through a light-overridable theme variable", () => {
    const backdrop = compact(ruleBody(".uploadDialogNeuBackdrop"));

    expect(backdrop).toContain(
      "background: var(--upload-dialog-backdrop-bg, rgba(0, 0, 0, 0.4))",
    );
  });

  it("does not keep removed theme-specific or decorative upload treatments", () => {
    const combined = [css, dialogSource, dropzoneSource, urlUploadSource].join("\n");

    expect(combined).not.toMatch(/uploadDialogCyber/);
    expect(combined).not.toMatch(/linear-gradient|radial-gradient|backdrop-filter|backdrop-blur/);
    expect(combined).not.toContain('[data-theme="purple"]');
    expect(combined).not.toContain("glass-");
  });

  it("keeps the URL input reachable on mobile touch layouts", () => {
    const compactCss = compact(css);

    expect(compactCss).toContain(".uploadUrlControls");
    expect(compactCss).toContain(".uploadUrlInput");
    expect(compactCss).toContain("z-index: 2");
    expect(compactCss).toContain("caret-color: var(--upload-accent)");
    expect(compactCss).toContain("cursor: text");
    expect(compactCss).toContain("user-select: text");
    expect(compactCss).toContain("@media (max-width: 40rem)");
    expect(compactCss).toContain(".uploadUrlControls { flex-direction: column");
    expect(compactCss).toContain(".uploadUrlInput, .uploadDialogUrlUploadBtn { width: 100%");
    expect(compactCss).toContain("@media (hover: none) and (pointer: coarse)");
    expect(compactCss).toContain("font-size: max(1rem, clamp(0.75rem, 1.8vw, 0.875rem))");
    expect(compactCss).toContain("pointer-events: auto");
  });
});
