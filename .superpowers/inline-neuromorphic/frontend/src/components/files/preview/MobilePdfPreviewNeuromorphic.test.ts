import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("MobilePdfPreview neuromorphic controls", () => {
  it("uses raised primitives for PDF toolbar buttons", () => {
    const source = readFileSync(resolve(__dirname, "MobilePdfPreview.tsx"), "utf8");

    expect(source).toContain("mobilePdfToolbar");
    expect(source).toContain("neu-raised mobilePdfToolbar");
    expect(source).toContain("mobilePdfToolbarButton");
    expect(source).toContain("neu-raised-sm mobilePdfToolbarButton");
    expect(source).toContain("active:shadow-[var(--neu-pressed-shadow)]");
    expect(source).not.toContain("[background:var(--preview-pdf-toolbar-bg)]");
    expect(source).not.toContain("[background:var(--preview-pdf-btn-bg)]");
    expect(source).not.toContain("active:[background:var(--preview-pdf-btn-active-bg)]");
    expect(source).not.toContain("hover:[background:var(--preview-pdf-btn-hover-bg)]");
    expect(source).not.toContain("bg-[var(--preview-pdf-btn-bg)]");
    expect(source).not.toContain("hover:bg-[var(--preview-pdf-btn-hover-bg)]");
  });

  it("rerenders the current page when the preview container resizes", () => {
    const source = readFileSync(resolve(__dirname, "MobilePdfPreview.tsx"), "utf8");

    expect(source).toContain("ResizeObserver");
    expect(source).toContain("stageResizeTick");
    expect(source).toContain("setStageResizeTick");
    expect(source).toContain("[docLoading, error, currentPage, userScale, stageResizeTick");
  });
});
