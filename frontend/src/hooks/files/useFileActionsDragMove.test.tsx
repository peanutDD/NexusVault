import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { folderService } from "../../services/folders";
import { useFileActions } from "./useFileActions";

vi.mock("../../services/folders", () => ({
  folderService: {
    moveFilesToFolder: vi.fn(),
    moveFolders: vi.fn(),
    getFilesInFolders: vi.fn(),
  },
}));

vi.mock("../../services/files", () => ({
  fileService: {
    downloadFile: vi.fn(),
    downloadZip: vi.fn(),
    deleteFile: vi.fn(),
    batchDeleteFiles: vi.fn(),
    renameFile: vi.fn(),
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function renderActions() {
  const refetchFiles = vi.fn().mockResolvedValue(undefined);
  const refetchFolders = vi.fn().mockResolvedValue(undefined);
  const setSelectedFiles = vi.fn();
  const setSelectedFolders = vi.fn();
  const setError = vi.fn();

  const rendered = renderHook(
    () =>
      useFileActions({
        files: [],
        selectedFiles: new Set(["file-1"]),
        selectedFolders: new Set(["folder-source"]),
        selectedFileIds: ["file-1", "file-2"],
        selectedFolderIds: ["folder-source"],
        setSelectedFiles,
        setSelectedFolders,
        setError,
        setDeleteConfirm: vi.fn(),
        deleteConfirm: null,
        setRenamingFolder: vi.fn(),
        setRenamingFile: vi.fn(),
        refetchFiles,
        refetchFolders,
      }),
    { wrapper },
  );

  return {
    ...rendered,
    refetchFiles,
    refetchFolders,
    setSelectedFiles,
    setSelectedFolders,
    setError,
  };
}

describe("useFileActions drag move", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("moves dropped files and folders into the target folder", async () => {
    vi.mocked(folderService.moveFilesToFolder).mockResolvedValue(1);
    vi.mocked(folderService.moveFolders).mockResolvedValue(1);
    const { result, refetchFiles, refetchFolders, setSelectedFiles, setSelectedFolders } =
      renderActions();

    await result.current.handleDropOnFolder("folder-target", ["file-1"], [
      "folder-source",
    ]);

    expect(folderService.moveFilesToFolder).toHaveBeenCalledWith(
      ["file-1", "file-2"],
      "folder-target",
    );
    expect(folderService.moveFolders).toHaveBeenCalledWith(
      ["folder-source"],
      "folder-target",
    );
    expect(setSelectedFiles).toHaveBeenCalledWith(new Set());
    expect(setSelectedFolders).toHaveBeenCalledWith(new Set());
    await waitFor(() => {
      expect(refetchFiles).toHaveBeenCalledTimes(1);
      expect(refetchFolders).toHaveBeenCalledTimes(1);
    });
  });

  it("ignores a folder dropped onto itself", async () => {
    const { result } = renderActions();

    await result.current.handleDropOnFolder("folder-source", [], [
      "folder-source",
    ]);

    expect(folderService.moveFolders).not.toHaveBeenCalled();
    expect(folderService.moveFilesToFolder).not.toHaveBeenCalled();
  });

  it("expands selected drag payloads when dropping on breadcrumbs", async () => {
    vi.mocked(folderService.moveFilesToFolder).mockResolvedValue(1);
    vi.mocked(folderService.moveFolders).mockResolvedValue(1);
    const { result } = renderActions();
    const event = {
      preventDefault: vi.fn(),
      dataTransfer: {
        getData: vi.fn((type: string) => {
          if (type === "application/file-id") return "file-1";
          if (type === "application/folder-id") return "";
          return "";
        }),
      },
    } as unknown as React.DragEvent;

    await result.current.handleDropOnBreadcrumb(null, event);

    expect(folderService.moveFilesToFolder).toHaveBeenCalledWith(
      ["file-1", "file-2"],
      null,
    );
    expect(folderService.moveFolders).toHaveBeenCalledWith(
      ["folder-source"],
      null,
    );
  });

  it("refreshes lists when a later move operation fails after files moved", async () => {
    vi.mocked(folderService.moveFilesToFolder).mockResolvedValue(1);
    vi.mocked(folderService.moveFolders).mockRejectedValue(new Error("boom"));
    const { result, refetchFiles, refetchFolders, setError } = renderActions();

    await result.current.handleDropOnFolder("folder-target", ["file-1"], [
      "folder-source",
    ]);

    expect(setError).toHaveBeenCalledWith("boom");
    await waitFor(() => {
      expect(refetchFiles).toHaveBeenCalledTimes(1);
      expect(refetchFolders).toHaveBeenCalledTimes(1);
    });
  });
});
