import { beforeEach, describe, expect, it, vi } from "vitest";
import { AxiosHeaders } from "axios";
import api from "./api";
import { folderService } from "./folders";
import { REQUEST } from "../constants";

vi.mock("./api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const apiGet = vi.mocked(api.get);

describe("folderService query timeouts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("applies the list timeout when loading folder contents", async () => {
    apiGet.mockResolvedValueOnce({
      data: {
        folders: [],
        path: [],
      },
      status: 200,
      statusText: "OK",
      headers: {},
      config: { headers: new AxiosHeaders() },
    });

    const result = await folderService.getContents("folder-1");

    expect(apiGet).toHaveBeenCalledWith(
      "/api/folders/contents?parent_id=folder-1",
      { timeout: REQUEST.LIST_QUERY_TIMEOUT_MS },
    );
    expect(result).toEqual({ folders: [], path: [] });
  });
});
