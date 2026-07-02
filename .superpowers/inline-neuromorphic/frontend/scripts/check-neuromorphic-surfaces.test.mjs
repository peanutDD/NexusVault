import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = path.resolve("scripts/check-neuromorphic-surfaces.mjs");
const tempRoots = [];

function makeFixture(files) {
  const root = mkdtempSync(path.join(tmpdir(), "neuromorphic-surfaces-"));
  tempRoots.push(root);
  for (const [filePath, content] of Object.entries(files)) {
    const absolutePath = path.join(root, filePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content);
  }
  return root;
}

function runCheck(root) {
  return spawnSync(process.execPath, [scriptPath, `--root=${root}`], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("neuromorphic surface residue scanner", () => {
  it("rejects active surface gradients and legacy glass classes", () => {
    const root = makeFixture({
      "src/pages/Files.tsx": '<section className="bg-gradient-to-br glass-panel" />',
    });

    const result = runCheck(root);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("surface-gradient");
    expect(result.stdout).toContain("legacy-depth-system");
    expect(result.stdout).toContain("src/pages/Files.tsx");
  });

  it("rejects visible border sources on active CSS surfaces", () => {
    const root = makeFixture({
      "src/styles/base.css": ".panel { border-color: rgba(255, 255, 255, 0.2); }",
    });

    const result = runCheck(root);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("visible-surface-border");
    expect(result.stdout).toContain("border-color");
  });

  it("rejects background-image variable indirection outside tokens", () => {
    const root = makeFixture({
      "src/components/common/Card.tsx": '<div className="[background:var(--old-panel-bg)]" />',
      "src/styles/base.css": ".panel { background-image: var(--old-panel-bg); }",
    });

    const result = runCheck(root);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("legacy-background-utility");
    expect(result.stdout).toContain("indirect-background-image");
  });

  it("allows token definitions and clean primitive use in active files", () => {
    const root = makeFixture({
      "src/styles/tokens.css": ":root { --legacy-panel-bg: linear-gradient(red, blue); }",
      "src/pages/Settings.tsx": '<section className="neu-raised border-0" />',
      "src/styles/base.css":
        ".panel { background: var(--neu-raised-bg); background-image: none; border-color: transparent; box-shadow: var(--neu-raised-shadow); }",
    });

    const result = runCheck(root);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("OK: all active Neuromorphic surfaces use global primitives.");
  });
});
