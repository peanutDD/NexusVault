import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = path.resolve("scripts/check-hardcoding.mjs");
const tempRoots = [];

function makeFixture(files) {
  const root = mkdtempSync(path.join(tmpdir(), "hardcoding-"));
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

describe("hardcoding governance", () => {
  it("rejects deploy URL fallbacks outside explicit env exceptions", () => {
    const root = makeFixture({
      "src/pages/Share.tsx":
        'window.location.href = `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"}/api/download`;',
    });

    const result = runCheck(root);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("deploy-url");
    expect(result.stdout).toContain("src/pages/Share.tsx");
    expect(result.stdout).toContain("http://localhost:3000");
  });

  it("rejects raw Tailwind theme palette classes in runtime TSX", () => {
    const root = makeFixture({
      "src/components/common/Notice.tsx":
        '<div className="bg-gray-900 text-white hover:bg-purple-700" />',
    });

    const result = runCheck(root);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("raw-theme-color");
    expect(result.stdout).toContain("bg-gray-900");
    expect(result.stdout).toContain("text-white");
    expect(result.stdout).toContain("hover:bg-purple-700");
  });

  it("rejects inline TSX color functions that bypass semantic tokens", () => {
    const root = makeFixture({
      "src/components/common/Notice.tsx":
        '<div style={{ backgroundColor: "rgba(0,0,0,0.4)" }} />',
    });

    const result = runCheck(root);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("inline-color-function");
    expect(result.stdout).toContain("rgba(");
  });

  it("rejects unnamed timing literals in timeout calls", () => {
    const root = makeFixture({
      "src/hooks/useNotice.ts": "setTimeout(() => clear(), 3000);",
    });

    const result = runCheck(root);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("magic-timing");
    expect(result.stdout).toContain("setTimeout");
  });

  it("allows documented local dev URL, SVG namespace, examples, and CSS token color sources", () => {
    const root = makeFixture({
      "src/config/env.ts":
        "export const LOCAL_DEV_API_ORIGIN = 'http://localhost:3000'; // hardcoding-allow: local dev fallback",
      "src/components/common/Icon.tsx":
        '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0" /></svg>',
      "src/components/files/upload/UrlUploadForm.tsx":
        'const placeholder = "https://example.com/file.jpg";',
      "src/styles/tokens.css": ":root { --panel-bg: rgba(0, 0, 0, 0.5); }",
    });

    const result = runCheck(root);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("OK");
  });
});
