import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Trash from "./Trash";
import { fileService } from "../services/files";
import { useAuthStore } from "../store/authStore";

vi.mock("../services/files", () => ({
  fileService: {
    listTrash: vi.fn(),
    restoreFile: vi.fn(),
    permanentlyDeleteFile: vi.fn(),
    emptyTrash: vi.fn(),
  },
}));

vi.mock("../components/layout/PageLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function renderTrash() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Trash />
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

  it("renders deleted files and restores one", async () => {
    vi.mocked(fileService.listTrash).mockResolvedValue({
      files: [
        {
          id: "file-1",
          filename: "file-1.txt",
          original_filename: "file-1.txt",
          file_size: 128,
          mime_type: "text/plain",
          category: null,
          folder_id: null,
          created_at: "2026-05-01T00:00:00.000Z",
          deleted_at: "2026-05-08T00:00:00.000Z",
        },
      ],
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
  });

  it("confirms before emptying trash", async () => {
    vi.mocked(fileService.listTrash).mockResolvedValue({
      files: [
        {
          id: "file-1",
          filename: "file-1.txt",
          original_filename: "file-1.txt",
          file_size: 128,
          mime_type: "text/plain",
          category: null,
          folder_id: null,
          created_at: "2026-05-01T00:00:00.000Z",
          deleted_at: "2026-05-08T00:00:00.000Z",
        },
      ],
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

  it("shows an empty state", async () => {
    vi.mocked(fileService.listTrash).mockResolvedValue({ files: [] });

    renderTrash();

    expect(await screen.findByText("回收站为空")).toBeInTheDocument();
  });
});
