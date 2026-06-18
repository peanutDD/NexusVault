import { readFileSync } from "node:fs";
import { StrictMode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UploadFileItem, { type UploadFile } from "./UploadFileItem";

const failedFile: UploadFile = {
  id: "upload-1",
  name: "https://www.bilibili.com/video/BV1GK5k6uEhC/?spm_id_from=333.1007",
  size: 0,
  mimeType: "text/plain",
  status: "error",
  progress: 0,
  error: `无法访问该 URL。可能的原因：
• 目标服务器不允许跨域请求 (CORS)
• URL 地址不存在或无法访问
• 网络连接问题`,
};

const uploadingFile: UploadFile = {
  id: "uploading-1",
  name: "Spending Friday night in style. 🖤✨ The weekend is finally here, and it’s time to completely unwind. How are you celebrating the start of the weekend tonight? #Ala....jpg",
  size: 10 * 1024 * 1024,
  mimeType: "video/mp4",
  status: "uploading",
  progress: 45,
  startTime: Date.now() - 1000,
};

const imageFile: UploadFile = {
  id: "image-1",
  name: "photo-1.jpg",
  size: 2 * 1024 * 1024,
  mimeType: "image/jpeg",
  status: "success",
  progress: 100,
  file: new File(["image-bits"], "photo-1.jpg", {
    type: "image/jpeg",
    lastModified: 456,
  }),
};

describe("UploadFileItem", () => {
  const createObjectURL = vi.fn(() => "blob:upload-preview");
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("URL", {
      ...globalThis.URL,
      createObjectURL,
      revokeObjectURL,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
  });

  it("renders a local image thumbnail for uploaded image rows", async () => {
    const { unmount } = render(
      <UploadFileItem file={imageFile} onRemove={vi.fn()} onRetry={vi.fn()} />,
    );

    const thumbnail = await screen.findByTestId("upload-file-item-thumbnail");
    expect(thumbnail).toHaveAttribute("src", "blob:upload-preview");
    expect(thumbnail).toHaveAttribute("alt", "photo-1.jpg");
    expect(createObjectURL).toHaveBeenCalledWith(imageFile.file);

    unmount();

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:upload-preview");
  });

  it("keeps the rendered image thumbnail on a live object URL after StrictMode effect replay", async () => {
    let objectUrlId = 0;
    createObjectURL.mockImplementation(() => `blob:strict-preview-${++objectUrlId}`);

    const { unmount } = render(
      <StrictMode>
        <UploadFileItem file={imageFile} onRemove={vi.fn()} onRetry={vi.fn()} />
      </StrictMode>,
    );

    const thumbnail = await screen.findByTestId("upload-file-item-thumbnail");
    let liveUrl: string | null = null;

    try {
      await waitFor(() => {
        const renderedUrl = thumbnail.getAttribute("src");

        expect(renderedUrl).toMatch(/^blob:strict-preview-/);
        expect(revokeObjectURL).not.toHaveBeenCalledWith(renderedUrl);
      });

      liveUrl = thumbnail.getAttribute("src");
    } finally {
      unmount();
    }

    expect(revokeObjectURL).toHaveBeenCalledWith(liveUrl);
  });

  it("uses an instant neuromorphic tooltip for truncated upload filenames instead of the native title tooltip", () => {
    render(
      <UploadFileItem file={uploadingFile} onRemove={vi.fn()} onRetry={vi.fn()} />,
    );

    const name = screen.getByTestId("upload-file-item-name");
    expect(name).not.toHaveAttribute("title");
    expect(name).toHaveAttribute("aria-describedby");
    expect(name).toHaveClass("uploadFileItemName");
    expect(name).toHaveClass("uploadFileItemNameTooltipTrigger");

    fireEvent.mouseEnter(name);

    expect(screen.getByTestId("upload-filename-tooltip-shell")).toHaveClass(
      "uploadFilenameTooltipShell",
    );
    expect(screen.getByTestId("upload-filename-tooltip-text")).toHaveTextContent(
      uploadingFile.name,
    );

    fireEvent.mouseLeave(name);

    expect(screen.queryByTestId("upload-filename-tooltip-shell")).not.toBeInTheDocument();
  });

  it("maps the upload filename tooltip to an instant neuromorphic raised surface", () => {
    const css = readFileSync(
      "src/components/files/upload/UploadFileItem.css",
      "utf8",
    ).replace(/\s+/g, " ");

    expect(css).toContain(".uploadFilenameTooltipShell");
    expect(css).toContain("animation-duration: 90ms");
    expect(css).toContain("transition-delay: 0ms");
    expect(css).toContain(".neuromorphic-style .uploadFilenameTooltipShell");
    expect(css).toContain("background: var(--neu-raised-bg)");
    expect(css).toContain("box-shadow: var(--neu-raised-sm-shadow)");
    expect(css).toContain(".neuromorphic-style .uploadFilenameTooltipText");
    expect(css).toContain("color: var(--color-text-primary)");
  });

  it("marks the upload error details tooltip for the neuromorphic treatment", () => {
    render(<UploadFileItem file={failedFile} onRemove={vi.fn()} onRetry={vi.fn()} />);

    fireEvent.click(screen.getByTitle("查看详情"));

    expect(screen.getByTestId("upload-error-tooltip-shell")).toHaveClass(
      "uploadErrorTooltipShell",
    );
    expect(screen.getByTestId("upload-error-tooltip-accent")).toHaveClass(
      "uploadErrorTooltipAccent",
    );
    expect(screen.getByTestId("upload-error-tooltip-body")).toHaveClass(
      "uploadErrorTooltipBody",
    );
    expect(screen.getByText("错误详情")).toHaveClass("uploadErrorTooltipTitle");
    expect(screen.getByLabelText("关闭")).toHaveClass("uploadErrorTooltipClose");
    expect(screen.getByTestId("upload-error-tooltip-text")).toHaveTextContent(
      "目标服务器不允许跨域请求",
    );
    expect(screen.getByTestId("upload-error-tooltip-arrow")).toHaveClass(
      "uploadErrorTooltipArrow",
    );
  });

  it("maps neuromorphic upload error tooltip to raised and inset primitives", () => {
    const css = readFileSync(
      "src/components/files/upload/UploadFileItem.css",
      "utf8",
    ).replace(/\s+/g, " ");

    expect(css).toContain('.neuromorphic-style .uploadErrorTooltipShell');
    expect(css).toContain("background: var(--neu-raised-bg)");
    expect(css).toContain("box-shadow: var(--neu-raised-sm-shadow)");
    expect(css).toContain('.neuromorphic-style .uploadErrorTooltipAccent');
    expect(css).toContain("display: none");
    expect(css).toContain('.neuromorphic-style .uploadErrorTooltipBody');
    expect(css).toContain("background: var(--neu-inset-bg)");
    expect(css).toContain("box-shadow: var(--neu-inset-shadow)");
    expect(css).toContain('.neuromorphic-style .uploadErrorTooltipClose:active');
    expect(css).toContain("box-shadow: var(--neu-pressed-shadow)");
  });

  it("marks uploaded file rows for the neuromorphic file-item treatment", () => {
    render(<UploadFileItem file={failedFile} onRemove={vi.fn()} onRetry={vi.fn()} />);

    expect(screen.getByTestId("upload-file-item-shell")).toHaveClass(
      "uploadFileItemCyber",
    );
    expect(screen.getByTestId("upload-file-item-icon")).toHaveClass(
      "uploadFileItemIcon",
    );
    expect(screen.getByLabelText("删除文件")).toHaveClass(
      "uploadFileItemActionBtn",
    );
  });

  it("maps neuromorphic uploaded file rows to CodePen raised and inset primitives", () => {
    const css = readFileSync(
      "src/components/files/upload/UploadFileItem.css",
      "utf8",
    ).replace(/\s+/g, " ");

    expect(css).toContain('.neuromorphic-style .uploadFileItemCyber');
    expect(css).toContain("background: var(--neu-raised-bg)");
    expect(css).toContain("box-shadow: var(--neu-raised-sm-shadow)");
    expect(css).toContain('.neuromorphic-style .uploadFileItemCyber::before');
    expect(css).toContain("display: none");
    expect(css).toContain('.neuromorphic-style .uploadFileItemIcon');
    expect(css).toContain("background: var(--neu-inset-bg)");
    expect(css).toContain("box-shadow: var(--neu-inset-shadow)");
    expect(css).toContain('.neuromorphic-style .uploadFileItemActionBtn');
    expect(css).toContain('.neuromorphic-style .uploadFileItemActionBtn:active');
    expect(css).toContain("box-shadow: var(--neu-pressed-shadow)");
  });

  it("marks upload progress bars for the neuromorphic treatment", () => {
    render(
      <UploadFileItem file={uploadingFile} onRemove={vi.fn()} onRetry={vi.fn()} />,
    );

    expect(screen.getByTestId("upload-progress-track")).toHaveClass(
      "uploadProgressTrack",
    );
    expect(screen.getByTestId("upload-progress")).toHaveClass("uploadProgress");
    expect(screen.getByLabelText("Upload progress")).toHaveAttribute("value", "45");
  });

  it("maps neuromorphic upload progress bars to inset track and primary fill", () => {
    const css = readFileSync(
      "src/components/files/upload/UploadFileItem.css",
      "utf8",
    ).replace(/\s+/g, " ");

    expect(css).toContain('.neuromorphic-style .uploadProgressTrack');
    expect(css).toContain("background: var(--neu-inset-bg)");
    expect(css).toContain("box-shadow: var(--neu-inset-shadow)");
    expect(css).toContain(
      '.neuromorphic-style .uploadProgress::-webkit-progress-value',
    );
    expect(css).toContain(
      "background-image: linear-gradient(145deg, var(--neu-primary), var(--neu-primary-dark))",
    );
    expect(css).toContain("animation: none");
    expect(css).toContain(
      '.neuromorphic-style .uploadProgress::-moz-progress-bar',
    );
  });
});
