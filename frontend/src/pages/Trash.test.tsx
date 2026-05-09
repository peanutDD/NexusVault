import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

describe("Trash page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    deleted_at: "2026-05-08T00:00:00.000Z",
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
      "grid-cols-5",
      "md:grid-cols-10",
    );
    expect(screen.getByTestId("page-layout")).toHaveAttribute(
      "data-background-class-name",
      "bg-[image:var(--trash-page-bg)]",
    );
    expect(screen.getByTestId("trash-console")).toHaveClass(
      "glass-panel",
      "glass-panel-toolbar",
      "fileListToolbarScale75",
      "trashConsoleToolbar",
      "p-3",
    );
    expect(screen.getByTestId("trash-console-inner")).toHaveClass("gap-1.5");
    expect(screen.getByTestId("trash-console-summary-row")).toHaveClass(
      "trashConsoleSummaryRow",
      "w-fit",
      "max-w-full",
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
    expect(screen.queryByTestId("trash-batch-actions-row")).not.toBeInTheDocument();
    expect(screen.getByTestId("trash-base-actions-row")).toHaveClass(
      "trashBaseActionsRow",
      "justify-end",
    );
    expect(screen.getByTestId("trash-card-file-1")).toHaveClass(
      "glass-card",
      "trashCardFrame",
      "!rounded-[0.24rem]",
    );
    expect(screen.getByTestId("trash-card-thumbnail-file-1")).toHaveClass(
      "glass-thumb",
      "trashCardThumb",
      "aspect-[4/5]",
      "!rounded-[0.24rem]",
    );
    expect(screen.getByTestId("trash-card-meta-file-1")).toHaveClass(
      "trashCardMeta",
      "min-h-[2.05rem]",
    );
    expect(screen.getByRole("checkbox", { name: "选择 file-1.txt" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByRole("checkbox", { name: "选择 file-1.txt" })).toHaveClass(
      "right-1",
      "top-1",
      "rounded-full",
    );
    expect(screen.getByTestId("trash-card-grid-file-1")).toHaveClass(
      "bg-[image:var(--trash-tech-grid)]",
    );
    expect(screen.getByTestId("trash-card-scanline-file-1")).toHaveClass(
      "bg-[image:var(--trash-tech-scanline)]",
    );
    expect(screen.getByTestId("trash-card-corner-file-1")).toHaveClass(
      "bg-[image:var(--trash-tech-corner)]",
    );
    expect(screen.getByTestId("trash-card-title-file-1")).toHaveClass(
      "truncate",
    );
    expect(screen.queryByTestId("trash-card-countdown-file-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("trash-card-footer-countdown-file-1")).toHaveClass(
      "text-[var(--trash-countdown-text)]",
    );
    expect(screen.getByTestId("trash-card-restore-file-1")).toHaveClass(
      "size-[clamp(0.6rem,1.75vw,0.86rem)]",
      "glass-btn",
      "allFilesBtnHighlight",
    );
    expect(screen.getByRole("button", { name: "彻底删除 file-1.txt" })).toHaveClass(
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
    );
    expect(screen.getByTestId("trash-card-file-1")).not.toHaveClass(
      "border-[var(--cta-primary-border)]",
      "ring-1",
    );
    expect(screen.getByRole("checkbox", { name: "选择 file-1.txt" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByTestId("trash-card-check-file-1")).toBeInTheDocument();
    expect(screen.getByTestId("trash-batch-actions-row")).toHaveClass(
      "trashBatchActionsRow",
      "justify-start",
    );
    expect(screen.getByTestId("trash-base-actions-row")).toHaveClass(
      "trashBaseActionsRow",
      "justify-end",
    );
    expect(screen.getByRole("button", { name: "批量还原" })).toHaveClass(
      "trashBatchRestoreButton",
    );
    expect(screen.getByRole("button", { name: "批量彻底删除" })).toHaveClass(
      "trashBatchPermanentButton",
    );
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
