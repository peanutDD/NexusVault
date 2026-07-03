import { beforeEach, describe, expect, it, vi } from "vitest";
import { AxiosHeaders } from "axios";
import api, { limitedApi } from "./api";
import { fileListService } from "./fileListService";
import { REQUEST } from "../constants";

vi.mock("./api", () => ({
  default: {
    delete: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
  limitedApi: {
    get: vi.fn(),
  },
}));

const limitedGet = vi.mocked(limitedApi.get);
const apiGet = vi.mocked(api.get);

describe("fileListService fulltext search", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("uses the fulltext endpoint for non-empty search queries and keeps snippets", async () => {
    limitedGet.mockResolvedValueOnce({
      data: {
        query: "invoice",
        count: 1,
        search: {
          index_status: "ready",
          count: 1,
          ocr: {
            enabled: true,
            pdf_max_pages: 8,
            tesseract_available: true,
            poppler_available: true,
          },
        },
        files: [
          {
            file: {
              id: "file-1",
              filename: "stored-name.txt",
              original_filename: "receipt.txt",
              file_size: 128,
              mime_type: "text/plain",
              category: null,
              folder_id: null,
              created_at: "2026-05-14T00:00:00Z",
              deleted_at: null,
            },
            score: 3.5,
            snippet: "paid invoice number 42",
            match_source: "content",
          },
        ],
      },
      status: 200,
      statusText: "OK",
      headers: {},
      config: { headers: new AxiosHeaders() },
    });

    const result = await fileListService.listFiles({
      search: "invoice",
      limit: 20,
      folder_id: "folder-1",
      mime_type: "text/plain",
      collection: "pinned",
      tag_id: "tag-1",
    });

    expect(limitedGet).toHaveBeenCalledWith(
      "/api/files/search/fulltext?q=invoice&limit=20&folder_id=folder-1&mime_type=text%2Fplain&tag_id=tag-1&collection=pinned",
      { timeout: REQUEST.LIST_QUERY_TIMEOUT_MS },
    );
    expect(result.total).toBe(1);
    expect(result.search).toEqual({
      index_status: "ready",
      count: 1,
      ocr: {
        enabled: true,
        pdf_max_pages: 8,
        tesseract_available: true,
        poppler_available: true,
      },
    });
    expect(result.files[0].search_snippet).toBe("paid invoice number 42");
    expect(result.files[0].match_source).toBe("content");
  });

  it("sends combined smart collection and tag filters to normal listing requests", async () => {
    limitedGet.mockResolvedValueOnce({
      data: {
        files: [],
        total: 0,
        page: 1,
        limit: 20,
      },
      status: 200,
      statusText: "OK",
      headers: {},
      config: { headers: new AxiosHeaders() },
    });

    await fileListService.listFiles({
      collection: "favorites,images",
      tag_id: "tag-s",
      limit: 20,
    });

    expect(limitedGet).toHaveBeenCalledWith(
      "/api/files?collection=favorites%2Cimages&tag_id=tag-s&limit=20",
      { timeout: REQUEST.LIST_QUERY_TIMEOUT_MS },
    );
  });

  it("loads smart collection and tag counts from the dedicated counts endpoint", async () => {
    apiGet.mockResolvedValueOnce({
      data: {
        collections: { favorites: 2, recent: 1 },
        tags: { "tag-s": 3 },
      },
      status: 200,
      statusText: "OK",
      headers: {},
      config: { headers: new AxiosHeaders() },
    });

    const counts = await fileListService.getCollectionCounts({
      folder_id: "folder-1",
      search: "clip",
      mime_type: "video/",
    });

    expect(apiGet).toHaveBeenCalledWith(
      "/api/files/collection-counts?folder_id=folder-1&search=clip&mime_type=video%2F",
      { timeout: REQUEST.LIST_QUERY_TIMEOUT_MS },
    );
    expect(counts.collections.favorites).toBe(2);
    expect(counts.tags["tag-s"]).toBe(3);
  });

  it("keeps the root folder scope when loading smart collection counts", async () => {
    apiGet.mockResolvedValueOnce({
      data: {
        collections: { images: 5 },
        tags: {},
      },
      status: 200,
      statusText: "OK",
      headers: {},
      config: { headers: new AxiosHeaders() },
    });

    await fileListService.getCollectionCounts({
      folder_id: "root",
      search: "111",
      mime_type: "image/",
    });

    expect(apiGet).toHaveBeenCalledWith(
      "/api/files/collection-counts?folder_id=root&search=111&mime_type=image%2F",
      { timeout: REQUEST.LIST_QUERY_TIMEOUT_MS },
    );
  });

  it("keeps the root folder scope for fulltext searches too", async () => {
    limitedGet.mockResolvedValueOnce({
      data: {
        query: "3",
        count: 0,
        search: {
          index_status: "ready",
          count: 0,
          ocr: {
            enabled: true,
            pdf_max_pages: 5,
            tesseract_available: true,
            poppler_available: true,
          },
        },
        files: [],
      },
      status: 200,
      statusText: "OK",
      headers: {},
      config: { headers: new AxiosHeaders() },
    });

    await fileListService.listFiles({ search: "3", folder_id: null });

    expect(limitedGet).toHaveBeenCalledWith(
      "/api/files/search/fulltext?q=3&folder_id=root",
      { timeout: REQUEST.LIST_QUERY_TIMEOUT_MS },
    );
  });

  it("preserves pagination and sorting parameters for fulltext searches", async () => {
    limitedGet.mockResolvedValueOnce({
      data: {
        query: "r",
        count: 31,
        search: {
          index_status: "fallback",
          count: 31,
          ocr: {
            enabled: true,
            pdf_max_pages: 5,
            tesseract_available: true,
            poppler_available: true,
          },
        },
        files: [],
      },
      status: 200,
      statusText: "OK",
      headers: {},
      config: { headers: new AxiosHeaders() },
    });

    await fileListService.listFiles({
      search: "r",
      folder_id: null,
      page: 2,
      limit: 30,
      sort_by: "type",
      sort_order: "asc",
    });

    expect(limitedGet).toHaveBeenCalledWith(
      "/api/files/search/fulltext?q=r&limit=30&page=2&folder_id=root&sort_by=type&sort_order=asc",
      { timeout: REQUEST.LIST_QUERY_TIMEOUT_MS },
    );
  });
});
