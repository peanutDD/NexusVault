import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import FilePreviewStage from "./FilePreviewStage";

describe("FilePreviewStage", () => {
  it("sizes the preview display against the stage container instead of the viewport", () => {
    render(
      <FilePreviewStage showLabel onClose={vi.fn()}>
        <div>preview body</div>
      </FilePreviewStage>,
    );

    expect(screen.getByTestId("preview-stage-shell")).toHaveClass(
      "previewStageShell",
      "w-full",
      "min-w-0",
      "px-[clamp(0.75rem,5vw,4.5rem)]",
    );
    expect(screen.getByTestId("preview-stage-display")).toHaveClass(
      "previewStageDisplay",
      "min-w-0",
      "w-full",
      "max-w-[var(--app-preview-stage-max-width)]",
    );
    expect(screen.getByTestId("preview-stage-display")).not.toHaveClass(
      "w-[min(92vw,70rem)]",
    );
  });

  it("reserves vertical room for the desktop pedestal below the preview screen", () => {
    render(
      <FilePreviewStage showLabel onClose={vi.fn()}>
        <div>preview body</div>
      </FilePreviewStage>,
    );

    expect(screen.getByTestId("preview-stage-shell")).toHaveClass(
      "previewStageShell",
      "w-full",
      "min-w-0",
      "justify-center",
      "px-[clamp(0.75rem,5vw,4.5rem)]",
      "py-[clamp(0.55rem,1.2vh,0.85rem)]",
    );
    expect(screen.getByTestId("preview-stage-display")).toHaveClass(
      "previewStageDisplay",
      "min-w-0",
      "top-[calc(clamp(0.77rem,1.58vh,1.18rem)*-1)]",
      "w-full",
      "max-w-[var(--app-preview-stage-max-width)]",
    );
    expect(screen.getByTestId("preview-stage-display")).not.toHaveClass(
      "h-[min(72vh,55rem,calc(100%_-_clamp(1.12rem,1.68vh,1.36rem)))]",
    );
    expect(screen.getByTestId("preview-pedestal")).toHaveClass(
      "translate-y-[clamp(0.12rem,0.4vw,0.3rem)]",
    );
    expect(screen.getByTestId("preview-pedestal-spine")).toBeInTheDocument();
    expect(screen.queryByTestId("preview-pedestal-bridge")).not.toBeInTheDocument();
    expect(screen.getByTestId("preview-pedestal-foot")).toBeInTheDocument();
  });

  it("keeps preview media and document pages on one fluid height contract", () => {
    render(
      <FilePreviewStage showLabel onClose={vi.fn()}>
        <div>preview body</div>
      </FilePreviewStage>,
    );

    const css = readFileSync(
      resolve(__dirname, "../../../styles/preview.css"),
      "utf8",
    ).replace(/\s+/g, " ");

    expect(css).toContain("--preview-stage-fluid-height");
    expect(css).toContain("height: var(--preview-stage-fluid-height)");
    expect(css).toContain("max-height: var(--preview-stage-fluid-height)");
    expect(css).toMatch(/min\(\s*82dvh,\s*55rem/);
    expect(css).toContain(".previewStageDocumentShell");
    expect(css).toMatch(/min\(\s*100%,\s*70dvh,\s*46rem/);
    expect(css).not.toContain("h-[min(72vh");
    expect(css).not.toContain("height: min(58dvh");
  });

  it("lets document previews use a mobile reading stage without shrinking every preview", () => {
    render(
      <FilePreviewStage showLabel={false} onClose={vi.fn()} isDocumentPreview>
        <div>document body</div>
      </FilePreviewStage>,
    );

    expect(screen.getByTestId("preview-stage-shell")).toHaveClass(
      "previewStageDocumentShell",
    );
    expect(screen.getByTestId("preview-stage-display")).toHaveClass(
      "previewStageDocumentDisplay",
    );

    const css = readFileSync(
      resolve(__dirname, "../../../styles/preview.css"),
      "utf8",
    ).replace(/\s+/g, " ");

    expect(css).toContain(".previewStageDocumentDisplay");
    expect(css).toMatch(/--preview-stage-fluid-height:\s*min\(\s*100%,\s*70dvh/);
    expect(css).toContain("height: min(100%, var(--preview-stage-fluid-height)) !important");
    expect(css).not.toContain("height: min(58dvh");
  });
});
