import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Trash from "./Trash";
import { fileService } from "../services/files";
import { useAuthStore } from "../store/authStore";
import type { FileMetadata } from "../types/files";

vi.mock("../services/files", () => ({
  fileService: {
    listTrash: vi.fn(),
    restoreFile: vi.fn(),
    batchRestoreFiles: vi.fn(),
    permanentlyDeleteFile: vi.fn(),
    batchPermanentlyDeleteFiles: vi.fn(),
    emptyTrash: vi.fn(),
  },
}));

vi.mock("../components/layout/PageLayout", () => ({
  default: ({
    backgroundClassName,
    children,
  }: {
    backgroundClassName?: string;
    children: React.ReactNode;
  }) => (
    <div data-testid="page-layout" data-background-class-name={backgroundClassName}>
      {children}
    </div>
  ),
}));

vi.mock("../components/files/preview/LazyThumbnail", () => ({
  default: ({ filename }: { filename: string }) => (
    <img alt={filename} src="thumbnail://mock" />
  ),
}));

function FilesPageProbe() {
  const location = useLocation();
  return <div data-testid="files-page-probe">Files page {location.search}</div>;
}

function readFileListGlassRule(selector: string) {
  const css = readFileSync(
    resolve(__dirname, "../components/files/list/FileListGlass.css"),
    "utf8",
  );
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`));
  return match?.[1].replace(/\s+/g, " ").trim() ?? "";
}

function renderTrash({
  initialEntries,
  initialIndex,
}: {
  initialEntries?: React.ComponentProps<typeof MemoryRouter>["initialEntries"];
  initialIndex?: number;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={initialEntries ?? ["/trash"]}
        initialIndex={initialIndex}
      >
        <Routes>
          <Route path="/trash" element={<Trash />} />
          <Route path="/files" element={<FilesPageProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe.sequential("Trash page", () => {
  it("keeps the Trash console sticky despite the shared glass-panel position rule", () => {
    const fileListGlassCss = readFileSync(
      resolve(__dirname, "../components/files/list/FileListGlass.css"),
      "utf8",
    );

    expect(
      readFileListGlassRule(
        ".fileListGlassScope .glass-panel.glass-panel-toolbar.trashConsoleToolbar",
      ),
    ).toContain("position: sticky");
    expect(
      readFileListGlassRule(
        ".fileListGlassScope .glass-panel.glass-panel-toolbar.trashConsoleToolbar",
      ),
    ).toContain("z-index: var(--trash-console-z-index, 60)");
    expect(
      readFileListGlassRule(
        ".fileListGlassScope .glass-panel.glass-panel-toolbar.trashConsoleToolbar",
      ),
    ).toContain("opacity: var(--trash-console-opacity, 0.98)");
    expect(fileListGlassCss).toContain(
      "--trash-console-summary-mobile-scale: 1.2",
    );
    expect(fileListGlassCss).toContain(
      "transform: scale(var(--trash-console-summary-mobile-scale))",
    );
    expect(fileListGlassCss).toContain(
      "--trash-console-mobile-row-gap: clamp(1rem, 2vw, 2rem)",
    );
    expect(fileListGlassCss).toContain(
      "gap: var(--trash-console-mobile-row-gap)",
    );
    const trashConsoleButtonRule = readFileListGlassRule(
      ".fileListGlassScope .trashConsoleToolbar .glass-btn.toolbarActionBtn.trashConsoleButton",
    );
    expect(trashConsoleButtonRule).toContain(
      "box-shadow: inset 0 1px 0 rgba(var(--rgb-white), 0.18)",
    );
    expect(trashConsoleButtonRule).not.toContain("rgba(0, 0, 0, 0.3)");
    expect(trashConsoleButtonRule).not.toContain("0 clamp(");
    const trashConsoleActionsRule = readFileListGlassRule(
      ".fileListGlassScope .trashConsoleToolbar .trashConsoleActions",
    );
    expect(trashConsoleActionsRule).toContain("overflow: visible");
    expect(trashConsoleActionsRule).toContain("padding-inline: clamp(");
    expect(trashConsoleActionsRule).toContain("margin-inline: calc(");
  });

  it("maps the Trash console summary bar to neuromorphic inset and raised primitives", () => {
    const css = readFileSync(
      resolve(__dirname, "../components/files/list/FileListGlass.css"),
      "utf8",
    ).replace(/\s+/g, " ");

    expect(css).toContain(
      '.neuromorphic-style .fileListGlassScope .trashConsoleToolbar',
    );
    expect(css).toContain(
      '.neuromorphic-style .fileListGlassScope .trashConsoleSummaryRow',
    );
    expect(css).toContain(
      '.neuromorphic-style .fileListGlassScope .trashConsoleTitle',
    );
    expect(css).toContain(
      '.neuromorphic-style .fileListGlassScope .trashConsoleSummaryChip',
    );
    expect(css).toContain("background: var(--neu-inset-bg)");
    expect(css).toContain("box-shadow: var(--neu-inset-shadow)");
    expect(css).toContain("background: var(--neu-raised-bg)");
    expect(css).toContain("box-shadow: var(--neu-raised-sm-shadow)");
    expect(css).toContain("color: var(--neu-primary)");
  });

  it("maps the Trash empty state to explicit neuromorphic raised and inset primitives", () => {
    const css = readFileSync(
      resolve(__dirname, "../components/files/list/FileListGlass.css"),
      "utf8",
    ).replace(/\s+/g, " ");

    expect(css).toContain(
      '.neuromorphic-style .fileListGlassScope .trashEmptyState',
    );
    expect(css).toContain(
      '[data-theme="light"] .fileListGlassScope .trashEmptyState',
    );
    expect(css).toContain(
      '.neuromorphic-style .fileListGlassScope .trashEmptyState .emptyStateIconShell',
    );
    expect(css).toContain(
      '[data-theme="light"] .fileListGlassScope .trashEmptyState .emptyStateIconShell',
    );
    expect(css).toContain(
      '.neuromorphic-style .fileListGlassScope .trashEmptyState .emptyStateIconShell svg',
    );
    expect(css).toContain("background: var(--trash-panel-bg)");
    expect(css).toContain("box-shadow: var(--trash-panel-shadow)");
    expect(css).toContain("min-height: clamp(13rem, 40dvh, 24rem)");
    expect(css).toContain("margin-bottom: clamp(1.5rem, 4vw, 3rem)");
    expect(css).toContain("background: var(--trash-tech-panel-strong)");
    expect(css).toContain("box-shadow: var(--neu-inset-shadow)");
    expect(css).toContain("color: var(--trash-accent)");
  });

  beforeEach(() => {
    vi.resetAllMocks();
    useAuthStore.setState({
      user: {
        id: "user-1",
        username: "tyone",
        email: "tyone@test.com",
        created_at: "2026-05-01T00:00:00.000Z",
      },
      token: "token",
    });
  });

  const makeTrashFile = (id: string, originalFilename: string): FileMetadata => ({
    id,
    filename: originalFilename,
    original_filename: originalFilename,
    file_size: 128,
    mime_type: "text/plain",
    category: null,
    folder_id: null,
    created_at: "2026-05-01T00:00:00.000Z",
    deleted_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  });

  it("renders deleted files and restores one", async () => {
    vi.mocked(fileService.listTrash).mockResolvedValue({
      files: [makeTrashFile("file-1", "file-1.txt")],
    });
    vi.mocked(fileService.restoreFile).mockResolvedValue({
      id: "file-1",
      filename: "file-1.txt",
      original_filename: "file-1.txt",
      file_size: 128,
      mime_type: "text/plain",
      category: null,
      folder_id: null,
      created_at: "2026-05-01T00:00:00.000Z",
      deleted_at: null,
    });

    renderTrash();

    expect(await screen.findByText("file-1.txt")).toBeInTheDocument();
    expect(
      screen.getByRole("article", { name: "file-1.txt trash card" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("trash-card-grid")).toHaveClass(
      "grid-cols-3",
      "sm:grid-cols-4",
      "md:grid-cols-6",
      "lg:grid-cols-8",
      "xl:grid-cols-10",
    );
    expect(screen.getByTestId("page-layout")).not.toHaveAttribute(
      "data-background-class-name",
      "bg-[color:var(--filelist-page-bg)]",
    );
    expect(screen.getByTestId("trash-console")).toHaveClass(
      "glass-panel",
      "glass-panel-toolbar",
      "fileListToolbarScale75",
      "trashConsoleToolbar",
      "sticky",
      "top-[calc(clamp(4.75rem,7.6vw,6.25rem)+env(safe-area-inset-top)+0.75rem)]",
      "z-30",
      "p-[clamp(0.6rem,1.4vw,0.75rem)]",
    );
    expect(screen.getByTestId("trash-console-inner")).toHaveClass(
      "gap-[clamp(0.65rem,1.6vw,0.9rem)]",
    );
    expect(screen.getByTestId("trash-console-actions")).not.toHaveClass(
      "sm:overflow-x-auto",
    );
    expect(screen.getByTestId("trash-console-actions")).toHaveClass(
      "sm:overflow-visible",
    );
    expect(screen.getByTestId("trash-console-summary-row")).toHaveClass(
      "trashConsoleSummaryRow",
      "inline-flex",
      "w-full",
      "max-w-full",
      "self-stretch",
    );
    expect(screen.getByTestId("trash-console-title")).toHaveClass(
      "trashConsoleTitle",
    );
    expect(screen.getByTestId("trash-console-count-chip")).toHaveClass(
      "trashConsoleSummaryChip",
      "trashConsoleCountChip",
    );
    expect(screen.getByTestId("trash-console-size-chip")).toHaveClass(
      "trashConsoleSummaryChip",
      "trashConsoleSizeChip",
    );
    expect(screen.getByTestId("trash-console-retention-chip")).toHaveClass(
      "trashConsoleSummaryChip",
      "trashConsoleRetentionChip",
    );
    expect(screen.getByTestId("trash-shell")).toHaveClass("fileListGlassScope");
    expect(screen.queryByTestId("trash-console-grid")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回上一级" })).toHaveClass(
      "glass-btn",
      "toolbarActionBtn",
      "allFilesBtnHighlight",
    );
    expect(screen.getByRole("button", { name: "清空回收站" })).toHaveClass(
      "glass-btn",
      "toolbarActionBtn",
      "uploadBtnHighlight",
    );
    expect(screen.getByTestId("trash-batch-actions-row")).toHaveClass(
      "trashBatchActionsRow",
      "sm:w-auto",
    );
    expect(screen.getByTestId("trash-batch-actions-row")).not.toHaveClass(
      "sm:hidden",
    );
    expect(screen.getByRole("button", { name: "全选" })).toHaveClass(
      "trashSelectAllButton",
    );
    expect(screen.getByRole("button", { name: "批量还原" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "批量彻底删除" })).toBeDisabled();
    expect(screen.getByTestId("trash-base-actions-row")).toHaveClass(
      "trashBaseActionsRow",
      "justify-end",
    );
    expect(screen.getByTestId("trash-card-file-1")).toHaveClass(
      "glass-card",
      "trashCardFrame",
      "group",
      "rounded-[clamp(0.3rem,0.8vw,0.375rem)]",
    );
    expect(screen.getByTestId("trash-card-thumbnail-file-1")).toHaveClass(
      "trashCardThumb",
      "aspect-square",
      "rounded-[clamp(0.2rem,0.6vw,0.25rem)]",
    );
    expect(screen.getByTestId("trash-card-meta-file-1")).toHaveClass(
      "trashCardMeta",
      "text-center",
    );
    expect(screen.getByTestId("trash-card-title-file-1")).toHaveClass(
      "text-center",
      "text-[clamp(0.38rem,1.3vw,0.58rem)]",
    );
    expect(screen.getByTestId("trash-card-detail-file-1")).toHaveClass(
      "justify-center",
      "text-center",
    );
    expect(screen.getByRole("button", { name: "选择" })).toHaveClass(
      "selection-checkbox-hover-reveal",
    );
    expect(screen.getByRole("button", { name: "选择" })).toHaveClass(
      "left-[clamp(0.06rem,0.16vw,0.1rem)]",
      "top-[clamp(0.06rem,0.16vw,0.1rem)]",
    );
    expect(screen.getByRole("button", { name: "选择" })).not.toHaveClass(
      "invisible",
      "group-hover:visible",
    );
    expect(
      readFileListGlassRule(
        ".fileListGlassScope .selection-checkbox-hover-reveal",
      ),
    ).toContain("visibility: visible");
    expect(
      readFileSync(
        resolve(__dirname, "../components/files/list/FileListGlass.css"),
        "utf8",
      ),
    ).toContain("@media (hover: hover) and (pointer: fine)");
    expect(screen.queryByTestId("trash-card-grid-file-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("trash-card-scanline-file-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("trash-card-corner-file-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("trash-card-title-file-1")).toHaveClass(
      "truncate",
    );
    expect(screen.queryByTestId("trash-card-countdown-file-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("trash-card-footer-countdown-file-1")).toHaveClass(
      "text-[var(--trash-countdown-text)]",
    );
    expect(screen.getByTestId("trash-card-restore-file-1")).toHaveClass(
      "trashCardActionButton",
      "trashCardNeuButton",
      "glass-btn",
      "allFilesBtnHighlight",
    );
    const actionRow = screen.getByTestId("trash-card-actions-file-1");
    expect(actionRow).toHaveClass("trashCardActions");
    expect(actionRow).toContainElement(screen.getByRole("button", { name: "还原 file-1.txt" }));
    expect(actionRow).toContainElement(
      screen.getByRole("button", { name: "彻底删除 file-1.txt" }),
    );
    expect(screen.getByRole("button", { name: "彻底删除 file-1.txt" })).toHaveClass(
      "trashCardActionButton",
      "trashCardNeuButton",
      "glass-btn",
      "uploadBtnHighlight",
    );
    expect(screen.queryByTestId("trash-card-top-accent-file-1")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "还原 file-1.txt" }));

    await waitFor(() => {
      expect(fileService.restoreFile).toHaveBeenCalledWith("file-1");
    });
  });

  it("removes a restored card immediately even if a stale trash refetch returns it", async () => {
    vi.mocked(fileService.listTrash).mockResolvedValue({
      files: [makeTrashFile("file-1", "file-1.txt")],
    });
    vi.mocked(fileService.restoreFile).mockResolvedValue({
      id: "file-1",
      filename: "file-1.txt",
      original_filename: "file-1.txt",
      file_size: 128,
      mime_type: "text/plain",
      category: null,
      folder_id: null,
      created_at: "2026-05-01T00:00:00.000Z",
      deleted_at: null,
    });

    renderTrash();

    expect(await screen.findByText("file-1.txt")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "还原 file-1.txt" }));

    await waitFor(() => {
      expect(fileService.restoreFile).toHaveBeenCalledWith("file-1");
    });
    await waitFor(() => {
      expect(screen.queryByTestId("trash-card-file-1")).not.toBeInTheDocument();
    });
  });

  it("overrides trash card action buttons to raised neuromorphic buttons after legacy highlights", () => {
    const css = readFileSync(
      resolve(__dirname, "../components/files/list/FileListGlass.css"),
      "utf8",
    );
    const legacyUploadIndex = css.indexOf(
      ".fileListGlassScope .glass-btn.uploadBtnHighlight",
    );
    const neuromorphicTrashIndex = css.indexOf(
      '.neuromorphic-style .fileListGlassScope .trashCardNeuButton',
    );

    expect(neuromorphicTrashIndex).toBeGreaterThan(legacyUploadIndex);
    expect(css).toContain(
      '.neuromorphic-style .fileListGlassScope .trashCardNeuButton',
    );
    expect(css).toContain("background: var(--neu-raised-bg)");
    expect(css).toContain("box-shadow: var(--neu-raised-sm-shadow)");
    expect(css).toContain("text-shadow: none");
    expect(css).toContain("box-shadow: var(--neu-pressed-shadow)");
  });

  it("confirms before emptying trash", async () => {
    vi.mocked(fileService.listTrash).mockResolvedValue({
      files: [makeTrashFile("file-1", "file-1.txt")],
    });
    vi.mocked(fileService.emptyTrash).mockResolvedValue({ deleted: 1 });

    renderTrash();

    await screen.findByText("file-1.txt");
    await userEvent.click(screen.getByRole("button", { name: "清空回收站" }));
    await userEvent.click(screen.getByRole("button", { name: "彻底清空" }));

    await waitFor(() => {
      expect(fileService.emptyTrash).toHaveBeenCalled();
    });
  });

  it("selects cards and restores the selected files in batch", async () => {
    vi.mocked(fileService.listTrash).mockResolvedValue({
      files: [
        makeTrashFile("file-1", "file-1.txt"),
        makeTrashFile("file-2", "file-2.txt"),
      ],
    });
    vi.mocked(fileService.batchRestoreFiles).mockResolvedValue({
      restored: 2,
      failed: [],
    });

    renderTrash();

    await screen.findByText("file-1.txt");
    await userEvent.click(screen.getByRole("article", { name: "file-1.txt trash card" }));
    await userEvent.click(screen.getByRole("article", { name: "file-2.txt trash card" }));

    expect(screen.getByTestId("trash-card-file-1")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("trash-card-file-2")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("trash-card-file-1")).toHaveClass(
      "trashCardSelected",
      "border-[var(--cta-primary-border)]",
    );
    expect(screen.getByTestId("trash-card-file-1")).not.toHaveClass("ring-1");
    expect(screen.getAllByRole("button", { name: "取消选择" })).toHaveLength(2);
    expect(screen.getByTestId("trash-batch-actions-row")).toHaveClass(
      "trashBatchActionsRow",
      "justify-start",
    );
    expect(screen.getByTestId("trash-console-actions")).toHaveClass(
      "w-full",
      "items-stretch",
      "sm:items-center",
    );
    expect(screen.getByTestId("trash-base-actions-row")).toHaveClass(
      "trashBaseActionsRow",
      "ml-auto",
      "justify-end",
    );
    expect(screen.getByRole("button", { name: "批量还原" })).toHaveClass(
      "trashBatchRestoreButton",
    );
    expect(screen.getByRole("button", { name: "批量还原" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "批量彻底删除" })).toHaveClass(
      "trashBatchPermanentButton",
    );
    expect(screen.getByRole("button", { name: "批量彻底删除" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "返回上一级" })).toHaveClass(
      "trashBackButton",
    );
    expect(screen.getByRole("button", { name: "清空回收站" })).toHaveClass(
      "trashEmptyButton",
    );
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "批量还原" }));

    await waitFor(() => {
      expect(fileService.batchRestoreFiles).toHaveBeenCalledWith(["file-1", "file-2"]);
      expect(fileService.restoreFile).not.toHaveBeenCalled();
    });
  });

  it("selects and clears every visible trash card from the toolbar", async () => {
    vi.mocked(fileService.listTrash).mockResolvedValue({
      files: [
        makeTrashFile("file-1", "file-1.txt"),
        makeTrashFile("file-2", "file-2.txt"),
      ],
    });

    renderTrash();

    await screen.findByText("file-1.txt");
    await userEvent.click(screen.getByRole("button", { name: "全选" }));

    expect(screen.getByTestId("trash-card-file-1")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("trash-card-file-2")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "取消全选" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await userEvent.click(screen.getByRole("button", { name: "取消全选" }));

    expect(screen.getByTestId("trash-card-file-1")).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.getByTestId("trash-card-file-2")).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.queryByText("2 selected")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "全选" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("confirms before permanently deleting selected files in batch", async () => {
    vi.mocked(fileService.listTrash).mockResolvedValue({
      files: [
        makeTrashFile("file-1", "file-1.txt"),
        makeTrashFile("file-2", "file-2.txt"),
      ],
    });
    vi.mocked(fileService.batchPermanentlyDeleteFiles).mockResolvedValue({
      deleted: 2,
      failed: [],
    });

    renderTrash();

    await screen.findByText("file-1.txt");
    await userEvent.click(screen.getByRole("article", { name: "file-1.txt trash card" }));
    await userEvent.click(screen.getByRole("article", { name: "file-2.txt trash card" }));
    await userEvent.click(screen.getByRole("button", { name: "批量彻底删除" }));

    expect(screen.getByRole("heading", { name: "批量彻底删除" })).toBeInTheDocument();
    expect(screen.getByText("选中的 2 个文件都会被彻底删除。")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "彻底删除" }));

    await waitFor(() => {
      expect(fileService.batchPermanentlyDeleteFiles).toHaveBeenCalledWith([
        "file-1",
        "file-2",
      ]);
      expect(fileService.permanentlyDeleteFile).not.toHaveBeenCalled();
    });
  });

  it("shows an empty state", async () => {
    vi.mocked(fileService.listTrash).mockResolvedValue({ files: [] });

    renderTrash({ initialEntries: ["/trash"] });

    expect(await screen.findByText("回收站为空")).toBeInTheDocument();
    expect(screen.getByText("回收站为空")).toHaveClass("emptyStateTitle");
    expect(screen.getByText("删除的文件会在这里保留 30 天")).toHaveClass(
      "emptyStateDescription",
    );
    expect(screen.getByTestId("empty-state")).toHaveClass(
      "emptyStateSurface",
      "trashEmptyState",
    );
    expect(screen.getByTestId("empty-state").querySelector(".emptyStateIconShell"))
      .toBeInTheDocument();
  });

  it("returns to the previous files location instead of hardcoding files home", async () => {
    vi.mocked(fileService.listTrash).mockResolvedValue({ files: [] });

    renderTrash({
      initialEntries: [
        "/files?folder_id=folder-a",
        { pathname: "/trash", state: { from: "/files?folder_id=folder-a" } },
      ],
      initialIndex: 1,
    });

    await screen.findByText("回收站为空");
    await userEvent.click(screen.getByRole("button", { name: "返回上一级" }));

    expect(await screen.findByTestId("files-page-probe")).toHaveTextContent(
      "Files page ?folder_id=folder-a",
    );
  });

  it("uses the last files location when trash was opened from trash itself", async () => {
    vi.mocked(fileService.listTrash).mockResolvedValue({ files: [] });
    window.sessionStorage.setItem(
      "trash-return-to",
      "/files?folder_id=folder-a",
    );

    renderTrash({
      initialEntries: [
        { pathname: "/trash", state: { from: "/trash" } },
      ],
    });

    await screen.findByText("回收站为空");
    await userEvent.click(screen.getByRole("button", { name: "返回上一级" }));

    expect(await screen.findByTestId("files-page-probe")).toHaveTextContent(
      "Files page ?folder_id=folder-a",
    );
  });
});
