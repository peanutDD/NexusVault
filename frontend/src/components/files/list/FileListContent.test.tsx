import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import type { FileMetadata } from "../../../types/files";
import type { SortOption } from "../../../hooks/files/useFileFilters";
import { tagsService } from "../../../services/tags";
import { appQueryClient } from "../../../providers/queryClient";
import FileListContent from "./FileListContent";

vi.mock("./FileListVirtualScroller", () => ({
  default: ({
    files,
    onToggleFavorite,
    onTogglePinned,
  }: {
    files: FileMetadata[];
    onToggleFavorite: (file: FileMetadata) => void;
    onTogglePinned: (file: FileMetadata) => void;
  }) => (
    <div data-testid="virtual-scroller">
      {files.map((item) => (
        <div key={item.id}>
          <span>{item.id}</span>
          <span>{item.is_pinned ? "Pinned now" : "Not pinned"}</span>
          <span>{item.is_favorite ? "Favorite now" : "Not favorite"}</span>
          <button type="button" onClick={() => onTogglePinned(item)}>
            Toggle pinned
          </button>
          <button type="button" onClick={() => onToggleFavorite(item)}>
            Toggle favorite
          </button>
        </div>
      ))}
    </div>
  ),
}));

vi.mock("./FileListSelectionBar", () => ({
  default: () => <div data-testid="selection-bar" />,
}));

vi.mock("./FileListGroupedView", () => ({
  default: ({
    mode,
    groupedFiles,
    timeGroupedItems,
    onToggleFavorite,
    onTogglePinned,
  }: {
    mode: "type" | "time";
    groupedFiles: Array<{ key: string; label: string; files: FileMetadata[] }> | null;
    timeGroupedItems:
      | Array<{
          key: string;
          label: string;
          files: FileMetadata[];
          items: Array<{ type: "file"; file: FileMetadata } | { type: "folder" }>;
        }>
      | null;
    onToggleFavorite: (file: FileMetadata) => void;
    onTogglePinned: (file: FileMetadata) => void;
  }) => (
    <div data-testid={`grouped-view-${mode}`}>
      {groupedFiles?.map((group) => (
        <section key={group.key}>
          <h2>{group.label}</h2>
          {group.files.map((item) => (
            <div key={item.id}>
              <span>{item.id}</span>
              <span>{item.is_pinned ? "Pinned now" : "Not pinned"}</span>
              <span>{item.is_favorite ? "Favorite now" : "Not favorite"}</span>
              <button type="button" onClick={() => onTogglePinned(item)}>
                Toggle pinned
              </button>
              <button type="button" onClick={() => onToggleFavorite(item)}>
                Toggle favorite
              </button>
            </div>
          ))}
        </section>
      ))}
      {timeGroupedItems?.map((group) => (
        <section key={group.key}>
          <h2>{group.label}</h2>
          {group.items.map((item) =>
            item.type === "file" ? (
              <div key={item.file.id}>
                <span>{item.file.id}</span>
                <span>{item.file.is_pinned ? "Pinned now" : "Not pinned"}</span>
              </div>
            ) : null,
          )}
        </section>
      ))}
    </div>
  ),
}));

vi.mock("./FileListPagination", () => ({
  default: () => <div data-testid="pagination" />,
}));

vi.mock("../InfiniteScrollSentinel", () => ({
  default: () => <div data-testid="sentinel" />,
}));

vi.mock("../../../services/tags", () => ({
  tagsService: {
    updateFlags: vi.fn().mockResolvedValue({}),
  },
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

function renderContent(
  sortBy: SortOption,
  searchProps: Partial<ComponentProps<typeof FileListContent>> = {},
) {
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
      {...searchProps}
    />,
  );
}

function renderEmptyFolder() {
  return render(
    <FileListContent
      files={[]}
      selectedFiles={new Set()}
      selectedFolders={new Set()}
      currentFolderId="folder-1"
      sortBy="created_at_desc"
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

function renderFilteredEmptyFolder() {
  return render(
    <FileListContent
      files={[]}
      selectedFiles={new Set()}
      selectedFolders={new Set()}
      currentFolderId="folder-1"
      sortBy="created_at_desc"
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
      activeCollection="videos"
      activeTagId="tag-s"
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

  it("keeps pinned files in a top group for the mobile plain All Files list", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 430,
    });
    const pinnedFile = {
      ...file,
      id: "pinned-file",
      filename: "pinned-file.jpg",
      original_filename: "pinned-file.jpg",
      is_pinned: true,
    };
    const regularFile = {
      ...file,
      id: "regular-file",
      filename: "regular-file.jpg",
      original_filename: "regular-file.jpg",
    };

    renderContent("created_at_desc", {
      files: [regularFile, pinnedFile],
      activeCollection: "",
    });

    expect(screen.getByTestId("grouped-view-type")).toHaveTextContent("Pinned");
    expect(screen.getByTestId("grouped-view-type")).toHaveTextContent("pinned-file");
    expect(screen.getByTestId("virtual-scroller")).toHaveTextContent("regular-file");
    expect(screen.getByTestId("virtual-scroller")).not.toHaveTextContent("pinned-file");
  });

  it("keeps pinned files in a top group for the mobile time-grouped All Files list", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 430,
    });
    const pinnedFile = {
      ...file,
      id: "pinned-file",
      filename: "pinned-file.jpg",
      original_filename: "pinned-file.jpg",
      is_pinned: true,
    };
    const regularFile = {
      ...file,
      id: "regular-file",
      filename: "regular-file.jpg",
      original_filename: "regular-file.jpg",
    };

    renderContent("time_group", {
      files: [regularFile, pinnedFile],
      isGroupByTime: true,
      activeCollection: "",
      timeGroupedItems: [
        {
          key: "2026-05-03",
          label: "May 3, 2026",
          sortKey: 20260503,
          files: [pinnedFile, regularFile],
          folders: [],
          items: [
            { type: "file", file: pinnedFile },
            { type: "file", file: regularFile },
          ],
        },
      ],
    });

    expect(screen.getByTestId("grouped-view-type")).toHaveTextContent("Pinned");
    expect(screen.getByTestId("grouped-view-type")).toHaveTextContent("pinned-file");
    expect(screen.getByTestId("grouped-view-time")).toHaveTextContent("May 3, 2026");
    expect(screen.getByTestId("grouped-view-time")).toHaveTextContent("regular-file");
    expect(screen.getByTestId("grouped-view-time")).not.toHaveTextContent("pinned-file");
  });

  it("marks the empty folder state for neuromorphic surface styling", () => {
    renderEmptyFolder();

    expect(screen.getByText("文件夹为空")).toHaveClass("emptyStateTitle");
    expect(screen.getByText("拖拽文件到此处或创建子文件夹")).toHaveClass(
      "emptyStateDescription",
    );
    expect(screen.getByTestId("empty-state")).toHaveClass(
      "emptyStateSurface",
      "glass-panel-soft",
    );
    expect(
      screen.getByTestId("empty-state").querySelector(".emptyStateIconShell"),
    ).toBeInTheDocument();
  });

  it("keeps the selection chip rail visible when active filters return no files", () => {
    renderFilteredEmptyFolder();

    expect(screen.getByTestId("selection-bar")).toBeInTheDocument();
    expect(screen.getByText("没有匹配的文件")).toHaveClass("emptyStateTitle");
    expect(screen.getByText("调整筛选条件后再试")).toHaveClass(
      "emptyStateDescription",
    );
    expect(screen.queryByText("文件夹为空")).not.toBeInTheDocument();
  });

  it("renders fulltext search status and source chips", () => {
    renderContent("created_at_desc", {
      searchQuery: "invoice",
      searchMetadata: {
        index_status: "ready",
        count: 1,
        ocr: {
          enabled: true,
          pdf_max_pages: 8,
          tesseract_available: true,
          poppler_available: true,
        },
      },
    });

    expect(screen.getByTestId("search-status-surface")).toHaveClass(
      "fileListSearchStatusSurface",
    );
    expect(screen.getByTestId("search-status-copy")).toHaveClass(
      "fileListSearchStatusWell",
    );
    expect(screen.getByTestId("search-status-sources")).toHaveClass(
      "fileListSearchStatusRail",
    );
    expect(screen.getByText("Fulltext search")).toBeInTheDocument();
    expect(screen.getByText('1 results for "invoice"')).toBeInTheDocument();
    expect(screen.getByText("Search can match in")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Text")).toBeInTheDocument();
    expect(screen.getByText("OCR")).toBeInTheDocument();
    expect(screen.getByText("Tag")).toBeInTheDocument();
  });

  it("explains filename-only fallback when OCR text indexing is still catching up", () => {
    renderContent("created_at_desc", {
      searchQuery: "2059",
      searchMetadata: {
        index_status: "fallback",
        count: 9,
        ocr: {
          enabled: true,
          pdf_max_pages: 8,
          tesseract_available: false,
          poppler_available: false,
        },
      },
    });

    expect(screen.getByText("Filename matches only")).toBeInTheDocument();
    expect(
      screen.getByText(
        '9 results for "2059" · These matches currently come from filenames because OCR text indexing is not fully available yet.',
      ),
    ).toBeInTheDocument();
  });

  it("explains that single-character searches stay on filename matches for speed", () => {
    renderContent("created_at_desc", {
      searchQuery: "3",
      searchMetadata: {
        index_status: "fallback",
        count: 30,
        ocr: {
          enabled: true,
          pdf_max_pages: 8,
          tesseract_available: true,
          poppler_available: true,
        },
      },
    });

    expect(screen.getByText("Filename matches only")).toBeInTheDocument();
    expect(
      screen.getByText(
        '30 results for "3" · Single-character searches currently match filenames only so results stay fast. Type 2 or more characters to search OCR and file text.',
      ),
    ).toBeInTheDocument();
  });

  it("avoids claiming filename matches when fallback search returns zero results", () => {
    renderContent("created_at_desc", {
      searchQuery: "大疆",
      searchMetadata: {
        index_status: "fallback",
        count: 0,
        ocr: {
          enabled: true,
          pdf_max_pages: 8,
          tesseract_available: true,
          poppler_available: true,
        },
      },
    });

    expect(
      screen.getByText(
        '0 results for "大疆" · No filename matches were found for this query. Try a different keyword.',
      ),
    ).toBeInTheDocument();
  });

  it("shows pinned and favorite state immediately after toggling file flags", async () => {
    const user = userEvent.setup();
    vi.mocked(tagsService.updateFlags).mockResolvedValue(undefined);
    renderContent("created_at_desc");

    expect(screen.getByText("Not pinned")).toBeInTheDocument();
    expect(screen.getByText("Not favorite")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Toggle pinned" }));
    await user.click(screen.getByRole("button", { name: "Toggle favorite" }));

    expect(screen.getByText("Pinned now")).toBeInTheDocument();
    expect(screen.getByText("Favorite now")).toBeInTheDocument();
    await waitFor(() => {
      expect(tagsService.updateFlags).toHaveBeenCalledWith("file-1", {
        is_pinned: true,
      });
      expect(tagsService.updateFlags).toHaveBeenCalledWith("file-1", {
        is_favorite: true,
      });
    });
  });

  it("invalidates smart collection counts after toggling favorite or pinned flags", async () => {
    const user = userEvent.setup();
    const invalidateSpy = vi.spyOn(appQueryClient, "invalidateQueries");
    vi.mocked(tagsService.updateFlags).mockResolvedValue(undefined);
    renderContent("created_at_desc");

    await user.click(screen.getByRole("button", { name: "Toggle pinned" }));
    await user.click(screen.getByRole("button", { name: "Toggle favorite" }));

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["file-collection-counts"],
      });
    });
    invalidateSpy.mockRestore();
  });

  it("maps the empty state to neuromorphic raised and inset primitives", () => {
    const css = readFileSync(
      resolve(__dirname, "FileListGlass.css"),
      "utf8",
    ).replace(/\s+/g, " ");

    expect(css).toContain(
      ".neuromorphic-style .fileListGlassScope .emptyStateSurface",
    );
    expect(css).toContain(
      ".neuromorphic-style .fileListGlassScope .emptyStateIconShell",
    );
    expect(css).toContain(
      ".neuromorphic-style .fileListGlassScope .emptyStateTitle",
    );
    expect(css).toContain(
      ".neuromorphic-style .fileListGlassScope .emptyStateDescription",
    );
    expect(css).toContain("background: var(--neu-raised-bg)");
    expect(css).toContain("box-shadow: var(--neu-surface-shadow)");
    expect(css).toContain("min-height: clamp(13rem, 40dvh, 24rem)");
    expect(css).toContain("margin-bottom: clamp(1.5rem, 4vw, 3rem)");
    expect(css).toContain("background: var(--neu-inset-bg)");
    expect(css).toContain("box-shadow: var(--neu-inset-shadow)");
    expect(css).toContain("backdrop-filter: none");
    expect(css).toContain("color: var(--color-text-primary)");
    expect(css).toContain("color: var(--color-text-secondary)");
  });

  it("maps the search status rail to fluid inset neuromorphic primitives", () => {
    const css = readFileSync(
      resolve(__dirname, "FileListGlass.css"),
      "utf8",
    ).replace(/\s+/g, " ");

    expect(css).toContain(".fileListGlassScope .fileListSearchStatusSurface");
    expect(css).toContain(".fileListGlassScope .fileListSearchStatusShell");
    expect(css).toContain(".fileListGlassScope .fileListSearchStatusWell");
    expect(css).toContain(".fileListGlassScope .fileListSearchStatusRail");
    expect(css).toContain(".fileListGlassScope .fileListSearchStatusChips");
    expect(css).toContain(".neuromorphic-style .fileListGlassScope .fileListSearchStatusSurface");
    expect(css).toContain(".neuromorphic-style .fileListGlassScope .fileListSearchStatusWell");
    expect(css).toContain(".neuromorphic-style .fileListGlassScope .fileListSearchStatusRail");
    expect(css).toContain("background: var(--neu-inset-bg)");
    expect(css).toContain("box-shadow: var(--neu-inset-shadow)");
    expect(css).toContain("grid-template-columns: repeat(auto-fit, minmax(min(100%, clamp(14rem, 28vw, 18rem)), 1fr));");
  });

  it("keeps search status typography compact on mobile", () => {
    const css = readFileSync(
      resolve(__dirname, "FileListGlass.css"),
      "utf8",
    ).replace(/\s+/g, " ");

    expect(css).toContain(
      "@media (max-width: 640px), (hover: none) and (pointer: coarse)",
    );
    expect(css).toContain(
      ".fileListGlassScope .fileListSearchStatusTitle { font-size: var(--font-size-ui-xs);",
    );
    expect(css).toContain(
      ".fileListGlassScope .fileListSearchStatusDescription { font-size: var(--font-size-ui-3xs);",
    );
    expect(css).toContain(
      ".fileListGlassScope .fileListSearchStatusCaption { font-size: var(--font-size-ui-5xs);",
    );
    expect(css).toContain(
      ".fileListGlassScope .fileListSearchStatusChip { font-size: var(--font-size-ui-4xs);",
    );
  });

  it("maps the light theme empty state to the same neuromorphic primitives", () => {
    const css = readFileSync(
      resolve(__dirname, "FileListGlass.css"),
      "utf8",
    ).replace(/\s+/g, " ");

    expect(css).toContain(
      '[data-theme="light"] .fileListGlassScope .emptyStateSurface',
    );
    expect(css).toContain(
      '[data-theme="light"] .fileListGlassScope .emptyStateIconShell',
    );
    expect(css).toContain(
      '[data-theme="light"] .fileListGlassScope .emptyStateTitle',
    );
    expect(css).toContain(
      '[data-theme="light"] .fileListGlassScope .emptyStateDescription',
    );
  });

  it("lets the Light theme runtime class opt into Neuromorphic homepage surfaces", () => {
    const css = readFileSync(
      resolve(__dirname, "FileListGlass.css"),
      "utf8",
    ).replace(/\s+/g, " ");

    expect(css).toContain(
      ".neuromorphic-style .fileListGlassScope .glass-card",
    );
    expect(css).toContain(
      ".neuromorphic-style .fileListGlassScope .toolbarActionBtn",
    );
    expect(css).toContain(
      ".neuromorphic-style .fileListGlassScope .filelist-check-control",
    );
  });
});
