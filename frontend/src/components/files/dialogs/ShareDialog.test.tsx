import { readFileSync } from "node:fs";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { shareService } from "../../../services/shares";
import { useClipboard } from "../../../hooks/useClipboard";
import ShareDialog from "./ShareDialog";

vi.mock("../../../services/shares", () => ({
  shareService: {
    createShare: vi.fn(),
  },
}));

vi.mock("../../../hooks/useClipboard", () => ({
  useClipboard: vi.fn(),
}));

describe("ShareDialog", () => {
  const copyMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useClipboard).mockReturnValue({
      copy: copyMock,
      copied: false,
    });
    copyMock.mockResolvedValue(true);
    vi.mocked(shareService.createShare).mockResolvedValue({
      share: {
        id: "share-1",
        url: "http://localhost:5173/share/test-token",
        token: "test-token",
        expires_at: null,
        max_downloads: null,
      },
    });
  });

  it("marks the single share modal internals for the neuromorphic CodePen treatment", () => {
    render(
      <ShareDialog
        fileId="file-1"
        filename="tb_image_share_1778821795953.png"
        onClose={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "分享文件" });
    const shell = dialog.querySelector(".singleShareDialogShell");

    expect(shell).not.toBeNull();
    expect(shell).toHaveClass("fileActionDialogShell", "singleShareDialogShell");
    expect(screen.getByTestId("single-share-file-panel")).toHaveClass(
      "singleShareDialogPanel",
    );
    expect(screen.getByTestId("single-share-file-value")).toHaveClass(
      "singleShareDialogInset",
    );
    expect(screen.getByPlaceholderText("留空则不设置密码")).toHaveClass(
      "singleShareDialogField",
    );
    expect(screen.getByRole("button", { name: "取消" })).toHaveClass(
      "singleShareDialogAction",
    );
    expect(screen.getByRole("button", { name: "创建分享" })).toHaveClass(
      "singleShareDialogPrimary",
    );
  });

  it("maps single share dialog hooks to raised and inset neuromorphic primitives", () => {
    const css = readFileSync("src/styles/confirm-dialog.css", "utf8").replace(
      /\s+/g,
      " ",
    );

    expect(css).toContain('.neuromorphic-style .singleShareDialogPanel');
    expect(css).toContain("background: var(--neu-inset-bg)");
    expect(css).toContain("box-shadow: var(--neu-inset-shadow)");
    expect(css).toContain('.neuromorphic-style .singleShareDialogField');
    expect(css).toContain('.neuromorphic-style .singleShareDialogAction');
    expect(css).toContain("background: var(--neu-raised-bg)");
    expect(css).toContain("box-shadow: var(--neu-raised-sm-shadow)");
    expect(css).toContain('.singleShareDialogShell');
    expect(css).toContain('.singleShareDialogShell .modal-dialog-tech-grid');
    expect(css).toContain('.neuromorphic-style .singleShareDialogPrimary');
    expect(css).toContain(
      "background: linear-gradient(145deg, var(--neu-primary), var(--neu-primary-dark))",
    );
  });

  it("copies the created share URL through the shared clipboard fallback", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });

    render(
      <ShareDialog
        fileId="file-1"
        filename="Screenshot_2026.png"
        onClose={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "创建分享" }));

    expect(await screen.findByDisplayValue("http://localhost:5173/share/test-token")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "复制" }));

    await waitFor(() => {
      expect(copyMock).toHaveBeenCalledWith("http://localhost:5173/share/test-token");
    });
    expect(screen.getByText("链接已复制到剪贴板")).toBeInTheDocument();
    expect(screen.queryByText(/writeText/i)).not.toBeInTheDocument();
  });

  it("keeps close and manage shares actions on one row after creating a share", async () => {
    render(
      <ShareDialog
        fileId="file-1"
        filename="Screenshot_2026.png"
        onClose={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "创建分享" }));

    const actionRow = await screen.findByTestId("single-share-created-actions");
    const closeButton = within(actionRow).getByRole("button", { name: "关闭" });
    const manageSharesLink = within(actionRow).getByRole("link", {
      name: "Manage shares",
    });

    expect(actionRow).toHaveClass(
      "grid",
      "grid-cols-2",
      "gap-[clamp(0.585rem,1.35vw,0.75rem)]",
    );
    expect(actionRow).toContainElement(closeButton);
    expect(actionRow).toContainElement(manageSharesLink);
    expect(closeButton).toHaveClass("min-w-0");
    expect(manageSharesLink).toHaveClass("min-w-0");
    expect(closeButton).not.toHaveClass("w-full");
    expect(manageSharesLink).not.toHaveClass("w-full");
  });
});
