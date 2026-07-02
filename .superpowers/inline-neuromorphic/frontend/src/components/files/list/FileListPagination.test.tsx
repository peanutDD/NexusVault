import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FileListPagination from "./FileListPagination";

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds = [];
  disconnect = vi.fn();
  observe = vi.fn();
  takeRecords = vi.fn(() => []);
  unobserve = vi.fn();
}

describe("FileListPagination neuromorphic controls", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("marks Load more as a raised neuromorphic control instead of a cyber gradient", () => {
    render(
      <FileListPagination
        page={1}
        totalPages={3}
        hasMore
        loadingMore={false}
        onLoadMore={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Load more/i })).toHaveClass(
      "neu-raised-sm",
      "loadMoreCyber",
      "toolbarActionBtn",
    );
    expect(screen.getByRole("button", { name: /Load more/i })).toHaveClass(
      "active:shadow-[var(--neu-pressed-shadow)]",
    );
  });

  it("marks traditional pagination buttons for neuromorphic raised and pressed states", () => {
    render(
      <FileListPagination
        page={2}
        totalPages={5}
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "上一页" })).toHaveClass(
      "neu-raised-sm",
      "paginationNeuButton",
    );
    expect(screen.getByRole("button", { name: "下一页" })).toHaveClass(
      "neu-raised-sm",
      "paginationNeuButton",
    );
    expect(screen.getByRole("button", { name: "2" })).toHaveClass(
      "neu-raised-sm",
      "neu-pressed",
      "paginationNeuButton",
      "paginationNeuButtonActive",
    );
  });
});
