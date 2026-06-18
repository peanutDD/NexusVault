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
const tokensCss = readFileSync("src/styles/tokens.css", "utf8");

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
    const backdrop = compact(ruleBody(".uploadDialogCyberBackdrop"));
    const surface = compact(ruleBody(".uploadDialogCyberSurface"));

    expect(dialogSource).toContain(
      "top-[calc(clamp(4.75rem,7.6vw,6.25rem)+env(safe-area-inset-top))]",
    );
    expect(dialogSource).toContain("fixed inset-x-0 bottom-0");
    expect(dialogSource).not.toContain("fixed inset-0");

    expect(backdrop).toContain("--upload-dialog-viewport-gap");
    expect(backdrop).toContain(
      "--upload-dialog-nav-offset: calc(clamp(4.75rem, 7.6vw, 6.25rem) + env(safe-area-inset-top))",
    );
    expect(backdrop).toContain("--upload-dialog-grid-step: clamp(");
    expect(backdrop).toContain("--upload-dialog-backdrop-blur: clamp(");
    expect(backdrop).toContain("height: auto");
    expect(backdrop).toContain("box-sizing: border-box");
    expect(backdrop).toContain(
      "backdrop-filter: blur(var(--upload-dialog-backdrop-blur)) saturate(1.24)",
    );
    expect(backdrop).toContain(
      "padding-top: var(--upload-dialog-viewport-gap)",
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
      "max-height: calc(100dvh - var(--upload-dialog-nav-offset) - var(--upload-dialog-vertical-gap))",
    );
    expect(surface).toContain(
      "max-width: min(42rem, calc(100dvw - var(--upload-dialog-horizontal-gap)))",
    );
  });
});

describe("UploadDialog removed theme cleanup", () => {
  it("does not keep the removed purple ready-state button overrides", () => {
    expect(dialogSource).toContain("data-ready-to-upload={hasFiles}");

    const compactCss = compact(css);

    expect(compactCss).not.toContain(
      '[data-theme="purple"] .uploadDialogCyberFooter[data-ready-to-upload="true"] .uploadDialogCyberPrimaryBtn:not(:disabled):hover',
    );
    expect(compactCss).not.toContain(
      ".purple .uploadDialogCyberFooter[data-ready-to-upload=\"true\"] .uploadDialogCyberPrimaryBtn:not(:disabled):hover",
    );
    expect(compactCss).not.toContain(
      '[data-theme="purple"] .uploadDialogCyberFooter[data-ready-to-upload="true"] .uploadDialogCyberSecondaryBtn:not(:disabled):hover',
    );
  });
});

describe("UploadDialog empty-state button palette", () => {
  it("gives cancel, attach, select files, and URL upload their own semantic classes", () => {
    expect(dialogSource).toContain("uploadDialogCancelBtn");
    expect(dialogSource).toContain("uploadDialogAttachBtn");
    expect(dropzoneSource).toContain("uploadDialogSelectFilesBtn");
    expect(urlUploadSource).toContain("uploadDialogUrlUploadBtn");
    expect(urlUploadSource).toContain("uploadUrlControls");
    expect(urlUploadSource).toContain("uploadUrlInput");
  });

  it("defines dark, light, and purple palettes for the empty upload state", () => {
    const compactCss = compact(css);

    [
      "--upload-empty-cancel-bg",
      "--upload-empty-cancel-border",
      "--upload-empty-attach-bg",
      "--upload-empty-attach-border",
      "--upload-select-files-bg",
      "--upload-select-files-border",
      "--upload-url-upload-bg",
      "--upload-url-upload-border",
    ].forEach((token) => {
      expect(compactCss).toContain(token);
    });

    expect(compactCss).toContain(
      '.uploadDialogCyberFooter[data-ready-to-upload="false"] .uploadDialogCancelBtn',
    );
    expect(compactCss).toContain(
      '.uploadDialogCyberFooter[data-ready-to-upload="false"] .uploadDialogAttachBtn:disabled',
    );
    expect(compactCss).toContain(".uploadDialogSelectFilesBtn");
    expect(compactCss).toContain(".uploadDialogUrlUploadBtn");

    expect(compactCss).toContain('[data-theme="light"] .uploadDialogCyberSurface');
    expect(compactCss).toContain(':root.light.neuromorphic-style .uploadDialogCyberSurface');
    expect(compactCss).toContain(':root.dark.neuromorphic-style .uploadDialogCyberSurface');
    expect(compactCss).not.toContain('[data-theme="purple"] .uploadDialogCyberSurface');
    expect(compactCss).not.toContain('[data-theme="neuromorphic"] .uploadDialogCyberSurface');

    [
      "--rgb-emerald-500",
      "--rgb-malachite-500",
      "--rgb-cyan-400",
      "--rgb-purple-500",
      "--rgb-fuchsia-500",
      "--rgb-slate-950",
      "--rgb-white",
    ].forEach((token) => {
      expect(tokensCss).toContain(token);
    });
  });

  it("maps the Neuromorphic upload shell to CodePen raised and inset surfaces", () => {
    const compactCss = compact(css);

    expect(compactCss).toContain(".neuromorphic-style .uploadDialogCyberBackdrop");
    expect(compactCss).toContain("--upload-tech-shadow: var(--neu-raised-shadow)");
    expect(compactCss).toContain("--upload-tech-panel: var(--neu-inset-bg)");
    expect(compactCss).toContain("--upload-select-files-bg: linear-gradient(145deg, var(--neu-primary), var(--neu-primary-dark))");
    expect(compactCss).toContain("--upload-empty-cancel-shadow: var(--neu-raised-sm-shadow)");
  });

  it("removes cyber layers and applies CodePen upload raised/inset controls in neuromorphic", () => {
    const compactCss = compact(css);

    expect(compactCss).toContain(
      '.neuromorphic-style .uploadDialogCyberSurface::before',
    );
    expect(compactCss).toContain(
      '.neuromorphic-style .uploadDialogCyberSurface::after',
    );
    expect(compactCss).toContain(
      '.neuromorphic-style .uploadDialogCyberDropzone::before',
    );
    expect(compactCss).toContain("display: none");
    expect(compactCss).toContain("background: var(--neu-raised-bg)");
    expect(compactCss).toContain("box-shadow: var(--neu-raised-shadow)");
    expect(compactCss).toContain("background: var(--neu-inset-bg)");
    expect(compactCss).toContain("box-shadow: var(--neu-inset-shadow)");
    expect(compactCss).toContain("border: 0.125rem dashed rgba(var(--rgb-slate-500), 0.72)");
    expect(compactCss).toContain(
      '.neuromorphic-style .uploadDropzoneCore',
    );
    expect(compactCss).toContain(
      '.neuromorphic-style .uploadDialogCyberInput',
    );
    expect(compactCss).toContain('.neuromorphic-style .uploadUrlPanel');
    expect(compactCss).toContain(
      '.neuromorphic-style .uploadDialogCyberPrimaryBtn',
    );
  });

  it("keeps a visible neuromorphic modal backdrop behind the upload dialog", () => {
    const compactCss = compact(css);

    expect(compactCss).toContain(
      '.neuromorphic-style .uploadDialogCyberBackdrop',
    );
    expect(compactCss).toContain("background: var(--upload-backdrop)");
    expect(compactCss).toContain(
      "backdrop-filter: blur(var(--upload-dialog-backdrop-blur)) saturate(1.05)",
    );
  });

  it("keeps light and dark upload neuromorphic overrides independent", () => {
    const compactCss = compact(css);

    expect(compactCss).toContain(":root.light.neuromorphic-style .uploadDialogCyberSurface");
    expect(compactCss).toContain(":root.dark.neuromorphic-style .uploadDialogCyberSurface");
    expect(compactCss).toContain(":root.light.neuromorphic-style .uploadDialogCyberBackdrop");
    expect(compactCss).toContain(":root.dark.neuromorphic-style .uploadDialogCyberBackdrop");
    expect(compactCss).toContain("--upload-empty-cancel-text: rgba(var(--rgb-slate-700), 0.9)");
    expect(compactCss).toContain("--upload-empty-cancel-text: rgba(var(--rgb-white), 0.9)");
    expect(compactCss).toContain("--upload-url-upload-text: rgba(var(--rgb-slate-700), 0.9)");
    expect(compactCss).toContain("--upload-url-upload-text: rgba(var(--rgb-white), 0.9)");
  });

  it("keeps the URL input reachable on mobile touch layouts", () => {
    const compactCss = compact(css);

    expect(compactCss).toContain(".uploadUrlControls");
    expect(compactCss).toContain(".uploadUrlInput");
    expect(compactCss).toContain("z-index: 2");
    expect(compactCss).toContain("caret-color: var(--upload-accent)");
    expect(compactCss).toContain("cursor: text");
    expect(compactCss).toContain("user-select: text");
    expect(compactCss).toContain("@media (max-width: 640px)");
    expect(compactCss).toContain(".uploadUrlControls { flex-direction: column");
    expect(compactCss).toContain(".uploadUrlInput, .uploadDialogUrlUploadBtn { width: 100%");
    expect(compactCss).toContain("@media (hover: none) and (pointer: coarse)");
    expect(compactCss).toContain("font-size: max(1rem, clamp(0.75rem, 1.8vw, 0.875rem))");
    expect(compactCss).toContain("pointer-events: auto");
  });

  it("keeps the light select-files action clean and luminous", () => {
    const compactCss = compact(css);

    expect(compactCss).toContain("rgba(var(--rgb-white), 0.94)");
    expect(compactCss).toContain("rgba(var(--rgb-cyan-400), 0.28)");
    expect(compactCss).toContain("--upload-select-files-text: rgba(var(--rgb-slate-900), 0.92)");
    expect(compactCss).not.toContain(
      "--upload-select-files-bg: linear-gradient( 135deg, rgba(var(--rgb-slate-950), 0.94), rgba(var(--rgb-emerald-500), 0.78) )",
    );
  });
});
