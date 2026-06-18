import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tagsService } from "../../../services/tags";
import type { FileMetadata } from "../../../types/files";
import ManageTagsDialog from "./ManageTagsDialog";

vi.mock("../../../services/tags", () => ({
  tagsService: {
    list: vi.fn(),
    create: vi.fn(),
    setFileTags: vi.fn(),
  },
}));

const file: FileMetadata = {
  id: "file-1",
  filename: "screenshot.png",
  original_filename: "screenshot.png",
  file_size: 120,
  mime_type: "image/png",
  category: "image",
  folder_id: null,
  created_at: "2026-05-22T00:00:00Z",
  deleted_at: null,
  tags: [{ id: "tag-1", name: "UI", color: "#22c55e" }],
};

function renderDialog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onClose = vi.fn();
  const result = render(
    <QueryClientProvider client={queryClient}>
      <ManageTagsDialog file={file} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { ...result, queryClient, onClose };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(tagsService.list).mockResolvedValue([
    { id: "tag-1", name: "UI", color: "#22c55e" },
    { id: "tag-2", name: "Draft", color: "#facc15" },
  ]);
});

describe("ManageTagsDialog", () => {
  it("uses the shared file action neuromorphic shell and inset tag list", async () => {
    renderDialog();

    const dialog = screen.getByRole("dialog", { name: "管理标签" });
    expect(dialog.querySelector(".fileActionDialogShell")).not.toBeNull();
    expect(screen.getByTestId("manage-tags-list")).toHaveClass(
      "fileActionDialogInsetList",
    );
    expect(await screen.findByText("UI")).toBeInTheDocument();
  });

  it("invalidates file list and smart collection counts after saving tag assignments", async () => {
    const user = userEvent.setup();
    vi.mocked(tagsService.setFileTags).mockResolvedValue(undefined);
    const { queryClient, onClose } = renderDialog();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await screen.findByText("UI");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(tagsService.setFileTags).toHaveBeenCalledWith("file-1", ["tag-1"]);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["files"] });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["file-collection-counts"],
    });
    expect(onClose).toHaveBeenCalled();
  });
});
