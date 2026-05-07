import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FileMetadata } from "../../../types/files";
import FileCard from "./FileCard";

vi.mock("../preview/LazyThumbnail", () => ({
  default: () => <div data-testid="thumbnail" />,
}));

const file: FileMetadata = {
  id: "file-1",
  filename: "file-1.jpg",
  original_filename: "file-1.jpg",
  file_size: 1024,
  mime_type: "image/jpeg",
  category: "image",
  folder_id: null,
  created_at: "2026-05-07T08:00:00.000Z",
};

function renderFile(
  onMobileFileDrop = vi.fn(),
  onMobileFileDragStart = vi.fn(),
  onMobileFileDragEnd = vi.fn(),
  onPreview = vi.fn(),
) {
  return render(
    <FileCard
      file={file}
      isSelected={false}
      onSelect={vi.fn()}
      onPreview={onPreview}
      onShare={vi.fn()}
      onDownload={vi.fn()}
      onRename={vi.fn()}
      onDelete={vi.fn()}
      isMenuOpen={false}
      onToggleMenu={vi.fn()}
      onCloseMenu={vi.fn()}
      onMobileFileDrop={onMobileFileDrop}
      onMobileFileDragStart={onMobileFileDragStart}
      onMobileFileDragEnd={onMobileFileDragEnd}
    />,
  );
}

describe("FileCard mobile drag move", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts mobile file drag only after long press and drops on a target folder", () => {
    const onMobileFileDrop = vi.fn();
    const onMobileFileDragStart = vi.fn();
    const onMobileFileDragEnd = vi.fn();
    const { container } = renderFile(
      onMobileFileDrop,
      onMobileFileDragStart,
      onMobileFileDragEnd,
    );
    const targetFolder = document.createElement("div");
    targetFolder.dataset.folderId = "folder-target";
    document.body.appendChild(targetFolder);

    const sourceCard = screen.getByTitle(file.original_filename).closest("[data-file-id]");
    expect(sourceCard).toBeTruthy();
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: vi.fn(() => targetFolder),
    });

    fireEvent.pointerDown(sourceCard as Element, {
      pointerId: 1,
      pointerType: "touch",
      clientX: 16,
      clientY: 16,
      isPrimary: true,
    });

    act(() => {
      vi.advanceTimersByTime(449);
    });
    expect(onMobileFileDragStart).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onMobileFileDragStart).toHaveBeenCalledWith(file.id);
    const draggingCard = container.querySelector("[data-mobile-file-dragging='true']");
    expect(draggingCard).toBeTruthy();
    expect(draggingCard).toHaveClass("pointer-events-none");

    fireEvent.pointerUp(sourceCard as Element, {
      pointerId: 1,
      pointerType: "touch",
      clientX: 120,
      clientY: 120,
      isPrimary: true,
    });

    expect(onMobileFileDrop).toHaveBeenCalledWith("folder-target", file.id);
    expect(onMobileFileDragEnd).toHaveBeenCalledTimes(1);
  });

  it("resets suppressed preview state on the next pointer interaction", () => {
    const onPreview = vi.fn();
    renderFile(vi.fn(), vi.fn(), vi.fn(), onPreview);
    const sourceCard = screen.getByTitle(file.original_filename).closest("[data-file-id]");
    const thumbnail = screen.getByTestId("thumbnail").parentElement;
    const targetFolder = document.createElement("div");
    targetFolder.dataset.folderId = "folder-target";
    document.body.appendChild(targetFolder);

    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: vi.fn(() => targetFolder),
    });

    fireEvent.pointerDown(sourceCard as Element, {
      pointerId: 1,
      pointerType: "touch",
      clientX: 16,
      clientY: 16,
      isPrimary: true,
    });
    act(() => {
      vi.advanceTimersByTime(450);
    });
    fireEvent.pointerUp(sourceCard as Element, {
      pointerId: 1,
      pointerType: "touch",
      clientX: 120,
      clientY: 120,
      isPrimary: true,
    });

    fireEvent.pointerDown(sourceCard as Element, {
      pointerId: 2,
      pointerType: "touch",
      clientX: 16,
      clientY: 16,
      isPrimary: true,
    });
    fireEvent.click(thumbnail as Element);

    expect(onPreview).toHaveBeenCalledWith(file);
  });
});
