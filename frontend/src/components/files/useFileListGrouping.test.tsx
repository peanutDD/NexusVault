import { render, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { FileMetadata } from "../../types/files";
import { FILE_TYPE_LABELS } from "./fileTypeLabels";
import { useFileGroupingWithIcons } from "./useFileListGrouping";

function makeFile(overrides: Partial<FileMetadata>): FileMetadata {
  const id = overrides.id ?? "file-a";
  return {
    id,
    filename: `${id}.bin`,
    original_filename: `${id}.bin`,
    file_size: 1,
    mime_type: "application/octet-stream",
    category: null,
    folder_id: null,
    created_at: "2026-05-23T00:00:00.000Z",
    ...overrides,
  };
}

describe("useFileGroupingWithIcons", () => {
  it("renders the pinned group badge with a visible lucide icon", () => {
    const { container } = render(<>{FILE_TYPE_LABELS.pinned.icon}</>);

    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelector("i")).toBeNull();
    expect(container.querySelector(".fileListPinnedGroupIconBadge")).toBeInTheDocument();
    expect(container.querySelector(".fileListPinnedGroupIcon")).toBeInTheDocument();
  });

  it("promotes pinned files into a top group while the all collection is active", () => {
    const pinnedImage = makeFile({
      id: "pinned-image",
      mime_type: "image/png",
      is_pinned: true,
    });
    const regularImage = makeFile({ id: "regular-image", mime_type: "image/jpeg" });
    const pdf = makeFile({ id: "regular-pdf", mime_type: "application/pdf" });

    const { result } = renderHook(() =>
      useFileGroupingWithIcons([regularImage, pinnedImage, pdf], true, ""),
    );

    expect(result.current.groupedFiles?.map((group) => group.key)).toEqual([
      "pinned",
      "image",
      "application/pdf",
    ]);
    expect(result.current.groupedFiles?.[0]?.label).toBe("Pinned");
    expect(result.current.groupedFiles?.[0]?.files.map((file) => file.id)).toEqual([
      "pinned-image",
    ]);
    expect(
      result.current.groupedFiles
        ?.find((group) => group.key === "image")
        ?.files.map((file) => file.id),
    ).toEqual(["regular-image"]);
    expect(result.current.displayFiles.map((file) => file.id)).toEqual([
      "pinned-image",
      "regular-image",
      "regular-pdf",
    ]);
  });

  it("does not nest a pinned group while the pinned collection itself is active", () => {
    const pinnedImage = makeFile({
      id: "pinned-image",
      mime_type: "image/png",
      is_pinned: true,
    });
    const pinnedPdf = makeFile({
      id: "pinned-pdf",
      mime_type: "application/pdf",
      is_pinned: true,
    });

    const { result } = renderHook(() =>
      useFileGroupingWithIcons([pinnedImage, pinnedPdf], true, "pinned"),
    );

    expect(result.current.groupedFiles?.map((group) => group.key)).toEqual([
      "image",
      "application/pdf",
    ]);
    expect(result.current.displayFiles.map((file) => file.id)).toEqual([
      "pinned-image",
      "pinned-pdf",
    ]);
  });
});
