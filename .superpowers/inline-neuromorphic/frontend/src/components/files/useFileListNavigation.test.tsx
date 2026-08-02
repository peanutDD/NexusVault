import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFileListNavigation } from "./useFileListNavigation";

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={["/files?folder=folder-1"]}>
        {children}
      </MemoryRouter>
    );
  };
}

describe("useFileListNavigation", () => {
  beforeEach(() => {
    sessionStorage.clear();
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 128,
    });
  });

  it("pushes folder navigation into browser history", () => {
    const setSearchParams = vi.fn();
    const setSelectedFiles = vi.fn();
    const setSelectedFolders = vi.fn();

    const { result } = renderHook(
      () =>
        useFileListNavigation({
          currentFolderId: "folder-1",
          debouncedSearch: "clip",
          mimeType: "image/",
          sortBy: "created_at_desc",
          loadingFiles: true,
          loadingFolders: true,
          setSearchParams,
          setSelectedFiles,
          setSelectedFolders,
        }),
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.navigateToFolder("folder-2");
    });

    expect(setSearchParams).toHaveBeenCalledWith(
      expect.any(Function),
      { replace: false },
    );
    const updater = setSearchParams.mock.calls[0]?.[0] as (
      params: URLSearchParams,
    ) => URLSearchParams;
    expect(updater(new URLSearchParams("folder=folder-1")).get("folder")).toBe(
      "folder-2",
    );
    expect(
      sessionStorage.getItem(
        "fileListScroll:folder-1:created_at_desc:image/:clip",
      ),
    ).toBe("128");
  });
});
