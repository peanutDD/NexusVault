import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FilePreviewContent, type FilePreviewContentProps } from "./FilePreviewContent";

const baseProps: FilePreviewContentProps = {
  file: {
    id: "file-1",
    original_filename: "preview.jpg",
    mime_type: "image/jpeg",
    file_size: 128,
    created_at: "2026-05-15T00:00:00.000Z",
  },
  loading: false,
  error: null,
  supported: true,
  isImage: true,
  isPDF: false,
  isMarkdown: false,
  isVideo: false,
  isAudio: false,
  isText: false,
  blobUrl: "blob:preview",
  gifFirstFrameUrl: null,
  textContent: null,
  useHls: false,
  imageLoaded: true,
  videoRef: { current: null },
  loop: true,
  setImageLoaded: vi.fn(),
  tryVideoAudioFallback: vi.fn(),
  onImageError: vi.fn(),
  onClose: vi.fn(),
  formatDate: (date) => date,
  zoom: 1,
  rotation: 0,
  pan: { x: 0, y: 0 },
  isDraggingImage: false,
  onImagePointerDown: vi.fn(),
  onImagePointerMove: vi.fn(),
  onImagePointerUp: vi.fn(),
  onImagePointerCancel: vi.fn(),
};

describe("FilePreviewContent", () => {
  it("restores the roomy preview content border padding on all sides", () => {
    render(<FilePreviewContent {...baseProps} />);

    expect(screen.getByTestId("preview-content-inner")).toHaveClass(
      "min-h-0",
      "p-[clamp(1rem,3vw,2rem)]",
    );
  });

  it("hides the stage label for text previews so the document toolbar can breathe", () => {
    render(
      <FilePreviewContent
        {...baseProps}
        isImage={false}
        isText
        isMarkdown
        blobUrl={null}
        textContent="# Title"
      />,
    );

    expect(screen.queryByTestId("preview-stage-label")).not.toBeInTheDocument();
  });

  it("uses document-mode stage sizing for text, Markdown, and PDF previews only", () => {
    const { rerender } = render(
      <FilePreviewContent
        {...baseProps}
        isImage={false}
        isText
        isMarkdown={false}
        blobUrl={null}
        textContent="plain text"
      />,
    );

    expect(screen.getByTestId("preview-stage-shell")).toHaveClass(
      "previewStageDocumentShell",
    );
    expect(screen.getByTestId("preview-stage-display")).toHaveClass(
      "previewStageDocumentDisplay",
    );

    rerender(
      <FilePreviewContent
        {...baseProps}
        isImage={false}
        isText
        isMarkdown
        blobUrl={null}
        textContent="# Markdown"
      />,
    );

    expect(screen.getByTestId("preview-stage-display")).toHaveClass(
      "previewStageDocumentDisplay",
    );

    rerender(
      <FilePreviewContent
        {...baseProps}
        isImage={false}
        isPDF
        blobUrl="blob:pdf-preview"
        textContent={null}
      />,
    );

    expect(screen.getByTestId("preview-stage-display")).toHaveClass(
      "previewStageDocumentDisplay",
    );

    rerender(<FilePreviewContent {...baseProps} />);

    expect(screen.getByTestId("preview-stage-display")).not.toHaveClass(
      "previewStageDocumentDisplay",
    );
  });

  it("applies preview rotation to video playback", () => {
    const { container } = render(
      <FilePreviewContent
        {...baseProps}
        file={{
          ...baseProps.file,
          original_filename: "clip.mp4",
          mime_type: "video/mp4",
        }}
        isImage={false}
        isVideo
        blobUrl="blob:video-preview"
        rotation={90}
      />,
    );

    const video = container.querySelector("video");
    expect(video).toBeInTheDocument();
    expect(video).toHaveClass(
      "transform-[rotate(var(--preview-rotation))]",
    );
    expect(video).toHaveStyle("--preview-rotation: 90deg");
  });
});
