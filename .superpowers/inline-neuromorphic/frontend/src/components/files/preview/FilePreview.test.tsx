import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { FileMetadata } from "../../../types/files";
import FilePreview from "./FilePreview";

vi.mock("../../../services/files", () => ({
  fileService: {
    downloadFile: vi.fn(),
  },
}));

vi.mock("./hooks/useFilePreviewData", () => ({
  useFilePreviewData: () => ({
    blobUrl: "blob:preview-image",
    gifFirstFrameUrl: null,
    textContent: null,
    error: null,
    loading: false,
    useHls: false,
    imageLoaded: true,
    setImageLoaded: vi.fn(),
    videoRef: { current: null },
    hlsStartTimeRef: { current: null },
    hlsStartPausedRef: { current: null },
    hlsStartVolumeRef: { current: null },
    hlsStartMutedRef: { current: null },
    tryVideoAudioFallback: vi.fn(),
    tryVideoAudioFallbackRef: { current: vi.fn() },
    onImageError: vi.fn(),
  }),
}));

vi.mock("./hooks/useFilePreviewNavigation", () => ({
  useFilePreviewNavigation: () => ({
    canGoPrev: false,
    canGoNext: false,
    goToPrev: vi.fn(),
    goToNext: vi.fn(),
  }),
}));

vi.mock("./hooks/useFilePreviewEffects", () => ({
  useFilePreviewEffects: vi.fn(),
}));

vi.mock("./hooks/useImagePan", () => ({
  useImagePan: () => ({
    pan: { x: 0, y: 0 },
    isDragging: false,
    resetPan: vi.fn(),
    onPointerDown: vi.fn(),
    onPointerMove: vi.fn(),
    onPointerUp: vi.fn(),
    onPointerCancel: vi.fn(),
  }),
}));

vi.mock("./FilePreviewContent", () => ({
  FilePreviewContent: () => <div data-testid="preview-content" />,
}));

vi.mock("./FilePreviewToolbar", () => ({
  FilePreviewToolbar: ({
    className,
    section,
  }: {
    className?: string;
    section?: "upper" | "lower";
  }) => (
    <div
      data-testid={`preview-toolbar-${section ?? "unknown"}`}
      className={className}
    />
  ),
}));

const imageFile: FileMetadata = {
  id: "file-1",
  filename: "image.jpg",
  original_filename: "image.jpg",
  file_size: 128,
  mime_type: "image/jpeg",
  category: null,
  folder_id: null,
  created_at: "2026-05-15T00:00:00.000Z",
};

describe("FilePreview", () => {
  it("portals the dialog outside page content so the footer cannot paint over it", () => {
    const { container } = render(
      <main data-testid="page-main">
        <FilePreview file={imageFile} onClose={vi.fn()} />
      </main>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(screen.getByTestId("page-main")).not.toContainElement(dialog);
  });

  it("covers the fixed top NavBar with the modal backdrop", () => {
    render(<FilePreview file={imageFile} onClose={vi.fn()} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass(
      "fixed",
      "inset-0",
      "z-[70]",
    );
    expect(dialog).not.toHaveClass("top-[calc(clamp(4.75rem,7.6vw,6.25rem)+env(safe-area-inset-top))]");
    expect(dialog).not.toHaveClass("z-50");
    expect(screen.getByTestId("preview-content")).toBeInTheDocument();
  });

  it("does not reserve the empty top counter strip when there is only one file", () => {
    render(<FilePreview file={imageFile} files={[imageFile]} onClose={vi.fn()} />);

    expect(screen.queryByTestId("preview-counter-strip")).not.toBeInTheDocument();
  });

  it("keeps the file info card close to the preview pedestal", () => {
    render(<FilePreview file={imageFile} files={[imageFile]} onClose={vi.fn()} />);

    expect(screen.getByTestId("preview-file-info-strip")).toHaveClass(
      "pt-[clamp(0.18rem,0.45vw,0.25rem)]",
    );
    expect(screen.getByTestId("preview-file-info-card")).toHaveClass(
      "previewFileInfoCard",
    );
    expect(screen.getByTestId("preview-file-info-content")).toHaveClass(
      "previewFileInfoContent",
    );
    expect(screen.getByTestId("preview-file-info-name-block")).toHaveClass(
      "previewFileInfoNameBlock",
    );
    expect(screen.getByTestId("preview-file-info-title")).toHaveClass(
      "previewFileInfoTitle",
      "truncate",
    );
    expect(screen.getByTestId("preview-file-info-title")).toHaveAttribute(
      "title",
      imageFile.original_filename,
    );
    expect(screen.getByTestId("preview-file-info-meta")).toHaveClass(
      "previewFileInfoMeta",
      "previewFileInfoMetaRail",
      "previewFileInfoMetaCapsule",
    );
    expect(screen.getByTestId("preview-file-info-size")).toHaveClass(
      "previewFileInfoMetaItem",
      "previewFileInfoSize",
    );
    expect(screen.getByTestId("preview-file-info-size")).not.toHaveClass(
      "previewFileInfoMetaChip",
    );
    expect(screen.getByTestId("preview-file-info-size-separator")).toHaveTextContent("·");
    expect(screen.getByTestId("preview-file-info-type")).toHaveClass(
      "previewFileInfoMetaItem",
      "previewFileInfoType",
    );
    expect(screen.getByTestId("preview-file-info-type-separator")).toHaveTextContent("·");
    expect(screen.getByTestId("preview-file-info-date")).toHaveClass(
      "previewFileInfoMetaItem",
      "previewFileInfoDate",
    );
  });

  it("maps the preview file info card to neuromorphic raised and inset primitives", () => {
    const css = readFileSync(resolve(__dirname, "../../../styles/preview.css"), "utf8")
      .replace(/\s+/g, " ");

    expect(css).toContain(".previewFileInfoCard");
    expect(css).toContain(".previewFileInfoTitle");
    expect(css).toContain(".previewFileInfoMetaCapsule");
    expect(css).toContain("background: var(--neu-raised-bg)");
    expect(css).toContain("box-shadow: var(--neu-raised-sm-shadow)");
    expect(css).toContain("background: var(--neu-inset-bg)");
    expect(css).toContain("box-shadow: var(--neu-inset-shadow)");
    expect(css).toContain("color: var(--neu-accent-text-strong)");
    expect(css).not.toContain(".neuromorphic-style");
  });

  it("uses a centered title with all metadata inside one neuromorphic capsule", () => {
    const css = readFileSync(resolve(__dirname, "../../../styles/preview.css"), "utf8")
      .replace(/\s+/g, " ");

    expect(css).toContain(".previewFileInfoContent");
    expect(css).toContain("flex-direction: column");
    expect(css).toContain("align-items: center");
    expect(css).toContain("justify-content: center");
    expect(css).toContain("text-align: center");
    expect(css).toContain(".previewFileInfoNameBlock");
    expect(css).toContain(".previewFileInfoMetaRail");
    expect(css).toContain(".previewFileInfoMetaCapsule");
    expect(css).toContain("width: fit-content");
    expect(css).toContain("max-width: 100%");
    expect(css).toContain("font-size: clamp(1rem, 1.65vw, 1.18rem)");
    expect(css).toContain("font-size: clamp(0.68rem, 1vw, 0.78rem)");
    expect(css).toContain("line-height: 1");
    expect(css).toContain("white-space: nowrap");
    expect(css).toContain("color: var(--preview-text-primary)");
    expect(css).toContain("color: var(--neu-accent-text-strong)");
    expect(css).toContain("color: var(--color-text-secondary)");
    expect(css).not.toContain(".previewFileInfoMetaChip");
    expect(css).not.toContain("min-height: clamp(2.15rem, 4vw, 2.75rem)");
    expect(css).not.toContain("grid-template-columns: minmax(0, 1fr) auto");
  });

  it("keeps the mobile file info group unified while allowing safe wrapping", () => {
    const css = readFileSync(resolve(__dirname, "../../../styles/preview.css"), "utf8")
      .replace(/\s+/g, " ");

    expect(css).toContain("@media (max-width: 640px)");
    expect(css).toContain("display: flex");
    expect(css).toContain("flex-direction: column");
    expect(css).toContain("flex-wrap: wrap");
    expect(css).toContain("align-items: center");
    expect(css).toContain("text-align: center");
    expect(css).toContain("background: transparent");
    expect(css).toContain("box-shadow: none");
    expect(css).toContain("min-height: auto");
    expect(css).toContain("font-size: clamp(0.84rem, 3.8vw, 0.98rem)");
    expect(css).toContain("font-size: clamp(0.62rem, 3.05vw, 0.72rem)");
    expect(css).toContain("padding-inline: clamp(0.5rem, 3vw, 0.75rem)");
    expect(css).toContain("justify-content: center");
    expect(css).toContain(".previewFileInfoMetaRail { width: fit-content; max-width: 100%; justify-self: center;");
  });

  it("keeps the top counter strip when multi-file navigation needs it", () => {
    const nextFile: FileMetadata = {
      ...imageFile,
      id: "file-2",
      filename: "next.jpg",
      original_filename: "next.jpg",
    };

    render(
      <FilePreview
        file={imageFile}
        files={[imageFile, nextFile]}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId("preview-counter-strip")).toBeInTheDocument();
  });

  it("uses the same theme background above and below the preview counter capsule", () => {
    const nextFile: FileMetadata = {
      ...imageFile,
      id: "file-2",
      filename: "next.jpg",
      original_filename: "next.jpg",
    };

    render(
      <FilePreview
        file={imageFile}
        files={[imageFile, nextFile]}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId("preview-counter-strip")).toHaveClass(
      "neu-flat",
      "previewCounterStrip",
    );
    expect(screen.getByTestId("preview-stage-control-plane")).toHaveClass(
      "neu-flat",
      "previewStageControlPlane",
    );
  });

  it("centers navigation and right-side toolbars against the preview stage plane", () => {
    const nextFile: FileMetadata = {
      ...imageFile,
      id: "file-2",
      filename: "next.jpg",
      original_filename: "next.jpg",
    };

    render(
      <FilePreview
        file={imageFile}
        files={[imageFile, nextFile]}
        onClose={vi.fn()}
      />,
    );

    const controlPlane = screen.getByTestId("preview-stage-control-plane");
    expect(controlPlane).toHaveClass(
      "previewStageControlPlane",
      "relative",
      "flex",
      "min-h-0",
      "flex-1",
    );
    expect(controlPlane).toContainElement(screen.getByTestId("preview-content"));
    expect(controlPlane).toContainElement(
      screen.getByRole("button", { name: "上一个文件" }),
    );
    expect(controlPlane).toContainElement(
      screen.getByRole("button", { name: "下一个文件" }),
    );

    expect(screen.getByRole("button", { name: "上一个文件" })).toHaveClass(
      "previewNavButton",
      "top-1/2",
      "-translate-y-1/2",
    );
    expect(screen.getByRole("button", { name: "下一个文件" })).toHaveClass(
      "previewNavButton",
      "top-1/2",
      "-translate-y-1/2",
    );
    expect(screen.getByTestId("preview-toolbar-upper")).toHaveClass(
      "bottom-[calc(50%+clamp(1rem,2.5vw,1.5rem)+clamp(0.75rem,1.8vw,1rem))]",
    );
    expect(screen.getByTestId("preview-toolbar-lower")).toHaveClass(
      "top-[calc(50%+clamp(1rem,2.5vw,1.5rem)+clamp(0.75rem,1.8vw,1rem))]",
    );
  });

  it("adapts the preview chrome for mobile instead of keeping desktop side gutters", () => {
    const nextFile: FileMetadata = {
      ...imageFile,
      id: "file-2",
      filename: "next.jpg",
      original_filename: "next.jpg",
    };

    render(
      <FilePreview
        file={imageFile}
        files={[imageFile, nextFile]}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog")).toHaveClass("previewDialog");
    expect(screen.getByTestId("preview-stage-control-plane")).toHaveClass(
      "min-w-0",
      "w-full",
    );
    expect(screen.getByTestId("preview-toolbar-upper")).toHaveClass(
      "previewToolbarUpper",
    );
    expect(screen.getByTestId("preview-toolbar-lower")).toHaveClass(
      "previewToolbarLower",
    );

    const css = readFileSync(resolve(__dirname, "../../../styles/preview.css"), "utf8");
    expect(css).toContain(
      "@media (max-width: 640px), (hover: none) and (pointer: coarse)",
    );
    expect(css).toContain(".previewDialog");
    expect(css).toContain("top: 0 !important");
    expect(css).toContain(".previewStageShell");
    expect(css).toContain("--preview-mobile-chrome-lane-block");
    expect(css).toContain("--preview-mobile-stage-row");
    expect(css).toContain("--preview-mobile-top-chrome-reserve");
    expect(css).toContain("--preview-mobile-bottom-chrome-reserve");
    expect(css).toContain("display: grid !important");
    expect(css).toContain(
      "grid-template-rows: var(--preview-mobile-top-chrome-reserve) var(--preview-mobile-stage-row) var(--preview-mobile-bottom-chrome-reserve)",
    );
    expect(css).toContain("padding-block-start: 0 !important");
    expect(css).toContain("padding-block-end: 0 !important");
    expect(css).toContain("padding-inline: clamp(0.45rem, 3vw, 0.75rem) !important");
    expect(css).toContain("grid-row: 2");
    expect(css).toContain("block-size: 100%");
    expect(css).toContain(".previewStageDisplay");
    expect(css).toContain("--preview-stage-fluid-height: min(");
    expect(css).toContain("height: min(100%, var(--preview-stage-fluid-height)) !important");
    expect(css).toContain("max-height: min(100%, var(--preview-stage-fluid-height)) !important");
    expect(css).toContain("width: 100% !important");
    expect(css).toContain("max-width: 100% !important");
    expect(css).not.toContain("calc(100vw - 1rem)");
    expect(css).toContain(".previewToolbarUpper");
    expect(css).toContain("bottom: var(--preview-mobile-chrome-inset) !important");
    expect(css).toContain(".previewToolbarLower");
    expect(css).toContain("top: var(--preview-mobile-chrome-inset) !important");
    expect(css).toContain(".previewMobileChromeLane");
    expect(css).toContain("--preview-toolbar-button-size: var(--preview-mobile-toolbar-button-size)");
    expect(css).toContain(".previewFloatingToolbar > div");
    expect(css).toContain("flex-direction: row !important");
  });

  it("uses primitive preview controls without residual glass overrides", () => {
    const css = readFileSync(resolve(__dirname, "../../../styles/preview.css"), "utf8")
      .replace(/\s+/g, " ");

    expect(css).toContain(".previewFloatingToolbar");
    expect(css).toContain(".previewNavButton");
    expect(css).toContain(".previewFloatingBtn");
    expect(css).toContain("border: 0");
    expect(css).toContain("background: var(--neu-raised-bg)");
    expect(css).toContain("box-shadow: var(--neu-raised-shadow)");
    expect(css).toContain("box-shadow: var(--neu-raised-sm-shadow)");
    expect(css).toContain("box-shadow: var(--neu-pressed-shadow)");
    expect(css).not.toContain("backdrop-filter");
    expect(css).not.toContain("-webkit-backdrop-filter");
    expect(css).not.toContain(".neuromorphic-style");
  });
});
