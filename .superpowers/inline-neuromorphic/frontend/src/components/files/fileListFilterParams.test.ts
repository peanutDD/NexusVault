import { describe, expect, it } from "vitest";
import {
  clearSmartFilterParams,
  getCurrentFolderParam,
  parseCollectionParam,
  toggleCollectionParam,
  toggleTagParam,
} from "./fileListFilterParams";

describe("file list filter URL params", () => {
  it("parses comma separated smart collections without duplicates", () => {
    expect(parseCollectionParam("favorites,images,favorites,, recent ")).toEqual([
      "favorites",
      "images",
      "recent",
    ]);
  });

  it("reads the current folder from both folder and legacy folder_id params", () => {
    expect(getCurrentFolderParam(new URLSearchParams("folder=folder-new"))).toBe("folder-new");
    expect(getCurrentFolderParam(new URLSearchParams("folder_id=folder-legacy"))).toBe(
      "folder-legacy",
    );
    expect(getCurrentFolderParam(new URLSearchParams("folder=&folder_id=folder-legacy"))).toBe(
      "folder-legacy",
    );
  });

  it("toggles smart collections without clearing the active tag", () => {
    const params = new URLSearchParams("collection=favorites&tag=tag-s");

    const next = toggleCollectionParam(params, "images");

    expect(next.get("collection")).toBe("favorites,images");
    expect(next.get("tag")).toBe("tag-s");
  });

  it("keeps the current folder when toggling smart collection chips", () => {
    const params = new URLSearchParams("folder=folder-1&collection=favorites&tag=tag-s");

    const next = toggleCollectionParam(params, "images");

    expect(next.get("folder")).toBe("folder-1");
    expect(next.get("collection")).toBe("favorites,images");
    expect(next.get("tag")).toBe("tag-s");
  });

  it("keeps the current folder when toggling tag chips", () => {
    const params = new URLSearchParams("folder=folder-1&collection=videos&tag=tag-s");

    const next = toggleTagParam(params, "tag-a");

    expect(next.get("folder")).toBe("folder-1");
    expect(next.get("collection")).toBe("videos");
    expect(next.get("tag")).toBe("tag-a");
  });

  it("toggles tags without clearing active smart collections", () => {
    const params = new URLSearchParams("collection=videos&tag=tag-s");

    const next = toggleTagParam(params, "tag-s");

    expect(next.get("collection")).toBe("videos");
    expect(next.has("tag")).toBe(false);
  });

  it("clears collection and tag together while preserving the current folder", () => {
    const params = new URLSearchParams(
      "folder=folder-1&collection=favorites,pinned&tag=tag-s&search=clip",
    );

    const next = clearSmartFilterParams(params);

    expect(next.get("folder")).toBe("folder-1");
    expect(next.get("search")).toBe("clip");
    expect(next.has("collection")).toBe(false);
    expect(next.has("tag")).toBe(false);
  });
});
