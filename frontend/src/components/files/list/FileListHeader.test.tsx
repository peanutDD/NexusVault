import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import FileListHeader from "./FileListHeader";
import type React from "react";

vi.mock("./FileListFilters", () => ({
  default: ({ actions }: { actions?: React.ReactNode }) => (
    <div role="search">
      <input aria-label="Search files" />
      {actions}
    </div>
  ),
}));

vi.mock("../FolderBreadcrumb", () => ({
  default: () => <nav aria-label="Breadcrumb">Breadcrumb</nav>,
}));

function renderHeader() {
  return render(
    <MemoryRouter initialEntries={["/files"]}>
      <FileListHeader
        folderPath={[]}
        navigateToFolder={vi.fn()}
        handleDropOnBreadcrumb={vi.fn()}
        search=""
        mimeType=""
        sortBy="created_at_desc"
        onSearchChange={vi.fn()}
        onMimeTypeChange={vi.fn()}
        onSortChange={vi.fn()}
        onOpenUpload={vi.fn()}
        setShowCreateFolder={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe("FileListHeader", () => {
  it("does not render a Trash button in the search toolbar", () => {
    renderHeader();

    expect(screen.getByRole("button", { name: "All Files" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Folder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload File" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "打开 Trash" })).not.toBeInTheDocument();
    expect(screen.queryByTitle("Trash")).not.toBeInTheDocument();
  });
});
