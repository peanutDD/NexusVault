import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useState, type MouseEventHandler, type PointerEventHandler } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fileListService } from "../../../services/fileListService";
import { tagsService } from "../../../services/tags";
import { computeCollapsedChipVisibility } from "./FileListCollectionChipsLayout";
import FileListSelectionBar from "./FileListSelectionBar";

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
  collectionsExpanded,
  currentFolderId = null,
  searchQuery = "",
  mimeType = "",
  onCollectionsExpandedChange,
  onBoundaryClick,
  onBoundaryPointerDown,
  onBoundaryPointerUp,
  onBoundaryMouseDown,
  onBoundaryMouseUp,
}: {
  showBatchActions?: boolean;
  selectedFileCount?: number;
  selectedFolderCount?: number;
  onCollectionChange?: (value: string) => void;
  onResetFilters?: () => void;
  onTagChange?: (value: string) => void;
  activeCollection?: string;
  activeTagId?: string;
  collectionsExpanded?: boolean;
  currentFolderId?: string | null;
  searchQuery?: string;
  mimeType?: string;
  onCollectionsExpandedChange?: (value: boolean) => void;
  onBoundaryClick?: MouseEventHandler<HTMLDivElement>;
  onBoundaryPointerDown?: PointerEventHandler<HTMLDivElement>;
  onBoundaryPointerUp?: PointerEventHandler<HTMLDivElement>;
  onBoundaryMouseDown?: MouseEventHandler<HTMLDivElement>;
  onBoundaryMouseUp?: MouseEventHandler<HTMLDivElement>;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <div
        data-testid="file-list-selection-event-boundary"
        onClick={onBoundaryClick}
        onPointerDown={onBoundaryPointerDown}
        onPointerUp={onBoundaryPointerUp}
        onMouseDown={onBoundaryMouseDown}
        onMouseUp={onBoundaryMouseUp}
      >
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
          collectionsExpanded={collectionsExpanded}
          currentFolderId={currentFolderId}
          searchQuery={searchQuery}
          mimeType={mimeType}
          onCollectionsExpandedChange={onCollectionsExpandedChange}
          onCollectionChange={onCollectionChange}
          onResetFilters={onResetFilters}
          onTagChange={onTagChange}
        />
      </div>
    </QueryClientProvider>,
  );
  return { ...result, queryClient };
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

  it("uses one raised shell for statistics, collections, and selection actions", () => {
    const { container } = renderSelectionBar();
    const shell = container.querySelector(".fileListSelectionGroup");
    const allFiles = screen.getByLabelText("All Files").closest(".all-files-bar");

    expect(shell).toHaveClass(
      "neu-raised",
      "fileListSelectionShell",
      "fileListSelectionUnifiedSurface",
    );
    expect(allFiles).toHaveClass("fileListSelectionSegment");
    expect(allFiles).not.toHaveClass("neu-raised", "neu-inset");
  });

  it("renders raised collection chips directly below the statistics row", async () => {
    vi.mocked(tagsService.list).mockResolvedValue([
      { id: "tag-1", name: "Work", color: "#8b5cf6" },
    ]);
    renderSelectionBar();

    const allFiles = screen.getByLabelText("All Files").closest(".all-files-bar");
    const shelf = screen.getByTestId("file-list-collection-chips");
    const rail = screen.getByTestId("file-list-collections");
    const reset = screen.getByRole("button", { name: "重置筛选" });
    const all = screen.getByRole("button", { name: "全部" });

    expect(allFiles?.nextElementSibling).toBe(shelf);
    expect(shelf).toContainElement(rail);
    expect(reset).toHaveClass("neu-inset");
    expect(all).toHaveClass("neu-inset", "neu-pressed");
    expect(await screen.findByRole("button", { name: /标签：Work/i })).toHaveClass(
      "neu-inset",
    );
  });

  it("localizes collections and exposes counts and threshold explanations", async () => {
    vi.mocked(tagsService.list).mockResolvedValue([
      { id: "tag-s", name: "s", color: "#8b5cf6" },
    ]);
    vi.mocked(fileListService.getCollectionCounts).mockResolvedValue({
      collections: { favorites: 2, recent: 1, large: 3, duplicates: 4 },
      tags: { "tag-s": 6 },
    });

    renderSelectionBar({ activeCollection: "recent", activeTagId: "tag-s" });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /收藏/ })).toHaveTextContent("2");
    });
    expect(screen.getByRole("button", { name: /最近/ })).toHaveAttribute(
      "title",
      expect.stringContaining("最近 7 天"),
    );
    expect(screen.getByRole("button", { name: /大文件/ })).toHaveTextContent(
      "100MB+",
    );
    expect(screen.getByRole("button", { name: /重复/ })).toHaveAttribute(
      "title",
      expect.stringContaining("content_sha256"),
    );
    expect(await screen.findByRole("button", { name: /标签：s/ })).toHaveClass(
      "neu-pressed",
      "fileListCollectionChipActive",
    );
  });

  it("loads counts in the current folder, search, and MIME scope", async () => {
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
    expect(screen.getByLabelText("当前文件夹")).toBeInTheDocument();
  });

  it("loads counts in the root folder scope instead of account-wide counts", async () => {
    vi.mocked(tagsService.list).mockResolvedValue([]);

    renderSelectionBar({
      currentFolderId: null,
      searchQuery: "111",
      mimeType: "image/",
    });

    await waitFor(() => {
      expect(fileListService.getCollectionCounts).toHaveBeenCalledWith({
        folder_id: "root",
        search: "111",
        mime_type: "image/",
      });
    });
    expect(screen.getByLabelText("All Files")).toBeInTheDocument();
  });

  it("refetches counts after file metadata invalidates the collection query", async () => {
    vi.mocked(tagsService.list).mockResolvedValue([]);
    vi.mocked(fileListService.getCollectionCounts)
      .mockResolvedValueOnce({ collections: { favorites: 1 }, tags: {} })
      .mockResolvedValueOnce({ collections: { favorites: 2 }, tags: {} });
    const { queryClient } = renderSelectionBar();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /收藏/ })).toHaveTextContent("1");
    });
    await queryClient.invalidateQueries({ queryKey: ["file-collection-counts"] });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /收藏/ })).toHaveTextContent("2");
    });
  });

  it("calculates collapsed chips without partially exposing the next chip", () => {
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
        containerWidth: 230,
        chipWidths: [42, 84, 96],
        gap: 10,
        toggleWidth: 64,
      }),
    ).toEqual({ hasOverflow: true, visibleCount: 2 });
  });

  it("routes collection, tag, and reset clicks through Files navigation callbacks", async () => {
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
    expect(onResetFilters).toHaveBeenCalledOnce();
  });

  it("keeps the expanded collection rail open when clicking a chip", async () => {
    const user = userEvent.setup();
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function getRect(this: HTMLElement) {
        if (this.getAttribute("data-testid") === "file-list-collection-chips") {
          return {
            width: 230,
            height: 40,
            top: 0,
            right: 230,
            bottom: 40,
            left: 0,
            x: 0,
            y: 0,
            toJSON: () => {},
          } as DOMRect;
        }
        if (this.classList.contains("fileListCollectionMoreButton")) {
          return {
            width: 72,
            height: 28,
            top: 0,
            right: 72,
            bottom: 28,
            left: 0,
            x: 0,
            y: 0,
            toJSON: () => {},
          } as DOMRect;
        }
        if (
          this.hasAttribute("data-chip-measure-index") ||
          this.closest("[data-chip-measure-index]")
        ) {
          return {
            width: 86,
            height: 28,
            top: 0,
            right: 86,
            bottom: 28,
            left: 0,
            x: 0,
            y: 0,
            toJSON: () => {},
          } as DOMRect;
        }
        return {
          width: 0,
          height: 0,
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          x: 0,
          y: 0,
          toJSON: () => {},
        } as DOMRect;
      });
    const onTagChange = vi.fn();
    vi.mocked(tagsService.list).mockResolvedValue([
      { id: "tag-1", name: "Work", color: "#8b5cf6" },
    ]);

    try {
      renderSelectionBar({ onTagChange });

      const toggle = await screen.findByRole("button", { name: "更多筛选" });
      await user.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "true");

      await user.click(await screen.findByRole("button", { name: /标签：Work/i }));

      expect(onTagChange).toHaveBeenCalledWith("tag-1");
      expect(toggle).toHaveAttribute("aria-expanded", "true");
    } finally {
      rectSpy.mockRestore();
    }
  });

  it("restores the expanded collection rail after a filter reload remount", async () => {
    const user = userEvent.setup();
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function getRect(this: HTMLElement) {
        if (this.getAttribute("data-testid") === "file-list-collection-chips") {
          return {
            width: 230,
            height: 40,
            top: 0,
            right: 230,
            bottom: 40,
            left: 0,
            x: 0,
            y: 0,
            toJSON: () => {},
          } as DOMRect;
        }
        if (this.classList.contains("fileListCollectionMoreButton")) {
          return {
            width: 72,
            height: 28,
            top: 0,
            right: 72,
            bottom: 28,
            left: 0,
            x: 0,
            y: 0,
            toJSON: () => {},
          } as DOMRect;
        }
        if (
          this.hasAttribute("data-chip-measure-index") ||
          this.closest("[data-chip-measure-index]")
        ) {
          return {
            width: 86,
            height: 28,
            top: 0,
            right: 86,
            bottom: 28,
            left: 0,
            x: 0,
            y: 0,
            toJSON: () => {},
          } as DOMRect;
        }
        return {
          width: 0,
          height: 0,
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          x: 0,
          y: 0,
          toJSON: () => {},
        } as DOMRect;
      });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    function RemountingSelectionBarHarness() {
      const [mounted, setMounted] = useState(true);
      const [activeCollection, setActiveCollection] = useState("");
      const [collectionsExpanded, setCollectionsExpanded] = useState(false);

      if (!mounted) {
        return (
          <button type="button" onClick={() => setMounted(true)}>
            完成加载
          </button>
        );
      }

      return (
        <FileListSelectionBar
          showBatchActions={false}
          isRevalidating={false}
          allFilesSelected={false}
          selectedFileCount={0}
          selectedFolderCount={0}
          totalText="total:1 files"
          batchDownloading={false}
          onToggleSelectAll={noop}
          onBatchMove={noop}
          onBatchShare={noop}
          onBatchDownload={noop}
          onBatchDelete={noop}
          activeCollection={activeCollection}
          collectionsExpanded={collectionsExpanded}
          onCollectionsExpandedChange={setCollectionsExpanded}
          onCollectionChange={(value) => {
            setActiveCollection(value);
            setMounted(false);
          }}
          onResetFilters={noop}
          onTagChange={noop}
        />
      );
    }

    try {
      render(
        <QueryClientProvider client={queryClient}>
          <RemountingSelectionBarHarness />
        </QueryClientProvider>,
      );

      const toggle = await screen.findByRole("button", { name: "更多筛选" });
      await user.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "true");

      await user.click(screen.getByRole("button", { name: "收藏" }));
      await user.click(screen.getByRole("button", { name: "完成加载" }));

      const restoredToggle = await screen.findByRole("button", {
        name: "收起筛选",
      });
      expect(restoredToggle).toHaveAttribute("aria-expanded", "true");
    } finally {
      rectSpy.mockRestore();
    }
  });

  it("stops every visible collection chip gesture before it reaches the collapse boundary", () => {
    const onBoundaryPointerDown = vi.fn();
    const onBoundaryPointerUp = vi.fn();
    const onBoundaryMouseDown = vi.fn();
    const onBoundaryMouseUp = vi.fn();
    const onBoundaryClick = vi.fn();
    renderSelectionBar({
      onBoundaryClick,
      onBoundaryMouseDown,
      onBoundaryMouseUp,
      onBoundaryPointerDown,
      onBoundaryPointerUp,
    });

    for (const chip of [
      screen.getByRole("button", { name: "重置筛选" }),
      screen.getByRole("button", { name: "全部" }),
      screen.getByRole("button", { name: "收藏" }),
    ]) {
      fireEvent.pointerDown(chip);
      fireEvent.mouseDown(chip);
      fireEvent.pointerUp(chip);
      fireEvent.mouseUp(chip);
      fireEvent.click(chip);
    }
    const chipText = screen.getByRole("button", { name: "收藏" }).querySelector("span");
    expect(chipText).not.toBeNull();
    fireEvent.pointerDown(chipText!);
    fireEvent.mouseDown(chipText!);
    fireEvent.pointerUp(chipText!);
    fireEvent.mouseUp(chipText!);
    fireEvent.click(chipText!);

    expect(onBoundaryPointerDown).not.toHaveBeenCalled();
    expect(onBoundaryPointerUp).not.toHaveBeenCalled();
    expect(onBoundaryMouseDown).not.toHaveBeenCalled();
    expect(onBoundaryMouseUp).not.toHaveBeenCalled();
    expect(onBoundaryClick).not.toHaveBeenCalled();
  });

  it("keeps hidden measurement chips inert while preserving chip widths", () => {
    renderSelectionBar();

    const measurementButtons = Array.from(
      screen
        .getByTestId("file-list-collection-chips")
        .querySelectorAll("[data-chip-measure-index] button"),
    );

    expect(measurementButtons.length).toBeGreaterThan(0);
    for (const button of measurementButtons) {
      expect(button).toHaveAttribute("tabindex", "-1");
      expect(button).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("marks a collection chip pressed immediately on pointer down", () => {
    renderSelectionBar();
    const images = screen.getByRole("button", { name: "图片" });

    expect(images).not.toHaveClass("neu-pressed");
    fireEvent.pointerDown(images);
    expect(images).toHaveClass("neu-pressed", "fileListCollectionChipActive");
  });

  it("clears a single selected collection chip highlight after reset", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    function StatefulSelectionBar() {
      const [activeCollection, setActiveCollection] = useState("");

      return (
        <QueryClientProvider client={queryClient}>
          <FileListSelectionBar
            showBatchActions={false}
            isRevalidating={false}
            allFilesSelected={false}
            selectedFileCount={0}
            selectedFolderCount={0}
            totalText="total:2 folders · 4 files"
            batchDownloading={false}
            onToggleSelectAll={noop}
            onBatchMove={noop}
            onBatchShare={noop}
            onBatchDownload={noop}
            onBatchDelete={noop}
            activeCollection={activeCollection}
            onCollectionChange={setActiveCollection}
            onResetFilters={() => setActiveCollection("")}
            onTagChange={noop}
          />
        </QueryClientProvider>
      );
    }

    render(<StatefulSelectionBar />);

    const duplicates = screen.getByRole("button", { name: "重复" });
    fireEvent.pointerDown(duplicates);
    fireEvent.click(duplicates);
    expect(screen.getByRole("button", { name: "重复" })).toHaveClass(
      "fileListCollectionChipActive",
    );

    fireEvent.click(screen.getByRole("button", { name: "重置筛选" }));

    expect(screen.getByRole("button", { name: "重复" })).not.toHaveClass(
      "fileListCollectionChipActive",
    );
    expect(screen.getByRole("button", { name: "全部" })).toHaveClass(
      "fileListCollectionChipActive",
    );
  });

  it("uses pressed square checkboxes for selected state", () => {
    const { unmount } = renderSelectionBar();
    const unchecked = screen
      .getByLabelText("All Files")
      .closest("label")
      ?.querySelector(".fileListAllFilesCheckbox");

    expect(unchecked).toHaveClass(
      "filelist-check-control",
      "fileListAllFilesCheckboxUnchecked",
    );

    unmount();
    renderSelectionBar({ selectedFileCount: 1 });
    const selected = screen
      .getByLabelText("All Files")
      .closest("label")
      ?.querySelector(".fileListAllFilesCheckbox");

    expect(selected).toHaveClass(
      "filelist-check-control",
      "fileListAllFilesCheckboxSelected",
    );
  });

  it("fuses batch actions into the raised selection shell", () => {
    const { container } = renderSelectionBar({
      showBatchActions: true,
      selectedFileCount: 2,
      selectedFolderCount: 1,
    });
    const shell = container.querySelector(".fileListSelectionFusionGroup");
    const actions = container.querySelector(".batch-actions-bar");

    expect(shell).toHaveClass("neu-raised", "fileListSelectionFusionGroup");
    expect(actions).toHaveClass("fileListSelectionSegment");
    expect(actions).not.toHaveClass("neu-raised");
    for (const name of [
      "Batch Move",
      "Batch Share",
      "Batch Download ZIP",
      "Batch Delete",
    ]) {
      expect(screen.getByRole("button", { name })).toHaveClass(
        "neu-raised-sm",
        "batchActionBtn",
      );
    }
  });

  it("keeps the file selection skin theme-neutral and free of legacy layers", () => {
    const css = readFileSync(resolve(__dirname, "FileListGlass.css"), "utf8");
    const source = readFileSync(
      resolve(__dirname, "FileListSelectionBar.tsx"),
      "utf8",
    );

    expect(source).toContain("neu-raised fileListSelectionGroup");
    expect(css).toContain(".filelist-check-control");
    expect(css).toContain("background: var(--neu-inset-bg)");
    expect(css).toContain("box-shadow: var(--neu-inset-shadow)");
    expect(css).toContain("background: var(--neu-primary)");
    expect(css).toContain("--filelist-check-radius");
    expect(css).toContain("box-shadow: none");
    expect(css).not.toContain("linear-gradient");
    expect(css).not.toContain("backdrop-filter");
    expect(css).not.toContain(".neuromorphic-style");
    expect(css).not.toContain(":root.dark");
  });

  it("does not clip raised batch action shadows", () => {
    renderSelectionBar({
      showBatchActions: true,
      selectedFileCount: 2,
      selectedFolderCount: 1,
    });
    const strip = screen
      .getByRole("button", { name: "Batch Move" })
      .closest(".batchActionButtonsRow");
    const css = readFileSync(resolve(__dirname, "FileListGlass.css"), "utf8")
      .replace(/\s+/g, " ");

    expect(strip).toHaveClass("overflow-visible");
    expect(strip).not.toHaveClass("overflow-x-auto");
    expect(css).toContain(".batchActionButtonsRow");
    expect(css).toContain("overflow: visible");
    expect(css).toContain("background: transparent");
    expect(css).toContain("padding-inline: clamp(");
  });
});
