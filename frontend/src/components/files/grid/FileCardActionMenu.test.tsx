import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import FileCard from "./FileCard";
import FolderCard from "./FolderCard";
import type { FileMetadata } from "../../../types/files";
import type { Folder } from "../../../types/folders";

vi.mock("../preview/LazyThumbnail", () => ({
  default: ({ filename }: { filename: string }) => (
    <div data-testid="lazy-thumbnail">{filename}</div>
  ),
}));

const file: FileMetadata = {
  id: "file-1",
  filename: "screenshot.png",
  original_filename: "screenshot.png",
  file_size: 128,
  mime_type: "image/png",
  category: null,
  folder_id: null,
  created_at: "2026-05-01T00:00:00.000Z",
  deleted_at: null,
};

const folder: Folder = {
  id: "folder-1",
  name: "Master Folder",
  parent_id: null,
  created_at: "2026-05-01T00:00:00.000Z",
  updated_at: "2026-05-01T00:00:00.000Z",
};

function renderOpenFileMenu() {
  return render(
    <div className="fileListGlassScope">
      <FileCard
        file={file}
        isSelected={false}
        onSelect={vi.fn()}
        onPreview={vi.fn()}
        onShare={vi.fn()}
        onDownload={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        isMenuOpen
        onToggleMenu={vi.fn()}
        onCloseMenu={vi.fn()}
      />
    </div>,
  );
}

function renderOpenFolderMenu() {
  return render(
    <div className="fileListGlassScope">
      <FolderCard
        folder={folder}
        isSelected={false}
        onSelect={vi.fn()}
        onOpen={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        isMenuOpen
        onToggleMenu={vi.fn()}
        onCloseMenu={vi.fn()}
      />
    </div>,
  );
}

function readFileListGlassCss() {
  return readFileSync(
    resolve(__dirname, "../list/FileListGlass.css"),
    "utf8",
  );
}

describe("card action menus", () => {
  it("uses purple flag badges for favorite and pinned file cards", () => {
    const flaggedFile = { ...file, is_favorite: true, is_pinned: true };
    render(
      <div className="fileListGlassScope">
        <FileCard
          file={flaggedFile}
          isSelected={false}
          onSelect={vi.fn()}
          onPreview={vi.fn()}
          onShare={vi.fn()}
          onDownload={vi.fn()}
          onRename={vi.fn()}
          onDelete={vi.fn()}
          isMenuOpen={false}
          onToggleMenu={vi.fn()}
          onCloseMenu={vi.fn()}
        />
      </div>,
    );

    const badges = document.querySelectorAll(".fileCardFlagBadge");
    const glyphs = document.querySelectorAll(".fileCardFlagBadgeGlyph");

    expect(badges).toHaveLength(2);
    expect(glyphs).toHaveLength(2);
    badges.forEach((badge) => {
      expect(badge).toHaveClass("text-[var(--neu-primary)]");
    });
    glyphs.forEach((glyph) => {
      expect(glyph).toHaveClass("text-[var(--neu-primary)]");
    });
  });

  it("marks file card menu panel and items for the neuromorphic action-menu treatment", () => {
    renderOpenFileMenu();

    const menu = screen.getByText("下载").closest(".fileCardActionMenu");

    expect(menu).toBeInTheDocument();
    expect(menu?.closest(".glass-card")).toHaveClass("fileCardMenuOpen");
    expect(menu).not.toHaveClass("bg-[var(--file-card-menu-bg)]");
    expect(menu).not.toHaveClass("scale-[0.7]", "sm:scale-90", "md:scale-100");
    expect(screen.getByText("下载").closest("button")).toHaveClass(
      "fileCardActionMenuItem",
    );
    expect(screen.getByText("分享").closest("button")).toHaveClass(
      "fileCardActionMenuItem",
    );
    expect(screen.getByText("重命名").closest("button")).toHaveClass(
      "fileCardActionMenuItem",
    );
    expect(screen.getByText("删除").closest("button")).toHaveClass(
      "fileCardActionMenuItem",
    );
  });

  it("shows a file activity action and invokes the activity callback", async () => {
    const user = userEvent.setup();
    const onShowActivity = vi.fn();
    render(
      <div className="fileListGlassScope">
        <FileCard
          file={file}
          isSelected={false}
          onSelect={vi.fn()}
          onPreview={vi.fn()}
          onShare={vi.fn()}
          onDownload={vi.fn()}
          onRename={vi.fn()}
          onDelete={vi.fn()}
          onShowActivity={onShowActivity}
          isMenuOpen
          onToggleMenu={vi.fn()}
          onCloseMenu={vi.fn()}
        />
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "活动记录" }));

    expect(onShowActivity).toHaveBeenCalledWith(file);
  });

  it("marks folder card menu panel and items for the same neuromorphic action-menu treatment", () => {
    renderOpenFolderMenu();

    const menu = screen.getByText("打开").closest(".fileCardActionMenu");

    expect(menu).toBeInTheDocument();
    expect(menu?.closest(".glass-card")).toHaveClass("fileCardMenuOpen");
    expect(menu).not.toHaveClass("bg-[var(--filelist-menu-bg)]");
    expect(menu).not.toHaveClass("scale-[0.7]", "sm:scale-90", "md:scale-100");
    expect(screen.getByText("打开").closest("button")).toHaveClass(
      "fileCardActionMenuItem",
    );
    expect(screen.getByText("重命名").closest("button")).toHaveClass(
      "fileCardActionMenuItem",
    );
    expect(screen.getByText("删除").closest("button")).toHaveClass(
      "fileCardActionMenuItem",
    );
  });

  it("maps neuromorphic card menus to raised panels and inset hover list items", () => {
    const css = readFileListGlassCss();

    expect(css).toContain(
      '.neuromorphic-style .fileListGlassScope .fileCardActionMenu',
    );
    expect(css).toContain(".fileListGlassScope .glass-card.fileCardMenuOpen");
    expect(css).toContain("overflow: visible");
    expect(css).toContain("background: var(--neu-raised-bg)");
    expect(css).toContain("box-shadow: var(--neu-raised-shadow)");
    expect(css).toContain(
      '.neuromorphic-style .fileListGlassScope .fileCardActionMenuItem:hover',
    );
    expect(css).toContain("background: var(--neu-inset-bg)");
    expect(css).toContain("box-shadow: var(--neu-inset-shadow)");
  });
});
