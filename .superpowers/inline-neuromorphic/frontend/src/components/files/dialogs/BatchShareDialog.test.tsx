import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fileService } from "../../../services/files";
import { shareService } from "../../../services/shares";
import { useClipboard } from "../../../hooks/useClipboard";
import BatchShareDialog from "./BatchShareDialog";

vi.mock("../../../services/files", () => ({
  fileService: {
    getFilesByIds: vi.fn(),
  },
}));

vi.mock("../../../services/shares", () => ({
  shareService: {
    batchCreateShare: vi.fn(),
  },
}));

vi.mock("../../../hooks/useClipboard", () => ({
  useClipboard: vi.fn(),
}));

describe("BatchShareDialog", () => {
  const copyMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useClipboard).mockReturnValue({
      copy: copyMock,
      copied: false,
    });
    copyMock.mockResolvedValue(true);
    vi.mocked(fileService.getFilesByIds).mockResolvedValue([]);
    vi.mocked(shareService.batchCreateShare).mockResolvedValue({
      shares: [
        {
          id: "share-1",
          url: "http://localhost:5173/share/one",
          token: "one",
          expires_at: null,
          max_downloads: null,
        },
        {
          id: "share-2",
          url: "http://localhost:5173/share/two",
          token: "two",
          expires_at: null,
          max_downloads: null,
        },
      ],
      failed: [],
      message: "Created 2 shares",
    });
  });

  it("copies generated batch share URLs through the shared clipboard fallback", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });

    render(
      <BatchShareDialog
        fileIds={["file-1", "file-2"]}
        fileCount={2}
        onClose={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "创建分享" }));
    expect(await screen.findByText("2 个链接")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "复制所有链接" }));

    await waitFor(() => {
      expect(copyMock).toHaveBeenCalledWith(
        "http://localhost:5173/share/one\nhttp://localhost:5173/share/two",
      );
    });
    expect(screen.getByText("已复制 2 个分享链接到剪贴板")).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole("button", { name: "复制" })[0]);

    await waitFor(() => {
      expect(copyMock).toHaveBeenCalledWith("http://localhost:5173/share/one");
    });
    expect(screen.queryByText(/writeText/i)).not.toBeInTheDocument();
  });
});
