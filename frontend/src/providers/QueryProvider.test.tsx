import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QueryProvider } from "./QueryProvider";

vi.mock("@tanstack/react-query-devtools", () => ({
  ReactQueryDevtools: () => {
    throw new Error("devtools crashed");
  },
}));

vi.mock("../utils/telemetry", () => ({
  trackError: vi.fn(),
}));

describe("QueryProvider", () => {
  it("keeps app content visible when React Query Devtools crashes", async () => {
    render(
      <QueryProvider>
        <main>App content</main>
      </QueryProvider>,
    );

    expect(await screen.findByText("App content")).toBeInTheDocument();
  });
});
