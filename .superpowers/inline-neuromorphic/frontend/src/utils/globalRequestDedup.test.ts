import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { describe, expect, it, vi } from "vitest";
import { createDedupAdapter } from "./globalRequestDedup";

function makeConfig(url: string): InternalAxiosRequestConfig {
  return {
    url,
    method: "get",
    headers: {} as InternalAxiosRequestConfig["headers"],
  } as InternalAxiosRequestConfig;
}

function makeResponse(
  data: unknown,
  config: InternalAxiosRequestConfig,
): AxiosResponse {
  return {
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  };
}

describe("createDedupAdapter", () => {
  it("does not reuse cached trash list responses after restore mutations", async () => {
    const defaultAdapter = vi
      .fn()
      .mockImplementationOnce((config: InternalAxiosRequestConfig) =>
        Promise.resolve(makeResponse({ files: ["stale"] }, config)),
      )
      .mockImplementationOnce((config: InternalAxiosRequestConfig) =>
        Promise.resolve(makeResponse({ files: [] }, config)),
      );
    const adapter = createDedupAdapter(defaultAdapter);
    const firstConfig = makeConfig("/api/files/trash");
    const secondConfig = makeConfig("/api/files/trash");

    const first = await adapter(firstConfig);
    const second = await adapter(secondConfig);

    expect(defaultAdapter).toHaveBeenCalledTimes(2);
    expect(first.data).toEqual({ files: ["stale"] });
    expect(second.data).toEqual({ files: [] });
  });
});
