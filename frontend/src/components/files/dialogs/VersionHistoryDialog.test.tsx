import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VersionHistoryDialog from "./VersionHistoryDialog";
import { fileVersionService } from "../../../services/versions";
import type { FileMetadata } from "../../../types/files";

vi.mock("../../../services/versions", () => ({
  fileVersionService: {
    list: vi.fn(),
    restore: vi.fn(),
    remove: vi.fn(),
    diff: vi.fn(),
    updateLabel: vi.fn(),
    downloadUrl: vi.fn(() => "/api/files/versions/version-1/download"),
    previewUrl: vi.fn(() => "/api/files/versions/version-1/preview"),
  },
}));

const file: FileMetadata = {
  id: "file-1",
  filename: "notes.md",
  original_filename: "notes.md",
  file_size: 32,
  mime_type: "text/markdown",
  category: null,
  folder_id: null,
  created_at: "2026-05-21T00:00:00Z",
  deleted_at: null,
};

function renderDialog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <VersionHistoryDialog file={file} onClose={vi.fn()} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fileVersionService.list).mockResolvedValue({
    current: { ...file, updated_at: "2026-05-21T00:00:00Z" },
    versions: [
      {
        id: "version-1",
        file_id: "file-1",
        filename: "notes.md",
        original_filename: "notes.md",
        version_number: 1,
        label: "Before overwrite",
        file_size: 32,
        mime_type: "text/markdown",
        created_at: "2026-05-20T00:00:00Z",
        can_diff: true,
        can_preview: true,
      },
    ],
  });
  vi.mocked(fileVersionService.restore).mockResolvedValue(undefined);
  vi.mocked(fileVersionService.remove).mockResolvedValue(undefined);
});

describe("VersionHistoryDialog", () => {
  it("renders the empty history message as a neuromorphic inset state", async () => {
    vi.mocked(fileVersionService.list).mockResolvedValueOnce({
      current: { ...file, updated_at: "2026-05-21T00:00:00Z" },
      versions: [],
    });

    renderDialog();

    const emptyState = await screen.findByText("暂无历史版本。");
    const list = screen.getByTestId("version-history-list");

    expect(emptyState).toHaveClass("fileActionDialogEmptyState");
    expect(emptyState).toHaveClass("fileActionDialogInsetList");
    expect(list).not.toHaveClass("fileActionDialogInsetList");
    expect(emptyState).not.toHaveClass("bg-[var(--dialog-field-bg)]");
  });

  it("uses the shared file action neuromorphic shell and list materials", async () => {
    renderDialog();

    const dialog = screen.getByRole("dialog", { name: "版本历史" });
    expect(dialog.querySelector(".fileActionDialogShell")).not.toBeNull();
    expect(dialog).toHaveClass("items-center");
    expect(dialog).not.toHaveClass("items-start");

    expect(await screen.findByText(/Version 1/)).toBeInTheDocument();
    expect(screen.getByTestId("version-history-list")).toHaveClass(
      "fileActionDialogInsetList",
    );
    expect(screen.getByTestId("version-history-row-version-1")).toHaveClass(
      "fileActionDialogRaisedRow",
    );
  });

  it("maps file action dialog shell hooks to neuromorphic primitives", () => {
    const css = readFileSync("src/styles/confirm-dialog.css", "utf8").replace(
      /\s+/g,
      " ",
    );

    expect(css).toContain(".fileActionDialogShell");
    expect(css).toContain(".fileActionDialogShell .modal-dialog-tech-grid");
    expect(css).toContain(".fileActionDialogInsetList");
    expect(css).toContain(".fileActionDialogEmptyState");
    expect(css).toContain(".fileActionDialogRaisedRow");
  });

  it("requires confirmation before restoring or deleting a version", async () => {
    renderDialog();

    expect(await screen.findByText(/Version 1/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /restore version 1/i }));
    expect(fileVersionService.restore).not.toHaveBeenCalled();
    const restoreDialog = screen.getByRole("alertdialog", { name: /restore version/i });
    expect(restoreDialog).toBeInTheDocument();
    fireEvent.click(within(restoreDialog).getByRole("button", { name: /restore/i }));

    await waitFor(() => {
      expect(fileVersionService.restore).toHaveBeenCalledWith("file-1", "version-1");
    });

    fireEvent.click(screen.getByRole("button", { name: /delete version 1/i }));
    expect(fileVersionService.remove).not.toHaveBeenCalled();
    const deleteDialog = screen.getByRole("alertdialog", { name: /delete version/i });
    expect(deleteDialog).toBeInTheDocument();
    fireEvent.click(within(deleteDialog).getByRole("button", { name: /delete/i }));

    await waitFor(() => {
      expect(fileVersionService.remove).toHaveBeenCalledWith("version-1");
    });
  });
});
