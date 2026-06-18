import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readPreviewSource = (file: string) =>
  readFileSync(resolve(__dirname, file), "utf8");

describe("preview neuromorphic controls", () => {
  it("uses gradient-capable backgrounds for floating toolbar buttons", () => {
    const source = readPreviewSource("FilePreviewToolbar.tsx");

    expect(source).toContain("previewFloatingBtn");
    expect(source).toContain("hover:[background:var(--preview-floating-btn-hover-bg)]");
    expect(source).toContain("active:[background:var(--preview-floating-btn-active-bg)]");
    expect(source).toContain("[background:var(--preview-floating-btn-active-bg)]");
    expect(source).not.toContain("hover:bg-[var(--preview-floating-btn-hover-bg)]");
    expect(source).not.toContain("active:bg-[var(--preview-floating-btn-active-bg)]");
    expect(source).not.toContain("bg-[var(--preview-floating-btn-active-bg)]");
  });

  it("uses raised and inset primitives for preview fallback surfaces", () => {
    const states = readPreviewSource("FilePreviewStates.tsx");
    const audio = readPreviewSource("AudioPreview.tsx");

    expect(states).toContain("previewErrorSurface");
    expect(states).toContain("[background:var(--preview-surface-soft)]");
    expect(states).toContain("shadow-[var(--neu-inset-shadow)]");
    expect(states).toContain("previewErrorAction");
    expect(states).toContain("[background:var(--preview-action-bg)]");
    expect(states).toContain("hover:[background:var(--preview-action-bg-hover)]");
    expect(states).toContain("previewUnsupportedCard");
    expect(states).toContain("[background:var(--preview-unsupported-bg)]");
    expect(states).not.toContain("bg-[var(--preview-surface-soft)]");
    expect(states).not.toContain("hover:bg-[var(--preview-action-bg-hover)]");

    expect(audio).toContain("audioPreviewSurface");
    expect(audio).toContain("[background:var(--preview-surface-soft)]");
    expect(audio).toContain("shadow-[var(--neu-inset-shadow)]");
    expect(audio).not.toContain("bg-[var(--preview-surface-soft)]");
  });

  it("renders markdown code labels and copy buttons with background shorthand", () => {
    const source = readPreviewSource("MarkdownCodeBlock.tsx");

    expect(source).toContain("[background:var(--preview-markdown-codeblock-label-bg)]");
    expect(source).toContain("[background:var(--preview-markdown-codeblock-btn-bg)]");
    expect(source).toContain("hover:[background:var(--preview-markdown-codeblock-btn-hover-bg)]");
    expect(source).toContain("[background:var(--preview-markdown-codeblock-btn-copied-bg)]");
    expect(source).not.toContain("bg-[var(--preview-markdown-codeblock-label-bg)]");
    expect(source).not.toContain("hover:bg-[var(--preview-markdown-codeblock-btn-hover-bg)]");
  });
});
