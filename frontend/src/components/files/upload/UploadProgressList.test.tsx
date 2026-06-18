import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LARGE_FILE_UPLOAD } from "../../../constants";
import UploadProgressList from "./UploadProgressList";
import type { UploadFile } from "./UploadFileItem";

const files: UploadFile[] = [
  {
    id: "file-1",
    name: "small.jpg",
    size: 1024,
    mimeType: "image/jpeg",
    status: "pending",
    progress: 0,
    file: new File(["small"], "small.jpg", { type: "image/jpeg" }),
  },
  {
    id: "file-2",
    name: "large.mov",
    size: LARGE_FILE_UPLOAD.SIZE_THRESHOLD_BYTES,
    mimeType: "video/quicktime",
    status: "pending",
    progress: 0,
    file: new File(["large"], "large.mov", { type: "video/quicktime" }),
  },
];

function renderList() {
  return render(
    <UploadProgressList
      uploadFiles={files}
      onRemoveFile={vi.fn()}
      onRetryFile={vi.fn()}
      onClearAll={vi.fn()}
      maxBatchCount={20}
      totalAtLimit={false}
      largeAtLimit={false}
      totalLimitWarning=""
      largeLimitWarning=""
      duplicateWarning=""
    />,
  );
}

describe("UploadProgressList", () => {
  it("marks the upload stat rows for the neuromorphic inset treatment", () => {
    renderList();

    expect(screen.getByTestId("upload-stats-panel")).toHaveClass(
      "uploadStatsPanel",
    );
    expect(screen.getByTestId("upload-total-stat-row")).toHaveClass(
      "uploadStatRow",
    );
    expect(screen.getByTestId("upload-large-stat-row")).toHaveClass(
      "uploadStatRow",
    );
    expect(screen.getByText("文件数量")).toHaveClass("uploadStatLabel");
    expect(screen.getByText("大文件（≥100MB）")).toHaveClass("uploadStatLabel");
    expect(screen.getByText("2 / 20 个")).toHaveClass("uploadStatValue");
    expect(screen.getByText(`1 / ${LARGE_FILE_UPLOAD.MAX_CONCURRENT} 个`)).toHaveClass(
      "uploadStatValue",
    );
  });

  it("maps neuromorphic upload stat rows to CodePen inset information blocks", () => {
    const css = readFileSync(
      "src/components/files/upload/UploadDialog.css",
      "utf8",
    ).replace(/\s+/g, " ");

    expect(css).toContain('.neuromorphic-style .uploadStatRow');
    expect(css).toContain("background: var(--neu-inset-bg)");
    expect(css).toContain("box-shadow: var(--neu-inset-shadow)");
    expect(css).toContain('.neuromorphic-style .uploadStatLabel');
    expect(css).toContain('.neuromorphic-style .uploadStatValue');
    expect(css).toContain("color: var(--neu-primary)");
  });
});
