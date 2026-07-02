import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fileService } from "../../services/files";
import { useAuthStore } from "../../store/authStore";
import type { FileListResponse, FileMetadata } from "../../types/files";
import { useFiles } from "./useFiles";

vi.mock("../../services/files", () => ({
  fileService: {
    listFiles: vi.fn(),
  },
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

const imageFile: FileMetadata = {
  id: "image-1",
  filename: "image-1.jpg",
  original_filename: "image-1.jpg",
  file_size: 1024,
  mime_type: "image/jpeg",
  category: "image",
  folder_id: null,
  created_at: "2026-05-22T00:00:00.000Z",
  is_favorite: false,
  is_pinned: false,
  tags: [],
  last_opened_at: null,
};

describe("useFiles", () => {
  beforeEach(() => {
    vi.mocked(fileService.listFiles).mockReset();
    useAuthStore.setState({
      user: {
        id: "user-a",
        username: "alice",
        email: "alice@example.com",
        created_at: "2026-05-22T00:00:00.000Z",
      },
      token: "token-a",
    });
  });

  it("does not keep previous collection results visible after switching chip combinations", async () => {
    const queryClient = createQueryClient();
    let resolveCombined: (value: FileListResponse) => void = () => {};
    const combinedPending = new Promise<FileListResponse>((resolve) => {
      resolveCombined = resolve;
    });
    vi.mocked(fileService.listFiles)
      .mockResolvedValueOnce({
        files: [imageFile],
        total: 90,
        page: 1,
        limit: 20,
      })
      .mockReturnValueOnce(combinedPending);

    const { result, rerender } = renderHook(
      ({ collection }: { collection: string }) =>
        useFiles({
          collection,
          sort_by: "type",
          sort_order: "asc",
        }),
      {
        initialProps: { collection: "images" },
        wrapper: createWrapper(queryClient),
      },
    );

    await waitFor(() => {
      expect(result.current.data?.pages[0]?.total).toBe(90);
    });

    rerender({ collection: "favorites,pinned" });

    expect(result.current.data).toBeUndefined();

    resolveCombined({
      files: [],
      total: 0,
      page: 1,
      limit: 20,
    });

    await waitFor(() => {
      expect(result.current.data?.pages[0]?.total).toBe(0);
    });
  });

  it("does not retry failed file queries on top of service-level retries", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: 3,
          gcTime: 0,
        },
      },
    });
    vi.mocked(fileService.listFiles).mockRejectedValueOnce(new Error("timeout"));

    const { result } = renderHook(
      () =>
        useFiles({
          search: "3",
          sort_by: "created_at",
          sort_order: "desc",
        }),
      {
        wrapper: createWrapper(queryClient),
      },
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(fileService.listFiles).toHaveBeenCalledTimes(1);
  });

  it("keeps previous results visible while a new search term is still loading", async () => {
    const queryClient = createQueryClient();
    let resolveNextSearch: (value: FileListResponse) => void = () => {};
    const nextSearchPending = new Promise<FileListResponse>((resolve) => {
      resolveNextSearch = resolve;
    });
    vi.mocked(fileService.listFiles)
      .mockResolvedValueOnce({
        files: [imageFile],
        total: 30,
        page: 1,
        limit: 20,
      })
      .mockReturnValueOnce(nextSearchPending);

    const { result, rerender } = renderHook(
      ({ search }: { search?: string }) =>
        useFiles({
          search,
          sort_by: "created_at",
          sort_order: "desc",
        }),
      {
        initialProps: { search: "s" },
        wrapper: createWrapper(queryClient),
      },
    );

    await waitFor(() => {
      expect(result.current.data?.pages[0]?.total).toBe(30);
    });

    rerender({ search: "3" });

    expect(result.current.data?.pages[0]?.total).toBe(30);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(true);

    resolveNextSearch({
      files: [],
      total: 0,
      page: 1,
      limit: 20,
    });

    await waitFor(() => {
      expect(result.current.data?.pages[0]?.total).toBe(0);
    });
  });
});
