import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { FilePreviewToolbar } from "./FilePreviewToolbar";

describe("FilePreviewToolbar", () => {
  it("renders the floating container with a raised primitive surface", () => {
    render(
      <FilePreviewToolbar
        section="lower"
        isImage
        isVideo={false}
        onClose={vi.fn()}
        onDownload={vi.fn()}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onRotate={vi.fn()}
        onResetView={vi.fn()}
        onToggleLoop={vi.fn()}
        isLooping
      />,
    );

    expect(screen.getByTestId("preview-toolbar-container")).toHaveClass(
      "neu-raised",
      "previewFloatingToolbar",
    );
    expect(screen.getByTestId("preview-toolbar-container")).not.toHaveClass(
      "[background:var(--preview-floating-bg)]",
    );
    expect(screen.getByRole("button", { name: "关闭" })).toHaveClass(
      "neu-raised-sm",
      "previewFloatingBtn",
    );
    expect(screen.getByRole("button", { name: "下载" })).toHaveClass(
      "neu-raised-sm",
      "previewFloatingBtn",
    );
  });

  it("places download before close in the primary preview controls", () => {
    render(
      <FilePreviewToolbar
        section="lower"
        isImage
        isVideo={false}
        onClose={vi.fn()}
        onDownload={vi.fn()}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onRotate={vi.fn()}
        onResetView={vi.fn()}
        onToggleLoop={vi.fn()}
        isLooping
      />,
    );

    const labels = screen
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label"));

    expect(labels).toEqual(["下载", "关闭"]);
  });

  it("places the video rotate control with the loop control", () => {
    const onRotate = vi.fn();

    render(
      <FilePreviewToolbar
        section="upper"
        isImage={false}
        isVideo
        onClose={vi.fn()}
        onDownload={vi.fn()}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onRotate={onRotate}
        onResetView={vi.fn()}
        onToggleLoop={vi.fn()}
        isLooping
      />,
    );

    const labels = screen
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label"));

    expect(labels).toEqual(["关闭循环播放", "旋转 90 度"]);

    fireEvent.click(screen.getByRole("button", { name: "旋转 90 度" }));

    expect(onRotate).toHaveBeenCalledTimes(1);
  });

  it("sizes preview toolbar buttons from shared fluid variables", () => {
    const source = readFileSync(resolve(__dirname, "./FilePreviewToolbar.tsx"), "utf8");

    expect(source).toContain("w-[var(--preview-toolbar-button-size)]");
    expect(source).toContain("h-[var(--preview-toolbar-button-size)]");
    expect(source).toContain("w-[var(--preview-toolbar-icon-size)]");
    expect(source).toContain("h-[var(--preview-toolbar-icon-size)]");
    expect(source).toContain("previewFloatingResetButton");
    expect(source).toContain("text-[length:var(--preview-toolbar-reset-font-size)]");
    expect(source).not.toContain("w-[clamp(2rem,5vw,2.5rem)]");
    expect(source).not.toContain("h-[clamp(2rem,5vw,2.5rem)]");
    expect(source).not.toContain("w-[clamp(1rem,2.5vw,1.25rem)]");
    expect(source).not.toContain("h-[clamp(1rem,2.5vw,1.25rem)]");
  });
});
