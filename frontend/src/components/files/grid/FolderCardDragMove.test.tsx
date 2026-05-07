import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Folder } from "../../../types/folders";
import FolderCard from "./FolderCard";

const sourceFolder: Folder = {
  id: "folder-source",
  name: "Source",
  parent_id: null,
  created_at: "2026-05-07T08:00:00.000Z",
  updated_at: "2026-05-07T08:00:00.000Z",
};

const targetFolder: Folder = {
  id: "folder-target",
  name: "Target",
  parent_id: null,
  created_at: "2026-05-07T08:00:00.000Z",
  updated_at: "2026-05-07T08:00:00.000Z",
};

function renderFolder(
  folder: Folder,
  onMobileFolderDrop = vi.fn(),
  onMobileFolderDragStart = vi.fn(),
  onMobileFolderDragEnd = vi.fn(),
) {
  return render(
    <FolderCard
      folder={folder}
      isSelected={false}
      onSelect={vi.fn()}
      onOpen={vi.fn()}
      onRename={vi.fn()}
      onDelete={vi.fn()}
      isMenuOpen={false}
      onToggleMenu={vi.fn()}
      onCloseMenu={vi.fn()}
      onMobileFolderDrop={onMobileFolderDrop}
      onMobileFolderDragStart={onMobileFolderDragStart}
      onMobileFolderDragEnd={onMobileFolderDragEnd}
    />,
  );
}

describe("FolderCard drag move", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts mobile folder drag only after a long press and drops on the folder under release", () => {
    const onMobileFolderDrop = vi.fn();
    const onMobileFolderDragStart = vi.fn();
    const onMobileFolderDragEnd = vi.fn();

    const { container } = renderFolder(
      sourceFolder,
      onMobileFolderDrop,
      onMobileFolderDragStart,
      onMobileFolderDragEnd,
    );
    renderFolder(targetFolder, onMobileFolderDrop);

    const sourceCard = screen.getByTitle(sourceFolder.name).closest("[data-folder-id]");
    const targetCard = screen.getByTitle(targetFolder.name).closest("[data-folder-id]");
    expect(sourceCard).toBeTruthy();
    expect(targetCard).toBeTruthy();

    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: vi.fn(() => targetCard),
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
    expect(onMobileFolderDragStart).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onMobileFolderDragStart).toHaveBeenCalledWith(sourceFolder.id);
    const draggingCard = container.querySelector("[data-mobile-folder-dragging='true']");
    expect(draggingCard).toBeTruthy();
    expect(draggingCard).toHaveClass("pointer-events-none");

    fireEvent.pointerUp(sourceCard as Element, {
      pointerId: 1,
      pointerType: "touch",
      clientX: 120,
      clientY: 120,
      isPrimary: true,
    });

    expect(onMobileFolderDrop).toHaveBeenCalledWith(targetFolder.id, sourceFolder.id);
    expect(onMobileFolderDragEnd).toHaveBeenCalledTimes(1);
  });

  it("does not start mobile folder drag for a short tap", () => {
    const onMobileFolderDrop = vi.fn();
    const onMobileFolderDragStart = vi.fn();

    renderFolder(sourceFolder, onMobileFolderDrop, onMobileFolderDragStart);
    const sourceCard = screen.getByTitle(sourceFolder.name).closest("[data-folder-id]");

    fireEvent.pointerDown(sourceCard as Element, {
      pointerId: 2,
      pointerType: "touch",
      clientX: 16,
      clientY: 16,
      isPrimary: true,
    });
    act(() => {
      vi.advanceTimersByTime(120);
    });
    fireEvent.pointerUp(sourceCard as Element, {
      pointerId: 2,
      pointerType: "touch",
      clientX: 16,
      clientY: 16,
      isPrimary: true,
    });

    expect(onMobileFolderDragStart).not.toHaveBeenCalled();
    expect(onMobileFolderDrop).not.toHaveBeenCalled();
  });
});
