import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import FileList from "./FileList";

const handleDropOnFolder = vi.fn();
const selectedFiles = new Set(["file-1", "file-2"]);
const selectedFolders = new Set(["folder-1"]);
const selectedFileIds = ["file-1", "file-2"];
const selectedFolderIds = ["folder-1"];
const observedDropHandlers: Array<
  (folderId: string, fileIds: string[], folderIds: string[]) => void
> = [];

vi.mock("../useFileList", () => ({
  useFileList: () => ({
    files: [],
    folderPath: [],
    search: "",
    mimeType: "all",
    sortBy: "created_at_desc",
    selectedFiles,
    selectedFolders,
    selectedFileIds,
    selectedFolderIds,
    currentFolderId: null,
    error: null,
    clearError: vi.fn(),
    isLoading: false,
    isRevalidating: false,
    isGroupByType: false,
    isGroupByTime: false,
    groupedFiles: null,
    timeGroupedItems: null,
    displayFolders: [],
    displayFiles: [],
    displayFileIndexById: new Map(),
    totalPages: 1,
    page: 1,
    hasMore: false,
    loadingMore: false,
    loadMore: vi.fn(),
    allFilesSelected: false,
    handleSearchChange: vi.fn(),
    handleMimeTypeChange: vi.fn(),
    handleSortChange: vi.fn(),
    toggleSelectAll: vi.fn(),
    handleSelectFile: vi.fn(),
    handleSelectFolder: vi.fn(),
    handleRenameFolder: vi.fn(),
    handleRenameFolderSubmit: vi.fn(),
    handleRenameFile: vi.fn(),
    handleRenameFileSubmit: vi.fn(),
    getOptimisticMoveRollback: vi.fn(),
    navigateToFolder: vi.fn(),
    handleDelete: vi.fn(),
    handleDownload: vi.fn(),
    handleBatchDownload: vi.fn(),
    handleBatchDelete: vi.fn(),
    handleShowBatchMove: vi.fn(),
    handleShowBatchShare: vi.fn(),
    handleDropOnFolder,
    handleDropOnBreadcrumb: vi.fn(),
    refreshListsAfterMove: vi.fn(),
    clearSelection: vi.fn(),
    addFolderToList: vi.fn(),
    previewFile: null,
    setPreviewFile: vi.fn(),
    shareFile: null,
    setShareFile: vi.fn(),
    showBatchShare: false,
    setShowBatchShare: vi.fn(),
    batchShareFileIds: [],
    setBatchShareFileIds: vi.fn(),
    showBatchMove: false,
    setShowBatchMove: vi.fn(),
    showCreateFolder: false,
    setShowCreateFolder: vi.fn(),
    renamingFolder: null,
    setRenamingFolder: vi.fn(),
    renamingFile: null,
    setRenamingFile: vi.fn(),
    deleteConfirm: null,
    deleteLoading: false,
    executeDelete: vi.fn(),
    setDeleteConfirm: vi.fn(),
    batchDownloading: false,
  }),
}));

vi.mock("../../../hooks/useThrottledCallback", () => ({
  useThrottledCallback: (fn: () => void) => fn,
}));

vi.mock("./FileListHeader", () => ({
  default: () => <div data-testid="file-list-header" />,
}));

vi.mock("./FileListDialogs", () => ({
  default: () => <div data-testid="file-list-dialogs" />,
}));

vi.mock("./FileListBackgroundLayer", () => ({
  default: () => <canvas data-testid="filelist-portfolio-fireworks-background" />,
}));

vi.mock("./FileListContent", () => ({
  default: ({
    handleDropOnFolder,
  }: {
    handleDropOnFolder: (
      folderId: string,
      fileIds: string[],
      folderIds: string[],
    ) => void;
  }) => {
    observedDropHandlers.push(handleDropOnFolder);
    return (
      <div>
        <button
          type="button"
          onClick={() => handleDropOnFolder("target-folder", ["file-1"], [])}
        >
          drop selected file
        </button>
        <button
          type="button"
          onClick={() =>
            handleDropOnFolder("target-folder", [], ["folder-1"])
          }
        >
          drop selected folder
        </button>
        <button
          type="button"
          onClick={() => handleDropOnFolder("target-folder", ["file-3"], [])}
        >
          drop unselected file
        </button>
      </div>
    );
  },
}));

describe("FileList batch drag move", () => {
  it("places fireworks above the file-list Neuromorphic background and below foreground controls", async () => {
    const { container } = render(<FileList />);

    const surface = container.querySelector(".fileListSurfaceScope");
    expect(surface).toHaveClass("neu-flat", "relative", "isolate");
    expect(screen.getByTestId("filelist-background-effect-layer")).toHaveClass(
      "pointer-events-none",
      "fixed",
      "inset-0",
      "z-0",
    );
    expect(screen.getByTestId("filelist-portfolio-fireworks-background")).toBeInTheDocument();
    expect(screen.getByTestId("filelist-foreground-layer")).toHaveClass("relative", "z-10");
    expect(await screen.findByTestId("file-list-header")).toBeInTheDocument();
  });

  it("forwards dragged file ids to the action layer", async () => {
    handleDropOnFolder.mockClear();
    const user = userEvent.setup();
    render(<FileList />);

    await user.click(await screen.findByText("drop selected file"));

    await waitFor(() => {
      expect(handleDropOnFolder).toHaveBeenCalledWith(
        "target-folder",
        ["file-1"],
        [],
      );
    });
  });

  it("forwards dragged folder ids to the action layer", async () => {
    handleDropOnFolder.mockClear();
    const user = userEvent.setup();
    render(<FileList />);

    await user.click(await screen.findByText("drop selected folder"));

    await waitFor(() => {
      expect(handleDropOnFolder).toHaveBeenCalledWith(
        "target-folder",
        [],
        ["folder-1"],
      );
    });
  });

  it("keeps an unselected dragged file as a single-item move", async () => {
    handleDropOnFolder.mockClear();
    const user = userEvent.setup();
    render(<FileList />);

    await user.click(await screen.findByText("drop unselected file"));

    await waitFor(() => {
      expect(handleDropOnFolder).toHaveBeenCalledWith(
        "target-folder",
        ["file-3"],
        [],
      );
    });
  });

  it("keeps the folder drop adapter stable across parent renders", () => {
    observedDropHandlers.length = 0;
    const { rerender } = render(<FileList />);
    rerender(<FileList />);

    expect(observedDropHandlers).toHaveLength(2);
    expect(observedDropHandlers[1]).toBe(observedDropHandlers[0]);
  });
});
