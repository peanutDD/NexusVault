import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { AxiosError } from "axios";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "../../store/authStore";
import { useFileList } from "./useFileList";

const mockUseFiles = vi.fn();
const mockUseFolderContents = vi.fn();
const mockClearError = vi.fn();

vi.mock("../../hooks/files/useFileFilters", () => ({
  useFileFilters: () => ({
    search: "3",
    mimeType: "",
    sortBy: "created_at_desc",
    debouncedSearch: "3",
    sortField: "created_at",
    sortOrder: "desc",
    isGroupByType: false,
    isGroupByTime: false,
    handleSearchChange: vi.fn(),
    handleMimeTypeChange: vi.fn(),
    handleSortChange: vi.fn(),
  }),
}));

vi.mock("../../hooks/files/useFiles", () => ({
  useFiles: (...args: unknown[]) => mockUseFiles(...args),
}));

vi.mock("../../hooks/folders/useFolders", () => ({
  useFolderContents: (...args: unknown[]) => mockUseFolderContents(...args),
}));

vi.mock("../../hooks/files/useFileSelection", () => ({
  useFileSelection: () => ({
    selectedFiles: new Set(),
    selectedFolders: new Set(),
    selectedFileIds: [] as string[],
    selectedFolderIds: [] as string[],
    allFilesSelected: false,
    toggleSelectAll: vi.fn(),
    clearSelection: vi.fn(),
    setSelectedFiles: vi.fn(),
    setSelectedFolders: vi.fn(),
  }),
}));

vi.mock("../../hooks/files/useFileUI", () => ({
  useFileUI: () => ({
    previewFile: null,
    setPreviewFile: vi.fn(),
    shareFile: null,
    setShareFile: vi.fn(),
    showBatchShare: false,
    setShowBatchShare: vi.fn(),
    batchShareFileIds: [] as string[],
    setBatchShareFileIds: vi.fn(),
    showBatchMove: false,
    setShowBatchMove: vi.fn(),
    showCreateFolder: false,
    setShowCreateFolder: vi.fn(),
    renamingFolder: null,
    setRenamingFolder: vi.fn(),
    renamingFile: null,
    setRenamingFile: vi.fn(),
    deleteConfirm: null,
    setDeleteConfirm: vi.fn(),
    error: null,
    setError: vi.fn(),
    clearError: mockClearError,
  }),
}));

vi.mock("../../hooks/files/useFileActions", () => ({
  useFileActions: () => ({
    deleteLoading: false,
    batchDownloading: false,
    handleDelete: vi.fn(),
    handleBatchDelete: vi.fn(),
    executeDelete: vi.fn(),
    handleRenameFolderSubmit: vi.fn(),
    handleRenameFileSubmit: vi.fn(),
    handleDownload: vi.fn(),
    handleBatchDownload: vi.fn(),
    handleDropOnFolder: vi.fn(),
    handleDropOnBreadcrumb: vi.fn(),
  }),
}));

vi.mock("./useFileListScope", () => ({
  useFileListScope: () => ({
    setSearchParams: vi.fn(),
    currentFolderId: null,
    activeCollection: "",
    activeTagId: "",
  }),
}));

vi.mock("./useFileListGrouping", () => ({
  useFileGroupingWithIcons: (files: unknown[]) => ({
    groupedFiles: null,
    displayFiles: files,
  }),
  useTimeGrouping: (files: unknown[]) => ({
    timeGroupedFiles: null,
    displayFilesForTime: files,
  }),
  useTimeGroupingMixed: () => ({
    timeGroupedItems: null,
  }),
}));

vi.mock("./useFileListNavigation", () => ({
  useFileListNavigation: () => ({
    navigateToFolder: vi.fn(),
  }),
}));

vi.mock("./useFileListOptimisticDelete", () => ({
  useFileListOptimisticDelete: ({
    files,
    displayFolders,
  }: {
    files: unknown[];
    displayFolders: unknown[];
  }) => ({
    files,
    folders: displayFolders,
    executeDelete: vi.fn(),
  }),
}));

vi.mock("./fileListFilterParams", () => ({
  clearSmartFilterParams: vi.fn(),
  toggleCollectionParam: vi.fn(),
  toggleTagParam: vi.fn(),
}));

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useFileList query error handling", () => {
  beforeEach(() => {
    mockUseFiles.mockReset();
    mockUseFolderContents.mockReset();
    mockClearError.mockReset();
    useAuthStore.setState({
      user: {
        id: "user-1",
        username: "tyone",
        email: "tyone@example.com",
        created_at: "2026-05-28T00:00:00.000Z",
      },
      token: "token",
    });
  });

  it("stops the skeleton and surfaces a dismissible timeout error when search stalls", () => {
    mockUseFiles.mockReturnValue({
      data: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: true,
      isFetching: false,
      isError: true,
      error: new AxiosError("timeout of 15000ms exceeded", "ECONNABORTED"),
      refetch: vi.fn(),
    });
    mockUseFolderContents.mockReturnValue({
      data: { folders: [], path: [] },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    const { result } = renderHook(() => useFileList(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toContain("请求超时");

    expect(result.current.clearError).toBeUndefined();
    expect(mockClearError).not.toHaveBeenCalled();
  });
});
