import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import FilePreviewTextPanel from "./FilePreviewTextPanel";
import MarkdownPreview from "./MarkdownPreview";

describe("FilePreviewTextPanel", () => {
  it("uses a raised primitive for the Markdown reading panel", async () => {
    render(<FilePreviewTextPanel isMarkdown textContent="# Title" />);
    await screen.findByText("Title", undefined, { timeout: 10_000 });

    expect(screen.getByTestId("preview-text-panel")).toHaveClass(
      "w-full",
      "h-full",
      "max-w-[var(--app-preview-text-panel-max-width)]",
      "neu-raised",
      "previewTextPanel",
    );
    expect(screen.getByTestId("preview-text-panel")).not.toHaveClass(
      "[background:var(--preview-markdown-container-bg)]",
    );
    expect(screen.getByTestId("preview-text-panel")).not.toHaveClass(
      "w-[min(92vw,60rem)]",
    );
    expect(screen.getByTestId("preview-text-panel")).not.toHaveClass(
      "h-[min(70vh,42rem)]",
    );
  });

  it("renders a compact inset title bar with raised metadata badges", async () => {
    render(
      <FilePreviewTextPanel
        isMarkdown
        textContent={["# Title", "", "Body"].join("\n")}
      />,
    );

    expect(screen.getByTestId("preview-text-toolbar")).toHaveClass(
      "flex",
      "h-[clamp(3.656rem,6.63vw,3.9rem)]",
      "items-center",
    );
    expect(screen.getByTestId("preview-text-scroll")).toHaveClass(
      "h-[calc(100%_-_clamp(3.656rem,6.63vw,3.9rem))]",
    );
    expect(screen.getByTestId("preview-text-toolbar-system")).toHaveTextContent(
      "SSTV",
    );
    expect(screen.getByTestId("preview-text-toolbar-system-label")).toHaveClass(
      "previewTextBrandLabel",
      "text-[clamp(0.72rem,1.6vw,0.9rem)]",
    );
    expect(screen.getByTestId("preview-text-toolbar-mark")).toHaveTextContent(
      "MD",
    );
    expect(screen.queryByTestId("preview-text-toolbar-title")).not.toBeInTheDocument();
    expect(screen.queryByText("Markdown")).not.toBeInTheDocument();
    expect(screen.getByTestId("preview-text-toolbar-rule")).toHaveClass(
      "previewTextBrandRule",
      "h-px",
      "flex-1",
    );
    const lineCount = screen.getByTestId("preview-text-toolbar-line-count");
    const lineCountText = screen.getByTestId("preview-text-toolbar-line-count-text");
    const mark = screen.getByTestId("preview-text-toolbar-mark");
    const markText = screen.getByTestId("preview-text-toolbar-mark-text");
    expect(lineCount).toHaveClass(
      "neu-raised-sm",
      "previewTextMetaCapsule",
      "rounded-full",
      "h-[clamp(0.845rem,1.8vw,0.995rem)]",
    );
    expect(lineCountText).toHaveClass(
      "text-[clamp(0.46rem,0.95vw,0.54rem)]",
      "text-[var(--preview-text-primary)]",
    );
    expect(mark).toHaveClass(
      "neu-raised-sm",
      "previewTextMetaCapsule",
      "rounded-full",
      "h-[clamp(0.845rem,1.8vw,0.995rem)]",
    );
    expect(markText).toHaveClass(
      "text-[clamp(0.46rem,0.95vw,0.54rem)]",
      "text-[var(--preview-text-primary)]",
    );
    expect(lineCount).toHaveTextContent("3 行");

    const metadataOrder = Array.from(
      screen.getByTestId("preview-text-toolbar-meta").children,
    ).map((element) => element.getAttribute("data-testid"));
    expect(metadataOrder).toEqual(
      ["preview-text-toolbar-line-count", "preview-text-toolbar-mark"],
    );
  });

  it("uses one preview brand token for the SSTV mark and underline", () => {
    render(<FilePreviewTextPanel isMarkdown={false} textContent="plain" />);

    expect(screen.getByTestId("preview-text-toolbar-system-label")).toHaveClass(
      "previewTextBrandLabel",
    );
    expect(screen.getByTestId("preview-text-toolbar-rule")).toHaveClass(
      "previewTextBrandRule",
    );

    const css = readFileSync(
      resolve(__dirname, "../../../styles/preview.css"),
      "utf8",
    ).replace(/\s+/g, " ");
    const stageSource = readFileSync(resolve(__dirname, "FilePreviewStage.tsx"), "utf8");

    expect(css).toContain(".previewTextBrandLabel, .previewStageBrandLabel");
    expect(css).toContain("color: var(--preview-brand-mark)");
    expect(css).toContain(".previewTextBrandRule, .previewStageBrandRule");
    expect(css).toContain("background: var(--preview-brand-mark)");
    expect(stageSource).toContain("previewStageBrandLabel");
    expect(stageSource).toContain("previewStageBrandRule");
  });

  it("renders inline Markdown code with an inset primitive surface", async () => {
    render(<MarkdownPreview content="Use `inlineCode` here." />);

    expect(await screen.findByText("inlineCode")).toHaveClass(
      "neu-inset",
      "border-0",
    );
  });

  it("keeps mobile document content constrained inside the preview panel", async () => {
    render(
      <FilePreviewTextPanel
        isMarkdown
        textContent={[
          "# Rust layout",
          "",
          "![wide diagram](https://example.test/wide-rust-diagram.png)",
          "",
          "| field | value | very long heading |",
          "| --- | --- | --- |",
          "| pointer | 0x123456 | content |",
        ].join("\n")}
      />,
    );

    expect(screen.getByTestId("preview-text-panel")).toHaveClass(
      "previewTextPanel",
    );
    expect(screen.getByTestId("preview-text-panel-frame")).toHaveClass(
      "min-w-0",
      "w-full",
    );
    expect(screen.getByTestId("preview-text-scroll")).toHaveClass(
      "previewTextScroll",
    );
    expect(await screen.findByAltText("wide diagram")).toHaveClass(
      "previewMarkdownMedia",
    );

    const css = readFileSync(
      resolve(__dirname, "../../../styles/preview.css"),
      "utf8",
    ).replace(/\s+/g, " ");

    expect(css).toContain(".previewTextPanel");
    expect(css).toContain(".previewTextScroll");
    expect(css).toContain(".previewMarkdownMedia");
    expect(css).toContain("overflow-x: hidden");
    expect(css).toContain("max-inline-size: 100%");
    expect(css).toContain("block-size: 100%");
    expect(css).not.toContain("calc(100dvw - clamp(1rem, 6vw, 1.5rem))");
  });
});
