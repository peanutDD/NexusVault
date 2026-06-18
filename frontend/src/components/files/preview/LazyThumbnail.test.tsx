import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LazyThumbnail from "./LazyThumbnail";
import { fileService } from "../../../services/files";

vi.mock("../../../services/files", () => ({
  fileService: {
    getThumbnailUrl: vi.fn(),
    fetchThumbnailBlob: vi.fn(),
  },
}));

const originalCreateObjectURL = URL.createObjectURL;

describe("LazyThumbnail", () => {
  beforeEach(() => {
    vi.mocked(fileService.getThumbnailUrl).mockReturnValue(
      "http://api.local/api/files/file-1/thumbnail?w=400",
    );
    vi.mocked(fileService.fetchThumbnailBlob).mockResolvedValue(
      new Blob(["image"], { type: "image/png" }),
    );
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:thumbnail-file-1"),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: originalCreateObjectURL,
    });
  });

  it("keeps blob fallback thumbnails from being overridden by responsive srcset URLs", async () => {
    render(
      <LazyThumbnail
        fileId="file-1"
        mimeType="image/png"
        filename="screenshot.png"
        priority="high"
      />,
    );

    fireEvent.error(screen.getByRole("img", { name: "screenshot.png" }));

    const fallbackImage = await screen.findByRole("img", {
      name: "screenshot.png",
    });

    await waitFor(() => {
      expect(fallbackImage).toHaveAttribute("src", "blob:thumbnail-file-1");
    });
    expect(fallbackImage).not.toHaveAttribute("srcset");
    expect(fileService.fetchThumbnailBlob).toHaveBeenCalledWith("file-1");
  });
});
