import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FileMetadata } from "../../../types/files";
import type { Folder } from "../../../types/folders";
import FileCard from "./FileCard";
import FolderCard from "./FolderCard";

vi.mock("../preview/LazyThumbnail", () => ({
  default: () => <div data-testid="thumbnail" />,
}));

const file: FileMetadata = {
  id: "file-1",
  filename: "very-long-file-name.jpg",
  original_filename: "very-long-file-name.jpg",
  file_size: 2048,
  mime_type: "image/jpeg",
  category: "image",
  folder_id: null,
  created_at: "2026-05-03T08:00:00.000Z",
};

const folder: Folder = {
  id: "folder-1",
  name: "Very Long Folder Name",
  parent_id: null,
  created_at: "2026-05-03T08:00:00.000Z",
  updated_at: "2026-05-03T08:00:00.000Z",
};

describe("card title alignment", () => {
  it("left-aligns file titles while keeping single-line ellipsis", () => {
    render(
      <FileCard
        file={file}
        isSelected={false}
        onSelect={vi.fn()}
        onPreview={vi.fn()}
        onShare={vi.fn()}
        onDownload={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        isMenuOpen={false}
        onToggleMenu={vi.fn()}
        onCloseMenu={vi.fn()}
      />,
    );

    expect(screen.getByTitle(file.original_filename)).toHaveClass(
      "text-left",
      "truncate",
      "whitespace-nowrap",
    );
  });

  it("centers folder titles while keeping single-line ellipsis", () => {
    render(
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
      />,
    );

    expect(screen.getByTitle(folder.name)).toHaveClass(
      "text-center",
      "truncate",
      "whitespace-nowrap",
    );

    const titleRow = screen.getByTitle(folder.name).closest("div");
    const moreButton = screen.getByRole("button", { name: "更多操作" });

    expect(titleRow).toHaveClass("items-center");
    expect(moreButton).toHaveClass("top-1/2", "-translate-y-1/2");
  });
});
