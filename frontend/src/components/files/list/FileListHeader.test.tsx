import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FileListHeader from "./FileListHeader";
import type React from "react";
import type { ComponentProps } from "react";

vi.mock("../../../services/tags", () => ({
  tagsService: {
    list: vi
      .fn()
      .mockResolvedValue([{ id: "tag-1", name: "Work", color: "#8b5cf6" }]),
  },
}));

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

function renderHeader(
  overrides: Partial<ComponentProps<typeof FileListHeader>> = {},
) {
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
        {...overrides}
      />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FileListHeader", () => {
  it("does not render a Trash button in the search toolbar", async () => {
    renderHeader();

    expect(
      screen.getByRole("button", { name: "All Files" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "New Folder" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Upload File" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Work/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "打开 Trash" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTitle("Trash")).not.toBeInTheDocument();
  });

  it("marks collection chips with file-list neuromorphic hooks instead of generic glass pills", async () => {
    renderHeader();

    expect(screen.queryByTestId("file-list-collections")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Favorites" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Work/i })).not.toBeInTheDocument();
  });

  it("keeps collection chips out of the search toolbar", async () => {
    renderHeader();

    expect(screen.getByRole("search")).toBeInTheDocument();
    await Promise.resolve();
    expect(screen.queryByRole("button", { name: "All" })).not.toBeInTheDocument();
  });
});
