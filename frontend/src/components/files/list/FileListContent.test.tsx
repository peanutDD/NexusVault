import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FileMetadata } from "../../../types/files";
import type { SortOption } from "../../../hooks/files/useFileFilters";
import FileListContent from "./FileListContent";

vi.mock("./FileListVirtualScroller", () => ({
  default: () => <div data-testid="virtual-scroller" />,
}));

vi.mock("./FileListSelectionBar", () => ({
  default: () => <div data-testid="selection-bar" />,
}));

vi.mock("./FileListPagination", () => ({
  default: () => <div data-testid="pagination" />,
}));

vi.mock("../InfiniteScrollSentinel", () => ({
  default: () => <div data-testid="sentinel" />,
}));

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

function renderContent(sortBy: SortOption) {
  return render(
    <FileListContent
      files={[file]}
      selectedFiles={new Set()}
      selectedFolders={new Set()}
      currentFolderId={null}
      sortBy={sortBy}
      error={null}
      isLoading={false}
      isRevalidating={false}
      isGroupByType={false}
      isGroupByTime={false}
      groupedFiles={null}
      timeGroupedItems={null}
      displayFolders={[]}
      totalPages={1}
      page={1}
      hasMore={false}
      loadingMore={false}
      loadMore={vi.fn()}
      allFilesSelected={false}
      toggleSelectAll={vi.fn()}
      handleSelectFile={vi.fn()}
      handleSelectFolder={vi.fn()}
      handleOpenFolder={vi.fn()}
      handleRenameFolder={vi.fn()}
      handleRenameFile={vi.fn()}
      handleDelete={vi.fn()}
      handleDownload={vi.fn()}
      handleBatchDownload={vi.fn()}
      handleBatchDelete={vi.fn()}
      handleShowBatchMove={vi.fn()}
      handleShowBatchShare={vi.fn()}
      handleFileDragStart={vi.fn()}
      handleDropOnFolder={vi.fn()}
      setPreviewFile={vi.fn()}
      setShareFile={vi.fn()}
      batchDownloading={false}
    />,
  );
}

describe("FileListContent", () => {
  it.each<SortOption>([
    "created_at_desc",
    "created_at_asc",
    "filename_asc",
    "filename_desc",
    "file_size_desc",
    "file_size_asc",
  ])("reserves top hover space for plain sort %s", (sortBy) => {
    renderContent(sortBy);

    expect(screen.getByTestId("virtual-scroller").parentElement).toHaveClass(
      "pt-[clamp(0.2rem,0.7vw,0.25rem)]",
    );
  });
});
