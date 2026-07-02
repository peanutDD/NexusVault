import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { webDavConnectionService } from "./webDavConnection";

describe("webDavConnectionService", () => {
  it("sends a PROPFIND request with Basic Auth and Depth 0", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 207 });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      webDavConnectionService.testConnection({
        serverUrl: "http://192.168.0.108:5173/dav",
        username: "alice@example.com",
        token: "webdav-token",
      }),
    ).resolves.toEqual({ ok: true, status: 207 });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://192.168.0.108:5173/dav/",
      expect.objectContaining({
        method: "PROPFIND",
        headers: expect.objectContaining({
          Authorization: `Basic ${window.btoa("alice@example.com:webdav-token")}`,
          Depth: "0",
        }),
      }),
    );
  });

  it("proxies /dav through the Vite dev server like /api", () => {
    const config = readFileSync("vite.config.ts", "utf8");

    expect(config).toContain('"/api"');
    expect(config).toContain('"/dav"');
    expect(config).toContain("target: proxyTarget");
  });
});
