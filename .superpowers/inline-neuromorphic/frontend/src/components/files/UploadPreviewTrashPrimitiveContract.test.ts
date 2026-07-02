import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");

const activeSurfaceFiles = [
  "components/files/upload/UploadDialog.tsx",
  "components/files/upload/UploadDialog.css",
  "components/files/upload/UploadDropzone.tsx",
  "components/files/upload/UploadFileItem.tsx",
  "components/files/upload/UploadFileItem.css",
  "components/files/upload/UploadProgressList.tsx",
  "components/files/preview/FilePreview.tsx",
  "components/files/preview/FilePreviewToolbar.tsx",
  "components/files/preview/FilePreviewTextPanel.tsx",
  "components/files/preview/MobilePdfPreview.tsx",
  "pages/Trash.tsx",
];

function read(path: string) {
  return readFileSync(resolve(root, path), "utf8");
}

describe("upload, preview, and trash neuromorphic primitive contract", () => {
  it("uses shared primitives instead of decorative glass, tech, gradients, and blur layers", () => {
    const combined = activeSurfaceFiles.map(read).join("\n");

    expect(combined).toContain("neu-raised");
    expect(combined).toContain("neu-inset");
    expect(combined).not.toMatch(/(?:linear|radial|repeating-linear)-gradient/);
    expect(combined).not.toContain("backdrop-filter");
    expect(combined).not.toContain("-webkit-backdrop-filter");
    expect(combined).not.toMatch(/\bglass-(?:panel|card|chip|btn)\b/);
    expect(combined).not.toMatch(/\b(?:cyber|tech|scanline|static-scanlines)\b/i);
  });
});
