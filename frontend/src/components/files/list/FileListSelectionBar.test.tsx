import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FileListSelectionBar from "./FileListSelectionBar";
import { computeCollapsedChipVisibility } from "./FileListCollectionChipsLayout";
import { fileListService } from "../../../services/fileListService";
import { tagsService } from "../../../services/tags";

const noop = vi.fn();

vi.mock("../../../services/tags", () => ({
  tagsService: {
    list: vi.fn(),
  },
}));

vi.mock("../../../services/fileListService", () => ({
  FILE_COLLECTION_COUNTS_QUERY_KEY: ["file-collection-counts"],
  fileListService: {
    getCollectionCounts: vi.fn(),
  },
}));

function renderSelectionBar({
  showBatchActions = false,
  selectedFileCount = 0,
  selectedFolderCount = 0,
  onCollectionChange = noop,
  onResetFilters = noop,
  onTagChange = noop,
  activeCollection = "",
  activeTagId = "",
  currentFolderId = null,
  searchQuery = "",
  mimeType = "",
}: {
  showBatchActions?: boolean;
  selectedFileCount?: number;
  selectedFolderCount?: number;
  onCollectionChange?: (value: string) => void;
  onResetFilters?: () => void;
  onTagChange?: (value: string) => void;
  activeCollection?: string;
  activeTagId?: string;
  currentFolderId?: string | null;
  searchQuery?: string;
  mimeType?: string;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <FileListSelectionBar
        showBatchActions={showBatchActions}
        isRevalidating={false}
        allFilesSelected={selectedFileCount + selectedFolderCount > 0}
        selectedFileCount={selectedFileCount}
        selectedFolderCount={selectedFolderCount}
        totalText="total:2 folders · 4 files"
        batchDownloading={false}
        onToggleSelectAll={noop}
        onBatchMove={noop}
        onBatchShare={noop}
        onBatchDownload={noop}
        onBatchDelete={noop}
        activeCollection={activeCollection}
        activeTagId={activeTagId}
        currentFolderId={currentFolderId}
        searchQuery={searchQuery}
        mimeType={mimeType}
        onCollectionChange={onCollectionChange}
        onResetFilters={onResetFilters}
        onTagChange={onTagChange}
      />
    </QueryClientProvider>,
  );
  return { ...result, queryClient };
}

function readFileListGlassRule(selector: string) {
  const css = readFileSync(resolve(__dirname, "FileListGlass.css"), "utf8");
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`));
  return match?.[1].replace(/\s+/g, " ").trim() ?? "";
}

function readLastFileListGlassRule(selector: string) {
  const css = readFileSync(resolve(__dirname, "FileListGlass.css"), "utf8");
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = Array.from(
    css.matchAll(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`, "g")),
  );
  return matches.at(-1)?.[1].replace(/\s+/g, " ").trim() ?? "";
}

describe("FileListSelectionBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(tagsService.list).mockReturnValue(new Promise(() => {}));
    vi.mocked(fileListService.getCollectionCounts).mockResolvedValue({
      collections: {},
      tags: {},
    });
  });

  it("wraps idle statistics and filters in one opaque neuromorphic surface", () => {
    const { container } = renderSelectionBar();

    const allFilesShell = screen.getByLabelText("All Files").closest(".all-files-bar");
    const shell = container.querySelector(".fileListSelectionGroup");

    expect(shell).toHaveClass(
      "glass-panel",
      "glass-panel-toolbar",
      "fileListSelectionShell",
      "fileListSelectionUnifiedSurface",
    );
    expect(allFilesShell).toHaveClass("fileListSelectionSegment");
    expect(allFilesShell).not.toHaveClass(
      "glass-panel",
      "glass-panel-toolbar",
      "glass-panel-soft",
      "fileListSelectionShell",
    );
  });

  it("renders collection chips directly below the All Files statistics container", async () => {
    vi.mocked(tagsService.list).mockResolvedValue([
      { id: "tag-1", name: "Work", color: "#8b5cf6" },
    ]);
    renderSelectionBar();

    const allFilesShell = screen.getByLabelText("All Files").closest(".all-files-bar");
    const shelf = screen.getByTestId("file-list-collection-chips");
    const chips = screen.getByTestId("file-list-collections");

    expect(allFilesShell?.nextElementSibling).toBe(shelf);
    expect(shelf).toContainElement(chips);
    expect(shelf).toHaveClass(
      "fileListCollectionShelf",
      "grid",
      "w-full",
      "max-w-full",
      "min-w-0",
      "grid-cols-[minmax(0,1fr)_auto]",
      "items-center",
      "overflow-visible",
    );
    expect(chips).toHaveClass(
      "fileListCollectionChipRail",
      "flex",
      "min-w-0",
      "items-center",
    );
    expect(chips).toHaveClass("h-[clamp(1.83rem,3.9vw,2.22rem)]");
    expect(chips).not.toHaveClass("max-h-[clamp(1.83rem,3.9vw,2.22rem)]");
    expect(chips).not.toHaveClass("max-h-[clamp(1.74rem,3.5vw,2.05rem)]");

    expect(screen.getByRole("button", { name: "全部" })).toHaveClass(
      "fileListCollectionChipCompact",
    );
    const resetButton = screen.getByRole("button", { name: "重置筛选" });
    const allButton = screen.getByRole("button", { name: "全部" });
    expect(
      Array.from(chips.querySelectorAll("button")).slice(0, 2).map((button) =>
        button.getAttribute("aria-label"),
      ),
    ).toEqual(["重置筛选", "全部"]);
    expect(resetButton).toHaveClass("glass-chip");
    expect(allButton).toHaveClass("glass-chip", "fileListCollectionChipActive");
    expect(resetButton.compareDocumentPosition(allButton)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.getByRole("button", { name: "重复" })).toHaveClass(
      "glass-chip",
    );
    const tagButton = await screen.findByRole("button", { name: /标签：Work/i });
    expect(tagButton).toHaveClass("glass-chip");
    expect(tagButton).not.toHaveClass(
      "fileListCollectionBadgeTone-primary",
      "fileListCollectionChipCodepen",
    );

    expect(screen.queryByRole("button", { name: "更多筛选" })).not.toBeInTheDocument();
  });

  it("keeps the More or Less control as a shelf sibling outside the chip rail", async () => {
    const rect = (width: number): DOMRect =>
      ({
        x: 0,
        y: 0,
        width,
        height: 34,
        top: 0,
        left: 0,
        right: width,
        bottom: 34,
        toJSON: () => ({}),
      }) as DOMRect;
    const measuredWidths = [46, 58, 76, 72, 86, 94, 82, 78, 80, 76, 86, 88];
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function getMockRect(this: HTMLElement) {
        if (this.dataset.testid === "file-list-collection-chips") return rect(236);
        if (this.dataset.testid === "file-list-collections") return rect(172);
        if (this.hasAttribute("data-chip-measure-index")) {
          return rect(measuredWidths[Number(this.dataset.chipMeasureIndex)] ?? 72);
        }
        if (this.classList.contains("fileListCollectionMoreButton")) return rect(64);
        return rect(0);
      });
    vi.mocked(tagsService.list).mockResolvedValue([
      { id: "tag-1", name: "Work", color: "#8b5cf6" },
    ]);
    vi.mocked(fileListService.getCollectionCounts).mockResolvedValue({
      collections: {
        favorites: 1,
        pinned: 1,
        recent: 400,
        untagged: 2967,
        large: 12,
        duplicates: 61,
        images: 2132,
        pdfs: 4,
        videos: 622,
      },
      tags: {
        "tag-1": 1,
      },
    });

    try {
      renderSelectionBar();

      const shelf = screen.getByTestId("file-list-collection-chips");
      const chips = screen.getByTestId("file-list-collections");
      const moreButton = await screen.findByRole("button", { name: "更多筛选" });

      expect(moreButton.parentElement).toBe(shelf);
      expect(moreButton.parentElement).not.toBe(chips);
      expect(shelf).toHaveClass("grid-cols-[minmax(0,1fr)_auto]");
      expect(chips).not.toContainElement(moreButton);
      expect(moreButton).toHaveClass("fileListCollectionMoreButton");
    } finally {
      rectSpy.mockRestore();
    }
  });

  it("localizes smart collections and explains counts, thresholds, tags, and hash based duplicates", async () => {
    vi.mocked(tagsService.list).mockResolvedValue([
      { id: "tag-s", name: "s", color: "#8b5cf6" },
    ]);
    vi.mocked(fileListService.getCollectionCounts).mockResolvedValue({
      collections: {
        favorites: 2,
        recent: 1,
        large: 3,
        duplicates: 4,
        images: 5,
      },
      tags: {
        "tag-s": 6,
      },
    });

    renderSelectionBar({ activeCollection: "recent,images", activeTagId: "tag-s" });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /收藏/ })).toHaveTextContent("2");
    });
    expect(screen.getByRole("button", { name: /全部/ })).toHaveTextContent("全部");
    expect(screen.getByRole("button", { name: "重置筛选" })).toHaveTextContent("重置");
    expect(screen.getByRole("button", { name: /收藏/ })).toHaveTextContent("2");
    expect(screen.getByRole("button", { name: /最近/ })).toHaveAttribute(
      "title",
      expect.stringContaining("最近 7 天"),
    );
    expect(screen.getByRole("button", { name: /大文件/ })).toHaveTextContent("100MB+");
    expect(screen.getByRole("button", { name: /大文件/ })).toHaveTextContent("3");
    expect(screen.getByRole("button", { name: /重复/ })).toHaveAttribute(
      "title",
      expect.stringContaining("content_sha256"),
    );
    expect(await screen.findByRole("button", { name: /标签：s/ })).toHaveTextContent("6");
    expect(screen.getByRole("button", { name: /最近/ })).toHaveClass(
      "fileListCollectionChipActive",
    );
    expect(screen.getByRole("button", { name: /图片/ })).toHaveClass(
      "fileListCollectionChipActive",
    );
    expect(screen.getByRole("button", { name: /标签：s/ })).toHaveClass(
      "fileListCollectionChipActive",
    );
  });

  it("uses the pre-CodePen glass chip treatment for collection chips and tags", async () => {
    vi.mocked(tagsService.list).mockResolvedValue([
      { id: "tag-s", name: "s", color: "#8b5cf6" },
    ]);
    vi.mocked(fileListService.getCollectionCounts).mockResolvedValue({
      collections: {
        images: 2201,
      },
      tags: {
        "tag-s": 1,
      },
    });

    renderSelectionBar({ activeCollection: "images", activeTagId: "tag-s" });

    const imageChip = screen.getByRole("button", { name: /图片/ });
    const tagChip = await screen.findByRole("button", { name: /标签：s/ });
    expect(imageChip).toHaveClass(
      "glass-chip",
      "fileListCollectionChip",
      "fileListCollectionChipActive",
    );
    expect(imageChip).not.toHaveClass(
      "fileListCollectionChipCodepen",
      "fileListCollectionBadgeTone-info",
    );
    expect(tagChip).toHaveClass(
      "glass-chip",
      "fileListCollectionChip",
      "fileListCollectionChipActive",
    );
    expect(tagChip).not.toHaveClass(
      "fileListCollectionChipCodepen",
      "fileListCollectionBadgeTone-primary",
    );
    expect(tagChip.querySelector(".fileListCollectionTagDot")).toBeInTheDocument();

    const css = readFileSync(resolve(__dirname, "FileListGlass.css"), "utf8").replace(/\s+/g, " ");
    expect(css).not.toContain("fileListCollectionChipCodepen");
    expect(css).not.toContain("fileListCollectionBadgeTone-");
    expect(css).toContain(".neuromorphic-style .fileListGlassScope .fileListCollectionChip");
    expect(css).toContain("color-mix(in srgb, var(--neu-inset-bg) 92%, var(--neu-shadow-light))");
    expect(css).toContain("inset 0.24em 0.24em 0.56em color-mix(in srgb, var(--neu-shadow-dark) 86%, transparent)");
    expect(css).toContain("color: var(--neu-primary)");
    expect(css).toContain("transition: none");
    expect(css).toContain(".neuromorphic-style .fileListGlassScope .fileListCollectionChip:active");
    expect(css).toContain(".neuromorphic-style .fileListGlassScope .fileListCollectionChipActive");
    expect(css).toContain("var(--neu-primary), var(--neu-primary-dark)");
    expect(css).toContain("inset 0.24em 0.24em 0.56em rgba(var(--rgb-black), 0.28)");
    expect(css).toContain(".neuromorphic-style .fileListGlassScope .fileListCollectionChipCount");
    expect(css).toContain("color-mix(in srgb, var(--neu-inset-bg) 74%, var(--neu-shadow-dark))");
    expect(css).toContain(".neuromorphic-style .fileListGlassScope .fileListCollectionTagDot");
  });

  it("loads chip counts in the current folder, search, and type scope", async () => {
    vi.mocked(tagsService.list).mockResolvedValue([]);

    renderSelectionBar({
      currentFolderId: "folder-1",
      searchQuery: "clip",
      mimeType: "video/",
    });

    await waitFor(() => {
      expect(fileListService.getCollectionCounts).toHaveBeenCalledWith({
        folder_id: "folder-1",
        search: "clip",
        mime_type: "video/",
      });
    });
  });

  it("marks selection and chip counts as scoped to the current folder", async () => {
    vi.mocked(tagsService.list).mockResolvedValue([]);

    renderSelectionBar({
      currentFolderId: "folder-1",
    });

    expect(screen.getByLabelText("当前文件夹")).toBeInTheDocument();
    expect(screen.getByText("当前文件夹")).toBeInTheDocument();
    await waitFor(() => {
      expect(fileListService.getCollectionCounts).toHaveBeenCalledWith({
        folder_id: "folder-1",
        search: "",
        mime_type: "",
      });
    });
  });

  it("refetches chip counts after file metadata mutations invalidate the counts query", async () => {
    vi.mocked(tagsService.list).mockResolvedValue([]);
    vi.mocked(fileListService.getCollectionCounts)
      .mockResolvedValueOnce({
        collections: { favorites: 1 },
        tags: {},
      })
      .mockResolvedValueOnce({
        collections: { favorites: 2 },
        tags: {},
      });
    const { queryClient } = renderSelectionBar();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /收藏/ })).toHaveTextContent("1");
    });

    await queryClient.invalidateQueries({ queryKey: ["file-collection-counts"] });

    await waitFor(() => {
      expect(fileListService.getCollectionCounts).toHaveBeenCalledTimes(2);
      expect(screen.getByRole("button", { name: /收藏/ })).toHaveTextContent("2");
    });
  });

  it("shows More only when measured chip widths do not fit", () => {
    expect(
      computeCollapsedChipVisibility({
        containerWidth: 720,
        chipWidths: [40, 92, 78, 82, 102, 74],
        gap: 8,
        toggleWidth: 72,
      }),
    ).toEqual({ hasOverflow: false, visibleCount: 6 });

    expect(
      computeCollapsedChipVisibility({
        containerWidth: 236,
        chipWidths: [40, 92, 78, 102],
        gap: 8,
        toggleWidth: 72,
      }),
    ).toEqual({ hasOverflow: true, visibleCount: 2 });
  });

  it("hides a chip that would only be partially visible until filters expand", () => {
    expect(
      computeCollapsedChipVisibility({
        containerWidth: 230,
        chipWidths: [42, 84, 96],
        gap: 10,
        toggleWidth: 64,
      }),
    ).toEqual({ hasOverflow: true, visibleCount: 2 });
  });

  it("sends collection, tag, and reset chip clicks to the Files query navigation callbacks", async () => {
    const user = userEvent.setup();
    const onCollectionChange = vi.fn();
    const onResetFilters = vi.fn();
    const onTagChange = vi.fn();
    vi.mocked(tagsService.list).mockResolvedValue([
      { id: "tag-1", name: "Work", color: "#8b5cf6" },
    ]);
    renderSelectionBar({
      activeCollection: "favorites,pinned",
      activeTagId: "tag-1",
      onCollectionChange,
      onResetFilters,
      onTagChange,
    });

    await user.click(screen.getByRole("button", { name: "置顶" }));
    await user.click(screen.getByRole("button", { name: "最近" }));
    await user.click(await screen.findByRole("button", { name: /标签：Work/i }));
    await user.click(screen.getByRole("button", { name: "重置筛选" }));

    expect(onCollectionChange).toHaveBeenCalledWith("pinned");
    expect(onCollectionChange).toHaveBeenCalledWith("recent");
    expect(onTagChange).toHaveBeenCalledWith("tag-1");
    expect(onResetFilters).toHaveBeenCalledTimes(1);
    expect(onCollectionChange).not.toHaveBeenCalledWith("");
    expect(onTagChange).not.toHaveBeenCalledWith("");
  });

  it("uses one outer glass shell for the fused selected state", () => {
    const { container } = renderSelectionBar({
      showBatchActions: true,
      selectedFileCount: 2,
      selectedFolderCount: 1,
    });

    const fusionShell = container.querySelector(".fileListSelectionFusionGroup");
    const batchShell = container.querySelector(".batch-actions-bar");

    expect(fusionShell).toHaveClass(
      "glass-panel",
      "glass-panel-toolbar",
      "fileListSelectionShell",
      "fileListSelectionFusionGroup",
    );
    expect(fusionShell).toHaveClass("fileListSelectionUnifiedSurface");
    expect(fusionShell?.querySelector(".all-files-bar")).toHaveClass(
      "fileListSelectionSegment",
    );
    expect(fusionShell?.querySelector(".all-files-bar")).not.toHaveClass(
      "glass-panel",
      "glass-panel-toolbar",
    );
    expect(batchShell).not.toHaveClass("glass-panel-soft");
    expect(batchShell).not.toHaveClass("glass-panel", "glass-panel-toolbar");
    expect(batchShell).toHaveClass("fileListSelectionSegment");
    expect(container.querySelector(".bars-integrated")).not.toBeInTheDocument();
    expect(screen.queryByText(/Already selected/i)).not.toBeInTheDocument();
  });

  it("marks the All Files statistics for centered neuromorphic surfaces", () => {
    renderSelectionBar({
      showBatchActions: true,
      selectedFileCount: 2,
      selectedFolderCount: 1,
    });

    expect(screen.getByTestId("filelist-selection-stats-row")).toHaveClass(
      "fileListSelectionStatsRow",
    );
    expect(screen.getByTestId("filelist-all-files-stat")).toHaveClass(
      "fileListSelectionStatChip",
      "fileListAllFilesStat",
    );
    expect(screen.getByTestId("filelist-selected-count-stat")).toHaveClass(
      "fileListSelectionStatChip",
      "fileListSelectedCountStat",
    );
    expect(screen.getByTestId("filelist-total-stat")).toHaveClass(
      "fileListSelectionStatChip",
      "fileListTotalStat",
    );
    expect(screen.queryByTestId("filelist-batch-summary-stat")).not.toBeInTheDocument();
    expect(screen.queryByText(/Already selected/i)).not.toBeInTheDocument();
  });

  it("keeps the total statistics text on a purple theme token instead of slate text", () => {
    const tokens = readFileSync(resolve(__dirname, "../../../styles/tokens.css"), "utf8")
      .replace(/\s+/g, " ");

    expect(tokens).toContain("--filelist-total-text: rgba(var(--rgb-purple-500), 0.96);");
    expect(tokens).toContain("--filelist-total-text: rgba(var(--rgb-purple-900), 0.9);");
    expect(tokens).toContain("--filelist-total-text: var(--neu-primary);");
  });

  it("renders the All Files checkbox with the same reference square treatment", () => {
    const { unmount } = renderSelectionBar();
    const uncheckedControl = screen
      .getByLabelText("All Files")
      .closest("label")
      ?.querySelector(".fileListAllFilesCheckbox");

    expect(uncheckedControl).toHaveClass("fileListAllFilesCheckboxUnchecked");
    expect(uncheckedControl).not.toHaveClass("fileListAllFilesCheckboxSelected");
    expect(uncheckedControl?.querySelector("i,svg")).toBeNull();
    expect(uncheckedControl?.textContent).toBe("");

    unmount();
    renderSelectionBar({ selectedFileCount: 1 });

    const selectedControl = screen
      .getByLabelText("All Files")
      .closest("label")
      ?.querySelector(".fileListAllFilesCheckbox");

    expect(selectedControl).toHaveClass("fileListAllFilesCheckboxSelected");
    expect(selectedControl?.querySelector("i,svg")).toBeNull();
    expect(selectedControl?.textContent).toBe("");
  });

  it("keeps unchecked selection squares distinguishable from the neuromorphic background", () => {
    const css = readFileSync(resolve(__dirname, "FileListGlass.css"), "utf8")
      .replace(/\s+/g, " ");

    expect(css).toContain(".fileListGroupSelectCheckboxUnchecked");
    expect(css).toContain(".fileListAllFilesCheckboxUnchecked");
    expect(css).toContain("var(--selection-check-unselected-surface)");
    expect(css).toContain("var(--selection-check-unselected-border)");
    expect(css).toContain("0 0 0 0.05em");
    expect(css).not.toContain("inset 0 0 0 0.08em color-mix(in srgb, var(--neu-shadow-light) 72%, var(--neu-inset-bg))");
  });

  it("uses a purple token ring for the unchecked All Files checkbox", () => {
    const uncheckedRule = readLastFileListGlassRule(
      ".neuromorphic-style .fileListGlassScope .fileListAllFilesCheckboxUnchecked",
    );
    const hoverRule = readLastFileListGlassRule(
      ".neuromorphic-style .fileListGlassScope .fileListAllFilesCheckboxUnchecked:hover",
    );

    expect(uncheckedRule).toContain("var(--neu-primary)");
    expect(uncheckedRule).toContain("var(--selection-check-unselected-border)");
    expect(uncheckedRule).toContain("0 0 0 0.05em color-mix(in srgb, var(--neu-primary)");
    expect(hoverRule).toContain("var(--neu-primary)");
    expect(hoverRule).toContain("var(--selection-check-unselected-border-hover)");
  });

  it("keeps the All Files checkbox visually smaller than group selection squares", () => {
    const css = readFileSync(resolve(__dirname, "FileListGlass.css"), "utf8")
      .replace(/\s+/g, " ");
    const allFilesRule = readLastFileListGlassRule(
      ".neuromorphic-style .fileListGlassScope .fileListAllFilesCheckbox",
    );

    expect(css).toContain(".fileListGroupSelectCheckbox");
    expect(css).toContain("width: clamp(1.2rem, 2.8vw, 1.5rem)");
    expect(allFilesRule).toContain("width: clamp(0.95rem, 1.5vw, 1.08rem)");
    expect(allFilesRule).toContain("height: clamp(0.95rem, 1.5vw, 1.08rem)");
    expect(allFilesRule).not.toContain("2.8vw");
  });

  it("locks the selection shells to the same material tokens as the search toolbar", () => {
    const rule = readFileListGlassRule(
      ".fileListGlassScope .glass-panel.glass-panel-toolbar.fileListSelectionShell",
    );

    expect(rule).toContain("border-radius: var(--bar-radius)");
    expect(rule).toContain("overflow: visible");
    expect(rule).toContain("border-color: var(--glass-border)");
    expect(rule).toContain("background:");
    expect(rule).toContain("var(--toolbar-bg-a)");
    expect(rule).toContain("var(--toolbar-bg-b)");
    expect(rule).toContain("box-shadow: none");
    expect(rule).not.toContain("var(--glass-shadow)");
    expect(rule).not.toContain("filelist-panel-glow");
  });

  it("removes the internal seam while keeping padding on the unified surface", () => {
    const rule = readFileListGlassRule(
      ".fileListGlassScope .fileListSelectionFusionGroup.glass-panel.glass-panel-toolbar.fileListSelectionShell",
    );
    const segmentRule = readFileListGlassRule(
      ".fileListGlassScope .fileListSelectionUnifiedSurface .fileListSelectionSegment",
    );

    expect(rule).toContain("padding-inline: var(--bar-px)");
    expect(rule).toContain("padding-block: var(--bar-py)");
    expect(segmentRule).toContain("padding: 0");
    expect(segmentRule).toContain("border: 0");
    expect(segmentRule).toContain("background: transparent");
  });

  it("renders the legacy filter shelf container around the chip rail", () => {
    const css = readFileSync(resolve(__dirname, "FileListGlass.css"), "utf8")
      .replace(/\s+/g, " ");

    expect(css).toContain(".fileListGlassScope .fileListCollectionShelf");
    expect(css).toContain("min-height: clamp(4.6rem, 5.4vw, 6.25rem)");
    expect(css).toContain("background: var(--neu-inset-bg)");
    expect(css).toContain("box-shadow: var(--neu-inset-shadow)");
    expect(css).not.toContain(".fileListGlassScope .fileListCollectionShelf::before");
    expect(css).not.toContain(".fileListGlassScope .fileListCollectionShelf::after");
    expect(css).toContain(".fileListGlassScope .fileListCollectionChipRail");
    expect(css).toContain("min-height: clamp(1.83rem, 3.9vw, 2.22rem)");
    expect(css).toContain("background: var(--neu-inset-bg)");
    expect(css).not.toContain("fileListCollectionBadgeTone-");
  });

  it("keeps the legacy neuromorphic glass chip treatment on the shelf", () => {
    const selectionShellRule = readFileListGlassRule(
      ".neuromorphic-style .fileListGlassScope .fileListSelectionShell",
    );
    const darkSelectionShellRule = readFileListGlassRule(
      ":root.dark.neuromorphic-style .fileListGlassScope .fileListSelectionShell",
    );
    const css = readFileSync(resolve(__dirname, "FileListGlass.css"), "utf8")
      .replace(/\s+/g, " ");
    const shelfRule = readFileListGlassRule(
      ".fileListGlassScope .fileListCollectionShelf",
    );
    const railRule = readFileListGlassRule(
      ".fileListGlassScope .fileListCollectionChipRail",
    );
    const baseChipRule = readFileListGlassRule(
      ".fileListGlassScope .fileListCollectionChip",
    );
    const neuChipRule = readFileListGlassRule(
      ".neuromorphic-style .fileListGlassScope .fileListCollectionChip",
    );

    expect(selectionShellRule).toContain("box-shadow: none");
    expect(selectionShellRule).toContain("background: var(--neu-raised-bg)");
    expect(selectionShellRule).not.toContain("var(--neu-raised-shadow)");
    expect(css).toContain("background: var(--neu-raised-bg) !important");
    expect(darkSelectionShellRule).toContain("box-shadow: none !important");
    expect(shelfRule).toContain("min-height: clamp(4.6rem, 5.4vw, 6.25rem)");
    expect(shelfRule).toContain("background: var(--neu-inset-bg)");
    expect(shelfRule).toContain("box-shadow: var(--neu-inset-shadow)");
    expect(railRule).toContain("background: var(--neu-inset-bg)");
    expect(railRule).toContain("box-shadow: none");
    expect(baseChipRule).toContain("background: var(--filelist-chip-bg)");
    expect(baseChipRule).toContain("box-shadow: var(--neu-raised-sm-shadow");
    expect(neuChipRule).toContain("var(--neu-inset-bg) 92%");
    expect(neuChipRule).toContain("inset 0.24em 0.24em 0.56em");
    expect(neuChipRule).not.toContain("px");
    expect(css).toContain(".neuromorphic-style .fileListGlassScope .fileListCollectionChip:active");
    expect(css).toContain(".neuromorphic-style .fileListGlassScope .fileListCollectionChipActive:hover");
    expect(css).toContain("var(--neu-primary), var(--neu-primary-dark)");
    expect(css).toContain("inset 0.24em 0.24em 0.56em rgba(var(--rgb-black), 0.28)");
  });

  it("marks collection chips active immediately on pointer down", () => {
    renderSelectionBar();

    const imagesChip = screen.getByRole("button", { name: "图片" });
    expect(imagesChip).not.toHaveClass("fileListCollectionChipActive");

    fireEvent.pointerDown(imagesChip);

    expect(imagesChip).toHaveClass("fileListCollectionChipActive");
  });

  it("does not apply badge success and warning overrides to More and Less toggles", () => {
    const moreRule = readFileListGlassRule(
      ".fileListGlassScope .fileListCollectionChipRail .fileListCollectionMoreButtonCollapsed",
    );
    const lessRule = readFileListGlassRule(
      ".fileListGlassScope .fileListCollectionChipRail .fileListCollectionMoreButtonExpanded",
    );

    expect(moreRule).not.toContain("#22c76a");
    expect(moreRule).not.toContain("#17ad55");
    expect(lessRule).not.toContain("#f0b90b");
    expect(lessRule).not.toContain("#dda006");
  });

  it("scopes CodePen raised cards and inset square checkboxes to neuromorphic", () => {
    const css = readFileSync(resolve(__dirname, "FileListGlass.css"), "utf8");

    expect(css).toContain('.neuromorphic-style .fileListGlassScope .glass-card');
    expect(css).toContain("background: var(--filelist-card-bg)");
    expect(css).toContain("box-shadow: var(--filelist-card-shadow)");
    expect(css).toContain('.neuromorphic-style .fileListGlassScope .filelist-check-control');
    expect(css).toContain("width: clamp(1.1rem, 1.7vw, 1.2rem)");
    expect(css).toContain("background: var(--filelist-check-bg)");
    expect(css).toContain("box-shadow: var(--filelist-check-shadow)");
    expect(css).toContain("border-radius: clamp(0.45rem, 0.9vw, 0.5rem)");
    expect(css).toContain("background: var(--filelist-check-bg-checked)");
    expect(css).not.toContain('.neuromorphic-style .fileListGlassScope .card-checkbox-unselected-ring');
  });

  it("marks every batch action button for the neuromorphic raised button treatment", () => {
    renderSelectionBar({
      showBatchActions: true,
      selectedFileCount: 2,
      selectedFolderCount: 1,
    });

    expect(screen.getByRole("button", { name: "Batch Move" })).toHaveClass(
      "batchActionBtn",
    );
    expect(screen.getByRole("button", { name: "Batch Share" })).toHaveClass(
      "batchActionBtn",
    );
    expect(screen.getByRole("button", { name: "Batch Download ZIP" })).toHaveClass(
      "batchActionBtn",
    );
    expect(screen.getByRole("button", { name: "Batch Delete" })).toHaveClass(
      "batchActionBtn",
    );
  });

  it("maps neuromorphic batch action buttons to CodePen raised buttons", () => {
    const css = readFileSync(resolve(__dirname, "FileListGlass.css"), "utf8");

    expect(css).toContain(
      '.neuromorphic-style .fileListGlassScope .batch-actions-bar .batchActionBtn',
    );
    expect(css).toContain("background: var(--neu-raised-bg)");
    expect(css).toContain("box-shadow: var(--neu-raised-sm-shadow)");
    expect(css).toContain("text-shadow: none");
    expect(css).toContain("box-shadow: var(--neu-pressed-shadow)");
  });

  it("maps neuromorphic selection statistics to raised and inset primitives", () => {
    const css = readFileSync(resolve(__dirname, "FileListGlass.css"), "utf8")
      .replace(/\s+/g, " ");

    expect(css).toContain(
      '.neuromorphic-style .fileListGlassScope .fileListSelectionShell',
    );
    expect(css).toContain(
      '.neuromorphic-style .fileListGlassScope .fileListSelectionStatsRow',
    );
    expect(css).toContain(
      '.neuromorphic-style .fileListGlassScope .fileListSelectionStatChip',
    );
    expect(css).toContain("background: var(--neu-raised-bg)");
    expect(css).toContain("box-shadow: var(--neu-raised-shadow)");
    expect(css).toContain("background: var(--neu-inset-bg)");
    expect(css).toContain("box-shadow: var(--neu-inset-shadow)");
    expect(css).toContain("color: var(--neu-primary)");
    expect(css).toContain("display: inline-flex");
    expect(css).toContain("align-items: center");
    expect(css).toContain("justify-content: center");
    expect(css).toContain("line-height: 1");
  });

  it("gives the neuromorphic selection shell an opaque backing over file cards", () => {
    const css = readFileSync(resolve(__dirname, "FileListGlass.css"), "utf8")
      .replace(/\s+/g, " ");

    expect(css).toContain(
      '.neuromorphic-style .fileListGlassScope .fileListSelectionShell::before',
    );
    expect(css).toContain('content: ""');
    expect(css).toContain("background: linear-gradient(145deg, var(--neu-bg-primary), var(--neu-bg-secondary))");
    expect(css).toContain("opacity: 1");
    expect(css).toContain("z-index: 0");
  });

  it("pins dark refresh selection shells to a bounded raised surface", () => {
    const css = readFileSync(resolve(__dirname, "FileListGlass.css"), "utf8")
      .replace(/\s+/g, " ");

    expect(css).toContain(
      ":root.dark.neuromorphic-style .fileListGlassScope .glass-panel.glass-panel-toolbar",
    );
    expect(css).toContain("background: var(--neu-raised-bg) !important");
    expect(css).toContain("box-shadow: var(--neu-raised-shadow) !important");
    expect(css).toContain("-webkit-backdrop-filter: none");
    expect(css).toContain(
      ":root.dark.neuromorphic-style .fileListGlassScope .fileListSelectionShell",
    );
    expect(css).toContain("position: relative");
    expect(css).toContain("overflow: hidden");
    expect(css).toContain("background: var(--neu-raised-bg) !important");
    expect(css).toContain("box-shadow: var(--neu-raised-shadow) !important");
    expect(css).toContain(
      ":root.dark.neuromorphic-style .fileListGlassScope .fileListSelectionShell::before",
    );
    expect(css).toContain("display: none");
  });

  it("does not clip batch action button shadows with a rectangular scroll frame", () => {
    renderSelectionBar({
      showBatchActions: true,
      selectedFileCount: 2,
      selectedFolderCount: 1,
    });

    const buttonStrip = screen
      .getByRole("button", { name: "Batch Move" })
      .closest(".batchActionButtonsRow");
    const buttonStripRule = readFileListGlassRule(
      ".fileListGlassScope .batch-actions-bar .batchActionButtonsRow",
    );

    expect(buttonStrip).toBeInTheDocument();
    expect(buttonStrip).not.toHaveClass("overflow-x-auto");
    expect(buttonStrip).toHaveClass("overflow-visible");
    expect(buttonStripRule).toContain("overflow: visible");
    expect(buttonStripRule).toContain("background: transparent");
    expect(buttonStripRule).toContain("padding-inline: clamp(");
  });
});
