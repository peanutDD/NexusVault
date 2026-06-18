import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Files from "./Files";
import { useAuthStore } from "../store/authStore";

vi.mock("../components/files/list/FileList", () => ({
  default: ({ onOpenUpload }: { onOpenUpload: () => void }) => (
    <div data-testid="file-list">
      <button type="button" onClick={onOpenUpload}>
        Open upload
      </button>
    </div>
  ),
}));

vi.mock("../components/files/list/FileListBackgroundLayer", () => ({
  default: () => <div data-testid="filelist-background-layer" />,
}));

vi.mock("../components/layout/PageLayout", () => ({
  default: ({
    backgroundLayer,
    children,
    hideFooter,
    useSolidBackground,
  }: {
    backgroundLayer?: React.ReactNode;
    children: React.ReactNode;
    hideFooter?: boolean;
    useSolidBackground?: boolean;
  }) => (
    <div
      data-testid="page-layout"
      data-hide-footer={String(Boolean(hideFooter))}
      data-use-solid-background={String(useSolidBackground)}
    >
      <div data-testid="page-background-layer">{backgroundLayer}</div>
      {children}
    </div>
  ),
}));

vi.mock("../components/files/upload/UploadDialog", () => ({
  default: ({
    onUploadComplete,
  }: {
    onUploadComplete: () => void;
  }) => (
    <div role="dialog" aria-label="Upload Files">
      Upload Files
      <button type="button" onClick={onUploadComplete}>
        Complete upload
      </button>
    </div>
  ),
}));

function renderFiles() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return {
    queryClient,
    ...render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Files />
      </MemoryRouter>
    </QueryClientProvider>,
    ),
  };
}

describe("Files page", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: "user-1",
        username: "tyone",
        email: "tyone@example.com",
        created_at: "2026-05-15T00:00:00.000Z",
      },
      token: "token",
    });
  });

  it("mounts the theme-aware file-list background layer while keeping the file list page solid fallback", () => {
    renderFiles();

    expect(screen.getByTestId("page-layout")).toHaveAttribute(
      "data-use-solid-background",
      "true",
    );
    expect(screen.getByTestId("file-list")).toBeInTheDocument();
    expect(screen.getByTestId("filelist-background-layer")).toBeInTheDocument();
  });

  it("hides the page footer while the upload dialog is open", async () => {
    renderFiles();

    expect(screen.getByTestId("page-layout")).toHaveAttribute(
      "data-hide-footer",
      "false",
    );

    await userEvent.click(screen.getByRole("button", { name: "Open upload" }));

    expect(await screen.findByRole("dialog", { name: "Upload Files" })).toBeInTheDocument();
    expect(screen.getByTestId("page-layout")).toHaveAttribute(
      "data-hide-footer",
      "true",
    );
  });

  it("scrolls to top and invalidates file queries after upload completes", async () => {
    const scrollToSpy = vi
      .spyOn(window, "scrollTo")
      .mockImplementation(() => undefined);
    const rafSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(0);
        return 1;
      });
    const invalidateSpy = vi.spyOn(QueryClient.prototype, "invalidateQueries");

    renderFiles();

    await userEvent.click(screen.getByRole("button", { name: "Open upload" }));
    await userEvent.click(screen.getByRole("button", { name: "Complete upload" }));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["files"] });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["file-collection-counts"],
    });
    expect(scrollToSpy).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: "auto",
    });

    scrollToSpy.mockRestore();
    rafSpy.mockRestore();
    invalidateSpy.mockRestore();
  });
});
