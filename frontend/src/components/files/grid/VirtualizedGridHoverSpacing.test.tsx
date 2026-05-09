import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FileMetadata } from "../../../types/files";
import type { Folder } from "../../../types/folders";
import VirtualizedFileGrid from "./VirtualizedFileGrid";
import VirtualizedMixedGrid from "./VirtualizedMixedGrid";

vi.mock("./FileCard", () => ({
  default: ({ file }: { file: FileMetadata }) => (
    <article data-testid={`file-${file.id}`} />
  ),
}));

vi.mock("./FolderCard", () => ({
  default: ({ folder }: { folder: Folder }) => (
    <article data-testid={`folder-${folder.id}`} />
  ),
}));

vi.mock("../../../utils/pretextMeasure", () => ({
  buildRowModel: (items: unknown[]) => ({
    rowHeights: items.length > 0 ? [128] : [],
    prefixSums: items.length > 0 ? [0, 128] : [0],
  }),
  findStartRow: () => 0,
  findEndRow: () => 0,
}));

class ResizeObserverStub {
  observe = vi.fn();
  disconnect = vi.fn();
}

const file: FileMetadata = {
  id: "file-1",
  filename: "file-1.jpg",
  original_filename: "file-1.jpg",
  file_size: 1024,
  mime_type: "image/jpeg",
  category: "image",
  folder_id: null,
  created_at: "2026-05-03T08:00:00.000Z",
};

const folder: Folder = {
  id: "folder-1",
  name: "Folder 1",
  parent_id: null,
  created_at: "2026-05-03T08:00:00.000Z",
  updated_at: "2026-05-03T08:00:00.000Z",
};

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("virtualized grid hover spacing", () => {
  it("keeps hover headroom inside file rows", () => {
    const { container } = render(
      <VirtualizedFileGrid
        files={[file]}
        selectedFiles={new Set()}
        onSelect={vi.fn()}
        onPreview={vi.fn()}
        onShare={vi.fn()}
        onDownload={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onDragStart={vi.fn()}
        openFileMenuId={null}
        onToggleMenu={vi.fn()}
        onCloseMenu={vi.fn()}
      />,
    );

    expect(container.querySelector(".virtualized-row")).toHaveClass(
      "pt-[clamp(0.2rem,0.7vw,0.25rem)]",
      "mb-[clamp(0.4rem,1vw,0.5rem)]",
    );
  });

  it("keeps hover headroom inside mixed plain-sort rows", () => {
    const { container } = render(
      <VirtualizedMixedGrid
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

    expect(container.querySelector(".virtualized-row")).toHaveClass(
      "pt-[clamp(0.2rem,0.7vw,0.25rem)]",
      "mb-[clamp(0.4rem,1vw,0.5rem)]",
    );
  });
});
