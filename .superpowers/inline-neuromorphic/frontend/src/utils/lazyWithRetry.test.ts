import { describe, expect, it, vi } from "vitest";
import { lazyWithRetry } from "./lazyWithRetry";

describe("lazyWithRetry", () => {
  it("retries a transient dynamic import failure", async () => {
    vi.useFakeTimers();
    const importer = vi
      .fn<() => Promise<{ default: () => null }>>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch dynamically imported module"))
      .mockResolvedValueOnce({ default: () => null });

    const retryingImport = lazyWithRetry(importer, {
      maxRetries: 1,
      initialDelay: 25,
      maxDelay: 25,
    });
    const loaded = retryingImport();

    await vi.advanceTimersByTimeAsync(25);

    await expect(loaded).resolves.toHaveProperty("default");
    expect(importer).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
