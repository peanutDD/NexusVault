import type { ComponentProps, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ScrollRestoration from "../../router/ScrollRestoration";
import { useFileList } from "./useFileList";
import type { FileMetadata } from "../../types/files";
import { useFiles } from "../../hooks/files/useFiles";
import { useFolderContents } from "../../hooks/folders/useFolders";
import { FILE_LIST_SAVE_SCROLL_EVENT } from "../../constants/navigationScroll";

vi.mock("../../hooks/files/useFiles", () => ({ useFiles: vi.fn() }));
vi.mock("../../hooks/folders/useFolders", () => ({ useFolderContents: vi.fn() }));
vi.mock("../../hooks/files/useFileActions", () => ({
  useFileActions: () => ({
    deleteLoading: false, batchDownloading: false, handleDelete: vi.fn(),
    handleBatchDelete: vi.fn(), executeDelete: vi.fn(), handleRenameFolderSubmit: vi.fn(),
    handleRenameFileSubmit: vi.fn(), handleDownload: vi.fn(), handleBatchDownload: vi.fn(),
    handleDropOnBreadcrumb: vi.fn(),
  }),
}));

const scrollToMock = vi.fn();
const refetch = vi.fn();
const loadMore = vi.fn();
const folderKey = "fileListScroll:folder-1:created_at_desc:all:";
let scrollYValue = 215;

const file = (id: string): FileMetadata => ({
  id,
  filename: `${id}.txt`,
  original_filename: `${id}.txt`,
  file_size: 1,
  mime_type: "text/plain",
  category: null,
  folder_id: "folder-1",
  created_at: "2026-05-05T00:00:00.000Z",
});

function wrapper(entries: ComponentProps<typeof MemoryRouter>["initialEntries"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}><MemoryRouter initialEntries={entries}><ScrollRestoration />{children}</MemoryRouter></QueryClientProvider>;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  scrollYValue = 215;
  Object.defineProperty(window, "scrollY", { configurable: true, get: () => scrollYValue });
  Object.defineProperty(window, "scrollTo", { configurable: true, value: scrollToMock });
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => (callback(0), 0));
  vi.mocked(useFiles).mockReturnValue({
    data: { pages: [{ files: [], total: 0 }] }, fetchNextPage: loadMore,
    hasNextPage: false, isFetchingNextPage: false, isLoading: false,
    isFetching: false, refetch,
  } as unknown as ReturnType<typeof useFiles>);
  vi.mocked(useFolderContents).mockImplementation((folderId) => ({
    data: { current: null, path: folderId ? [{
      id: folderId, name: "Saved folder", parent_id: null,
      created_at: "2026-05-05T00:00:00.000Z", updated_at: "2026-05-05T00:00:00.000Z",
    }] : [], folders: [] },
    isLoading: false, refetch,
  }) as unknown as ReturnType<typeof useFolderContents>);
});

function FileRoute() {
  const navigate = useNavigate();
  useFileList();
  return <button type="button" onClick={() => {
    window.dispatchEvent(new Event(FILE_LIST_SAVE_SCROLL_EVENT));
    scrollYValue = 128;
    navigate("/settings");
  }}>settings</button>;
}

function SettingsRoute() {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate(-1)}>back</button>;
}

describe("useFileList navigation scroll restoration", () => {
  it("restores saved folder scroll on entry", async () => {
    sessionStorage.setItem(folderKey, "640");
    const { result } = renderHook(() => useFileList(), { wrapper: wrapper(["/files"]) });
    await waitFor(() => expect(result.current.currentFolderId).toBeNull());
    scrollToMock.mockClear();

    act(() => result.current.navigateToFolder("folder-1"));

    await waitFor(() => expect(scrollToMock).toHaveBeenLastCalledWith({ top: 640, left: 0, behavior: "auto" }));
  });

  it("persists active folder scroll before refresh", () => {
    renderHook(() => useFileList(), { wrapper: wrapper(["/files?folder=folder-1"]) });
    window.dispatchEvent(new Event("pagehide"));
    expect(sessionStorage.getItem(folderKey)).toBe("215");
  });

  it("persists active folder scroll before browser refresh", () => {
    renderHook(() => useFileList(), { wrapper: wrapper(["/files?folder=folder-1"]) });
    scrollYValue = 915;
    window.dispatchEvent(new Event("beforeunload"));
    expect(sessionStorage.getItem(folderKey)).toBe("915");
  });

  it("loads more pages before restoring a deep saved folder scroll after refresh", async () => {
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      get: () => 1200,
    });
    Object.defineProperty(document.body, "scrollHeight", {
      configurable: true,
      get: () => 1200,
    });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    sessionStorage.setItem(folderKey, "4200");
    vi.mocked(useFiles).mockReturnValue({
      data: { pages: [{ files: [], total: 150 }] }, fetchNextPage: loadMore,
      hasNextPage: true, isFetchingNextPage: false, isLoading: false,
      isFetching: false, refetch,
    } as unknown as ReturnType<typeof useFiles>);

    renderHook(() => useFileList(), { wrapper: wrapper(["/files?folder=folder-1"]) });

    await waitFor(() => expect(loadMore).toHaveBeenCalledTimes(1));
    expect(scrollToMock).not.toHaveBeenLastCalledWith({ top: 4200, left: 0, behavior: "auto" });
  });

  it("keeps loading until the saved refresh scroll can be reached", async () => {
    let documentHeight = 1200;
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      get: () => documentHeight,
    });
    Object.defineProperty(document.body, "scrollHeight", {
      configurable: true,
      get: () => documentHeight,
    });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    sessionStorage.setItem(folderKey, "4200");
    vi.mocked(useFiles).mockReturnValue({
      data: { pages: [{ files: [], total: 150 }] }, fetchNextPage: loadMore,
      hasNextPage: true, isFetchingNextPage: false, isLoading: false,
      isFetching: false, refetch,
    } as unknown as ReturnType<typeof useFiles>);

    const { rerender } = renderHook(() => useFileList(), {
      wrapper: wrapper(["/files?folder=folder-1"]),
    });
    await waitFor(() => expect(loadMore).toHaveBeenCalledTimes(1));

    documentHeight = 2200;
    vi.mocked(useFiles).mockReturnValue({
      data: { pages: [{ files: [file("a")], total: 150 }] }, fetchNextPage: loadMore,
      hasNextPage: true, isFetchingNextPage: false, isLoading: false,
      isFetching: false, refetch,
    } as unknown as ReturnType<typeof useFiles>);
    rerender();
    await waitFor(() => expect(loadMore).toHaveBeenCalledTimes(2));

    documentHeight = 5200;
    vi.mocked(useFiles).mockReturnValue({
      data: { pages: [{ files: [file("a"), file("b")], total: 150 }] }, fetchNextPage: loadMore,
      hasNextPage: true, isFetchingNextPage: false, isLoading: false,
      isFetching: false, refetch,
    } as unknown as ReturnType<typeof useFiles>);
    rerender();
    await waitFor(() =>
      expect(scrollToMock).toHaveBeenLastCalledWith({ top: 4200, left: 0, behavior: "auto" }),
    );
  });

  it("restores the folder scroll from before opening settings", async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={["/files?folder=folder-1"]}>
          <Routes>
            <Route path="/files" element={<><ScrollRestoration /><FileRoute /></>} />
            <Route path="/settings" element={<><ScrollRestoration /><SettingsRoute /></>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "settings" })).toBeInTheDocument());
    scrollToMock.mockClear();
    scrollYValue = 780;

    await userEvent.click(screen.getByRole("button", { name: "settings" }));
    await userEvent.click(await screen.findByRole("button", { name: "back" }));

    await waitFor(() =>
      expect(scrollToMock).toHaveBeenLastCalledWith({ top: 780, left: 0, behavior: "auto" }),
    );
  });
});
