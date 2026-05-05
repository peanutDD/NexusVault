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
});
