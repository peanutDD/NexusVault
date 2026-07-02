import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { act, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { folderService } from "../../services/folders";
import { useAuthStore } from "../../store/authStore";
import type { FolderContentsResponse } from "../../types/folders";
import { useFolderContents } from "./useFolders";

vi.mock("../../services/folders", () => ({
  folderService: {
    getContents: vi.fn(),
    getPath: vi.fn(),
  },
}));

const userA = {
  id: "user-a",
  username: "alice",
  email: "alice@example.com",
  created_at: "2026-05-18T00:00:00.000Z",
};

const userB = {
  id: "user-b",
  username: "bob",
  email: "bob@example.com",
  created_at: "2026-05-18T00:00:00.000Z",
};

function contentsWithFolder(name: string): FolderContentsResponse {
  return {
    current: null,
    path: [],
    folders: [
      {
        id: `${name}-id`,
        name,
        parent_id: null,
        created_at: "2026-05-18T00:00:00.000Z",
        updated_at: "2026-05-18T00:00:00.000Z",
      },
    ],
  };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useFolderContents account isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user: userA, token: "token-a" });
  });

  it("does not reuse cached root folders after switching accounts", async () => {
    vi.mocked(folderService.getContents)
      .mockResolvedValueOnce(contentsWithFolder("alice-private"))
      .mockResolvedValueOnce(contentsWithFolder("bob-private"));

    const { result, rerender } = renderHook(
      ({ folderId }) => useFolderContents(folderId),
      {
        wrapper: createWrapper(),
        initialProps: { folderId: null as string | null },
      },
    );

    await waitFor(() => {
      expect(result.current.data?.folders[0]?.name).toBe("alice-private");
    });

    act(() => {
      useAuthStore.setState({ user: userB, token: "token-b" });
    });
    rerender({ folderId: null });

    await waitFor(() => {
      expect(result.current.data?.folders[0]?.name).toBe("bob-private");
    });

    expect(folderService.getContents).toHaveBeenCalledTimes(2);
    expect(folderService.getContents).toHaveBeenNthCalledWith(1, null);
    expect(folderService.getContents).toHaveBeenNthCalledWith(2, null);
  });

  it("does not retry failed folder-content queries on top of service-level retries", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 3, gcTime: 0 },
      },
    });
    vi.mocked(folderService.getContents).mockRejectedValueOnce(new Error("timeout"));

    const { result } = renderHook(() => useFolderContents(null), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(folderService.getContents).toHaveBeenCalledTimes(1);
  });
});
