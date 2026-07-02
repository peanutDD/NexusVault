import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fileService } from "../../../services/files";
import { useUploadDialogController } from "./useUploadDialogController";

vi.mock("../../../services/files", () => ({
  fileService: {
    uploadFileWithInstant: vi.fn(),
  },
}));

const uploadFileWithInstant = vi.mocked(fileService.uploadFileWithInstant);

function makeFile(name: string, body = "hello"): File {
  return new File([body], name, { type: "text/plain", lastModified: 123 });
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={["/files?folder=folder-1"]}>
      {children}
    </MemoryRouter>
  );
}

describe("useUploadDialogController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes the active folder and aborts an upload when the item is removed", async () => {
    let capturedSignal: AbortSignal | undefined;
    let capturedFolderId: string | null | undefined;
    uploadFileWithInstant.mockImplementation((_file, _onProgress, folderId, options) => {
      capturedFolderId = folderId;
      capturedSignal = options?.signal;
      return new Promise((_, reject) => {
        options?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Upload cancelled", "AbortError")),
          { once: true },
        );
      });
    });

    const { result } = renderHook(
      () =>
        useUploadDialogController({
          open: true,
          onClose: vi.fn(),
          onUploadComplete: vi.fn(),
        }),
      { wrapper },
    );
    const file = makeFile("note.txt");

    act(() => result.current.appendFilesToState([file]));
    const uploadId = result.current.uploadFiles[0].id;

    act(() => result.current.handleAttach());

    await waitFor(() => expect(capturedSignal).toBeDefined());

    expect(capturedFolderId).toBe("folder-1");

    act(() => result.current.handleRemove(uploadId));

    expect(capturedSignal?.aborted).toBe(true);
    expect(result.current.uploadFiles).toHaveLength(0);
  });

  it("allows selecting the same local file again after the previous row reached a terminal state", async () => {
    uploadFileWithInstant.mockResolvedValue({
      file: {
        id: "file-1",
        filename: "note.txt",
        original_filename: "note.txt",
        file_size: 5,
        mime_type: "text/plain",
        category: null,
        folder_id: "folder-1",
        created_at: "2026-05-29T00:00:00Z",
        deleted_at: null,
      },
    });

    const { result } = renderHook(
      () =>
        useUploadDialogController({
          open: true,
          onClose: vi.fn(),
          onUploadComplete: vi.fn(),
        }),
      { wrapper },
    );
    const file = makeFile("note.txt");

    act(() => result.current.appendFilesToState([file]));
    await act(async () => {
      await result.current.handleAttach();
    });

    await waitFor(() => {
      expect(result.current.uploadFiles).toHaveLength(1);
      expect(result.current.uploadFiles[0].status).toBe("success");
    });

    act(() => result.current.appendFilesToState([file]));

    expect(result.current.uploadFiles).toHaveLength(2);
    expect(result.current.uploadFiles[1]).toMatchObject({
      name: "note.txt",
      status: "pending",
      progress: 0,
    });
    expect(result.current.duplicateWarning).toBe("");
  });
});
