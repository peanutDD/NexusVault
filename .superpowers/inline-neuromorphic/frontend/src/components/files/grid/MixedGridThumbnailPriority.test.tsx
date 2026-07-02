import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FileMetadata } from "../../../types/files";
import type { Folder } from "../../../types/folders";
import MixedGrid from "./MixedGrid";

vi.mock("./FileCard", () => ({
  default: ({
    file,
    thumbnailPriority,
  }: {
    file: FileMetadata;
    thumbnailPriority?: "high" | "low";
  }) => (
    <article
      data-testid={`file-${file.id}`}
      data-thumbnail-priority={thumbnailPriority ?? ""}
    />
  ),
}));

vi.mock("./FolderCard", () => ({
  default: ({ folder }: { folder: Folder }) => (
    <article data-testid={`folder-${folder.id}`} />
  ),
}));

const file: FileMetadata = {
  id: "file-1",
  filename: "file-1.png",
  original_filename: "file-1.png",
  file_size: 68,
  mime_type: "image/png",
  category: "image",
  folder_id: null,
  created_at: "2026-06-14T02:40:41.000Z",
};

const folder: Folder = {
  id: "folder-1",
  name: "Folder 1",
  parent_id: null,
  created_at: "2026-06-14T02:40:41.000Z",
  updated_at: "2026-06-14T02:40:41.000Z",
};

describe("MixedGrid thumbnail priority", () => {
  it("eagerly loads first-screen file thumbnails in mixed root and folder grids", () => {
    const { getByTestId } = render(
      <MixedGrid
        items={[
          { type: "folder", folder },
          { type: "file", file },
        ]}
        selectedFiles={new Set()}
        selectedFolders={new Set()}
        onSelectFile={vi.fn()}
        onSelectFolder={vi.fn()}
        onOpenFolder={vi.fn()}
        onPreviewFile={vi.fn()}
        onShareFile={vi.fn()}
        onDownloadFile={vi.fn()}
        onRenameFolder={vi.fn()}
        onRenameFile={vi.fn()}
        onDelete={vi.fn()}
        onFileDragStart={vi.fn()}
        onDropOnFolder={vi.fn()}
        openFileMenuId={null}
        openFolderMenuId={null}
        onToggleFileMenu={vi.fn()}
        onToggleFolderMenu={vi.fn()}
        onCloseMenu={vi.fn()}
      />,
    );

    expect(getByTestId("file-file-1")).toHaveAttribute(
      "data-thumbnail-priority",
      "high",
    );
  });
});
