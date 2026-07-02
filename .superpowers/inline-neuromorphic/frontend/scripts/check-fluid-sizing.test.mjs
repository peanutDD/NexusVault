import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = path.resolve("scripts/check-fluid-sizing.mjs");
const tempRoots = [];

function makeFixture(files) {
  const root = mkdtempSync(path.join(tmpdir(), "fluid-sizing-"));
  tempRoots.push(root);
  for (const [filePath, content] of Object.entries(files)) {
    const absolutePath = path.join(root, filePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content);
  }
  return root;
}

function runCheck(root, args = []) {
  return spawnSync(process.execPath, [scriptPath, `--root=${root}`, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("fluid sizing governance", () => {
  it("rejects user-visible fixed px dimensions in enforced frontend scopes", () => {
    const root = makeFixture({
      "src/styles/tokens.css": ".panel { width: 320px; border-radius: 18px; }",
    });

    const result = runCheck(root);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("Found fixed px dimensions");
    expect(result.stdout).toContain("src/styles/tokens.css");
    expect(result.stdout).toContain("320px");
    expect(result.stdout).toContain("18px");
  });

  it("allows non-scaling pixel exceptions with explicit inline reasons", () => {
    const root = makeFixture({
      "src/styles/tokens.css": [
        ".edge { border: 1px solid currentColor; } /* fluid-sizing-allow: hairline */",
        ".pill { border-radius: 999px; } /* fluid-sizing-allow: pill */",
      ].join("\n"),
    });

    const result = runCheck(root);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("OK");
  });

  it("rejects signed fixed px dimensions", () => {
    const root = makeFixture({
      "src/styles/tokens.css": ".button { transform: translateY(-4px); }",
    });

    const result = runCheck(root);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("-4px");
  });

  it("can enforce only the file list and grid scope", () => {
    const root = makeFixture({
      "src/components/common/feedback/Notice.tsx": "export const width = '320px';",
      "src/components/files/list/FileListGlass.css": ".list { box-shadow: 0 12px 30px black; }",
      "src/components/files/grid/FileCard.tsx": "export const offset = '7px';",
    });

    const result = runCheck(root, ["--scope=filelist"]);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("src/components/files/list/FileListGlass.css");
    expect(result.stdout).toContain("src/components/files/grid/FileCard.tsx");
    expect(result.stdout).not.toContain("src/components/common/feedback/Notice.tsx");
  });

  it("can enforce only the preview scope", () => {
    const root = makeFixture({
      "src/components/files/preview/FilePreviewStage.tsx":
        "export const radius = '26px';",
      "src/styles/preview.css": ".preview { box-shadow: 0 12px 26px black; }",
      "src/components/files/list/FileListGlass.css": ".list { width: 320px; }",
    });

    const result = runCheck(root, ["--scope=preview"]);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("src/components/files/preview/FilePreviewStage.tsx");
    expect(result.stdout).toContain("src/styles/preview.css");
    expect(result.stdout).not.toContain("src/components/files/list/FileListGlass.css");
  });

  it("can enforce only the dialogs scope", () => {
    const root = makeFixture({
      "src/components/files/dialogs/CreateFolderDialog.css":
        ".dialog { box-shadow: 0 36px 90px black; }",
      "src/styles/confirm-dialog.css": ".confirm { background-size: 44px 44px; }",
      "src/components/files/preview/FilePreviewStage.tsx":
        "export const radius = '26px';",
    });

    const result = runCheck(root, ["--scope=dialogs"]);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("src/components/files/dialogs/CreateFolderDialog.css");
    expect(result.stdout).toContain("src/styles/confirm-dialog.css");
    expect(result.stdout).not.toContain("src/components/files/preview/FilePreviewStage.tsx");
  });

  it("can enforce the remaining global frontend scope", () => {
    const root = makeFixture({
      "src/styles/tokens.css": ":root { --surface-shadow: 0 18px 70px black; }",
      "src/styles/cta.css": ".cta { box-shadow: 0 14px 40px black; }",
      "src/providers/QueryProvider.tsx": "export const panel = 'min-h-[360px]';",
      "src/components/files/preview/FilePreviewStage.tsx":
        "export const radius = '26px';",
    });

    const result = runCheck(root, ["--scope=global"]);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("src/styles/tokens.css");
    expect(result.stdout).toContain("src/styles/cta.css");
    expect(result.stdout).toContain("src/providers/QueryProvider.tsx");
    expect(result.stdout).not.toContain("src/components/files/preview/FilePreviewStage.tsx");
  });

  it("rejects user-visible fixed Tailwind visual scale utilities", () => {
    const root = makeFixture({
      "src/components/common/Surface.tsx": [
        'export function Surface() {',
        '  return <div className="p-4 h-10 max-w-md text-sm rounded-lg gap-3" />;',
        '}',
      ].join("\n"),
    });

    const result = runCheck(root, ["--scope=tailwind-visual"]);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("Found fixed Tailwind visual scale utilities");
    expect(result.stdout).toContain("src/components/common/Surface.tsx");
    expect(result.stdout).toContain("p-4");
    expect(result.stdout).toContain("h-10");
    expect(result.stdout).toContain("max-w-md");
    expect(result.stdout).toContain("text-sm");
    expect(result.stdout).toContain("rounded-lg");
    expect(result.stdout).toContain("gap-3");
  });

  it("allows non-visual Tailwind numeric utilities in tailwind visual scope", () => {
    const root = makeFixture({
      "src/components/common/Surface.tsx": [
        'export function Surface() {',
        '  return <div className="z-50 opacity-80 grid grid-cols-3 font-bold leading-none tracking-wide duration-200 scale-75 flex-1 shrink-0 left-1/2 -translate-x-1/2" />;',
        '}',
      ].join("\n"),
    });

    const result = runCheck(root, ["--scope=tailwind-visual"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("OK");
  });

  it("allows explicit Tailwind visual exceptions with inline reasons", () => {
    const root = makeFixture({
      "src/components/common/Surface.tsx":
        'export const surface = "p-4 h-10"; // fluid-sizing-allow: legacy third-party embed',
    });

    const result = runCheck(root, ["--scope=tailwind-visual"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("OK");
  });

  it("does not treat CSS custom property names or SVG path data as Tailwind utilities", () => {
    const root = makeFixture({
      "src/styles/tokens.css": [
        ":root {",
        "  --settings-text-sm: clamp(0.75rem, 2vw, 0.875rem);",
        "  --preview-glow-lg: clamp(1rem, 3vw, 1.5rem);",
        "}",
      ].join("\n"),
      "src/components/common/Icon.tsx":
        '<path d="M12 9v2m0 4h.01m-6.938 4h13.856" />',
    });

    const result = runCheck(root, ["--scope=tailwind-visual"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("OK");
  });

  it("can enforce only the shell and common Tailwind visual scope", () => {
    const root = makeFixture({
      "src/components/common/EmptyState.tsx": '<div className="p-4" />',
      "src/components/layout/PageLayout.tsx": '<div className="gap-3" />',
      "src/router/AppRouter.tsx": '<div className="text-sm" />',
      "src/pages/Trash.tsx": '<div className="p-4" />',
    });

    const result = runCheck(root, ["--scope=tailwind-shell-common"]);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("src/components/common/EmptyState.tsx");
    expect(result.stdout).toContain("src/components/layout/PageLayout.tsx");
    expect(result.stdout).toContain("src/router/AppRouter.tsx");
    expect(result.stdout).not.toContain("src/pages/Trash.tsx");
  });

  it("can enforce only the file list and Trash Tailwind visual scope", () => {
    const root = makeFixture({
      "src/components/files/grid/FileCard.tsx": '<div className="p-3" />',
      "src/components/files/list/FileListHeader.tsx": '<div className="gap-2" />',
      "src/pages/Trash.tsx": '<div className="h-3 w-3" />',
      "src/pages/Settings.tsx": '<div className="p-4" />',
    });

    const result = runCheck(root, ["--scope=tailwind-filelist-trash"]);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("src/components/files/grid/FileCard.tsx");
    expect(result.stdout).toContain("src/components/files/list/FileListHeader.tsx");
    expect(result.stdout).toContain("src/pages/Trash.tsx");
    expect(result.stdout).not.toContain("src/pages/Settings.tsx");
  });
});
