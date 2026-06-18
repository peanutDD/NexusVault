import { render, screen } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "../store/authStore";
import { QueryProvider } from "./QueryProvider";
import { appQueryClient } from "./queryClient";

vi.mock("@tanstack/react-query-devtools", () => ({
  ReactQueryDevtools: () => {
    throw new Error("devtools crashed");
  },
}));

vi.mock("../utils/telemetry", () => ({
  trackError: vi.fn(),
}));

describe("QueryProvider", () => {
  beforeEach(() => {
    appQueryClient.clear();
    localStorage.clear();
    useAuthStore.setState({
      user: {
        id: "user-a",
        username: "alice",
        email: "alice@example.com",
        created_at: "2026-05-18T00:00:00.000Z",
      },
      token: "token-a",
    });
  });

  it("keeps app content visible when React Query Devtools crashes", async () => {
    render(
      <QueryProvider>
        <main>App content</main>
      </QueryProvider>,
    );

    expect(await screen.findByText("App content")).toBeInTheDocument();
  });

  it("clears authenticated query cache when the active account changes", async () => {
    appQueryClient.setQueryData(["folders", "contents", null], {
      folders: [{ id: "folder-a", name: "alice-private" }],
    });

    render(
      <QueryProvider>
        <main>App content</main>
      </QueryProvider>,
    );

    expect(appQueryClient.getQueryData(["folders", "contents", null])).toBeDefined();

    act(() => {
      useAuthStore.setState({
        user: {
          id: "user-b",
          username: "bob",
          email: "bob@example.com",
          created_at: "2026-05-18T00:00:00.000Z",
        },
        token: "token-b",
      });
    });

    expect(appQueryClient.getQueryData(["folders", "contents", null])).toBeUndefined();
  });
});
