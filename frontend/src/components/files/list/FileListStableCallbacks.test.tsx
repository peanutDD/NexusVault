import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import FileListGroupedView from "./FileListGroupedView";
import FileListVirtualScroller from "./FileListVirtualScroller";
import type { FileMetadata } from "../../../types/files";
import type { Folder } from "../../../types/folders";

const captured = vi.hoisted(() => ({
  fileGridDrops: [] as Array<unknown>,
  fileGridPreviews: [] as Array<unknown>,
  virtualFileGridDrops: [] as Array<unknown>,
}));

vi.mock("../grid/FileGrid", () => ({
  default: (props: {
    onMobileFileDrop?: (targetFolderId: string, sourceFileId: string) => void;
    onPreview?: (file: FileMetadata) => void;
  }) => {
    captured.fileGridDrops.push(props.onMobileFileDrop);
    captured.fileGridPreviews.push(props.onPreview);
    return <div data-testid="file-grid" />;
  },
}));

vi.mock("../grid/VirtualizedFileGrid", () => ({
  default: (props: {
    onMobileFileDrop?: (targetFolderId: string, sourceFileId: string) => void;
  }) => {
    captured.virtualFileGridDrops.push(props.onMobileFileDrop);
    return <div data-testid="virtual-file-grid" />;
  },
}));

vi.mock("../grid/FolderGrid", () => ({
  default: () => <div data-testid="folder-grid" />,
}));

vi.mock("../grid/MixedGrid", () => ({
  default: () => <div data-testid="mixed-grid" />,
}));

const file: FileMetadata = {
  id: "file-1",
  filename: "file.txt",
  original_filename: "file.txt",
  file_size: 100,
  mime_type: "text/plain",
  category: null,
  folder_id: null,
  created_at: "2026-05-07T00:00:00Z",
};

const folder: Folder = {
  id: "folder-1",
  name: "Folder",
  parent_id: null,
  created_at: "2026-05-07T00:00:00Z",
  updated_at: "2026-05-07T00:00:00Z",
};

const baseGroupedProps = {
  mode: "type",
  groupedFiles: [{ key: "docs", label: "Docs", icon: null, files: [file] }],
  timeGroupedItems: null,
  displayFolders: [],
  selectedFiles: new Set<string>(),
  selectedFolders: new Set<string>(),
  openFileMenuId: null,
  openFolderMenuId: null,
  onSelectFile: vi.fn(),
  onSelectFolder: vi.fn(),
  onOpenFolder: vi.fn(),
  onRenameFolder: vi.fn(),
  onRenameFile: vi.fn(),
  onDelete: vi.fn(),
  onDownload: vi.fn(),
  onFileDragStart: vi.fn(),
  onDropOnFolder: vi.fn(),
  onPreviewFile: vi.fn(),
  onShareFile: vi.fn(),
  onToggleFileMenu: vi.fn(),
  onToggleFolderMenu: vi.fn(),
  onCloseMenu: vi.fn(),
} satisfies ComponentProps<typeof FileListGroupedView>;

const baseScrollerProps = {
  isPlainSort: false,
  shouldUseVirtualList: false,
  listKey: "plain",
  mixedItems: [],
  files: [file],
  displayFolders: [folder],
  selectedFiles: new Set<string>(),
  selectedFolders: new Set<string>(),
  openFileMenuId: null,
  openFolderMenuId: null,
  onSelectFile: vi.fn(),
  onSelectFolder: vi.fn(),
  onOpenFolder: vi.fn(),
  onPreviewFile: vi.fn(),
  onShareFile: vi.fn(),
  onDownloadFile: vi.fn(),
  onRenameFolder: vi.fn(),
  onRenameFile: vi.fn(),
  onDelete: vi.fn(),
  onFileDragStart: vi.fn(),
  onDropOnFolder: vi.fn(),
  onToggleFileMenu: vi.fn(),
  onToggleFolderMenu: vi.fn(),
  onCloseMenu: vi.fn(),
} satisfies ComponentProps<typeof FileListVirtualScroller>;

describe("file-list memo callback stability", () => {
  it("renders the pinned file group before folders and ordinary type groups", () => {
    const pinnedFile = { ...file, id: "pinned-file", is_pinned: true };

    render(
      <FileListGroupedView
        {...baseGroupedProps}
        displayFolders={[folder]}
        groupedFiles={[
          { key: "pinned", label: "Pinned", icon: null, files: [pinnedFile] },
          { key: "docs", label: "Docs", icon: null, files: [file] },
        ]}
      />,
    );

    const pinned = screen.getByText("Pinned");
    const folders = screen.getByText("FOLDERS");
    const docs = screen.getByText("Docs");

    expect(pinned.compareDocumentPosition(folders)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(folders.compareDocumentPosition(docs)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("keeps grouped FileGrid callbacks stable across parent renders", () => {
    captured.fileGridDrops = [];
    captured.fileGridPreviews = [];

    const { rerender } = render(<FileListGroupedView {...baseGroupedProps} />);
    const firstDrop = captured.fileGridDrops.at(-1);
    const firstPreview = captured.fileGridPreviews.at(-1);

    rerender(
      <FileListGroupedView {...baseGroupedProps} openFileMenuId="file-1" />,
    );

    expect(captured.fileGridDrops.at(-1)).toBe(firstDrop);
    expect(captured.fileGridPreviews.at(-1)).toBe(firstPreview);
  });

  it("keeps virtual scroller file drop callbacks stable across parent renders", () => {
    captured.fileGridDrops = [];
    captured.virtualFileGridDrops = [];

    const { rerender } = render(
      <FileListVirtualScroller {...baseScrollerProps} />,
    );
    const firstGridDrop = captured.fileGridDrops.at(-1);

    rerender(
      <FileListVirtualScroller
        {...baseScrollerProps}
        openFileMenuId="file-1"
      />,
    );

    expect(captured.fileGridDrops.at(-1)).toBe(firstGridDrop);

    rerender(
      <FileListVirtualScroller
        {...baseScrollerProps}
        shouldUseVirtualList
        openFileMenuId="file-1"
      />,
    );
    const firstVirtualDrop = captured.virtualFileGridDrops.at(-1);

    rerender(
      <FileListVirtualScroller
        {...baseScrollerProps}
        shouldUseVirtualList
      />,
    );

    expect(captured.virtualFileGridDrops.at(-1)).toBe(firstVirtualDrop);
  });
});
