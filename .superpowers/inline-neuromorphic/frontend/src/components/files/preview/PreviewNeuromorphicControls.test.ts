import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readPreviewSource = (file: string) =>
  readFileSync(resolve(__dirname, file), "utf8");

describe("preview neuromorphic controls", () => {
  it("uses primitive surfaces for floating toolbar buttons", () => {
    const source = readPreviewSource("FilePreviewToolbar.tsx");

    expect(source).toContain("previewFloatingBtn");
    expect(source).toContain("neu-raised previewFloatingToolbar");
    expect(source).toContain("neu-raised-sm previewFloatingBtn");
    expect(source).toContain("neu-pressed text-[var(--preview-floating-btn-text)]");
    expect(source).toContain("active:shadow-[var(--neu-pressed-shadow)]");
    expect(source).not.toContain("hover:[background:var(--preview-floating-btn-hover-bg)]");
    expect(source).not.toContain("active:[background:var(--preview-floating-btn-active-bg)]");
    expect(source).not.toContain("[background:var(--preview-floating-btn-active-bg)]");
    expect(source).not.toContain("hover:bg-[var(--preview-floating-btn-hover-bg)]");
    expect(source).not.toContain("active:bg-[var(--preview-floating-btn-active-bg)]");
    expect(source).not.toContain("bg-[var(--preview-floating-btn-active-bg)]");
  });

  it("uses raised and inset primitives for preview fallback surfaces", () => {
    const states = readPreviewSource("FilePreviewStates.tsx");
    const audio = readPreviewSource("AudioPreview.tsx");

    expect(states).toContain("previewErrorSurface");
    expect(states).toContain("neu-inset previewErrorSurface");
    expect(states).toContain("border-0");
    expect(states).toContain("previewErrorAction");
    expect(states).toContain("neu-raised-sm previewErrorAction");
    expect(states).toContain("bg-indigo-500");
    expect(states).toContain("hover:bg-indigo-600");
    expect(states).toContain("previewUnsupportedCard");
    expect(states).toContain("previewUnsupportedHomeCard");
    expect(states).toContain("previewUnsupportedThumb");
    expect(states).toContain("neu-raised previewUnsupportedCard");
    expect(states).toContain("neu-inset relative");
    expect(states).not.toContain("scale-[2]");
    expect(states).not.toContain("[background:var(--preview-surface-soft)]");
    expect(states).not.toContain("[background:var(--preview-action-bg)]");
    expect(states).not.toContain("hover:[background:var(--preview-action-bg-hover)]");
    expect(states).not.toContain("[background:var(--preview-unsupported-bg)]");
    expect(states).not.toContain("bg-[var(--preview-surface-soft)]");
    expect(states).not.toContain("hover:bg-[var(--preview-action-bg-hover)]");

    expect(audio).toContain("audioPreviewSurface");
    expect(audio).toContain("neu-inset audioPreviewSurface");
    expect(audio).toContain("neu-raised-sm flex h-[clamp(5.75rem");
    expect(audio).not.toContain("[background:var(--preview-surface-soft)]");
    expect(audio).not.toContain("bg-[var(--preview-surface-soft)]");
  });

  it("renders markdown code labels and copy buttons with primitive surfaces", () => {
    const source = readPreviewSource("MarkdownCodeBlock.tsx");

    expect(source).toContain("neu-inset previewMarkdownCodeBlock");
    expect(source).toContain("neu-inset text-[var(--preview-markdown-codeblock-label-text)]");
    expect(source).toContain("neu-raised-sm text-[var(--preview-markdown-codeblock-btn-text)]");
    expect(source).toContain("neu-pressed text-[var(--preview-markdown-codeblock-btn-copied-text)]");
    expect(source).not.toContain("[background:var(--preview-markdown-codeblock-label-bg)]");
    expect(source).not.toContain("[background:var(--preview-markdown-codeblock-btn-bg)]");
    expect(source).not.toContain("hover:[background:var(--preview-markdown-codeblock-btn-hover-bg)]");
    expect(source).not.toContain("[background:var(--preview-markdown-codeblock-btn-copied-bg)]");
    expect(source).not.toContain("bg-[var(--preview-markdown-codeblock-label-bg)]");
    expect(source).not.toContain("hover:bg-[var(--preview-markdown-codeblock-btn-hover-bg)]");
  });
});
