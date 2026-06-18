import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WebDavAccessSection from "./WebDavAccessSection";
import { useAuthStore } from "../../store/authStore";
import {
  useCreateWebDavWizardToken,
  useWebDavActivity,
  useWebDavDiagnostics,
} from "../../hooks/useApiTokens";

vi.mock("../../store/authStore", () => ({
  useAuthStore: vi.fn(),
}));

vi.mock("../../hooks/useApiTokens", () => ({
  useCreateWebDavWizardToken: vi.fn(),
  useWebDavActivity: vi.fn(),
  useWebDavDiagnostics: vi.fn(),
}));

vi.mock("../../hooks/useClipboard", () => ({
  useClipboard: () => ({ copy: vi.fn().mockResolvedValue(true) }),
}));

const createMutate = vi.fn();
const diagnosticsRefetch = vi.fn();

function diagnosticFixture(index: number) {
  return {
    token_id: `token-${index}`,
    token_name: `Device ${index}`,
    webdav_enabled: true,
    webdav_read_only: index % 2 === 0,
    webdav_root_folder_id: null,
    last_used_at: "2026-05-21T10:00:00Z",
    last_webdav_access_at: "2026-05-21T10:00:00Z",
    last_ip: `203.0.113.${index}`,
    last_user_agent: `Client/${index}.0`,
    read_count: index,
    write_count: index + 1,
    status_buckets: {
      "2xx": index,
      "3xx": 0,
      "401": 0,
      "403": index === 3 ? 1 : 0,
      "416": 0,
      "423": index === 4 ? 1 : 0,
      "5xx": 0,
      other: 0,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { origin: "http://localhost:3000" },
  });
  vi.mocked(useAuthStore).mockImplementation((selector) =>
    selector({
      user: {
        id: "user-1",
        username: "alice",
        email: "alice@example.com",
        created_at: "2026-05-04T00:00:00Z",
      },
      token: "session-token",
      setAuth: vi.fn(),
      updateUser: vi.fn(),
      clearAuth: vi.fn(),
      isAuthenticated: () => true,
    }),
  );
  vi.mocked(useCreateWebDavWizardToken).mockReturnValue({
    isPending: false,
    mutate: createMutate,
  } as unknown as ReturnType<typeof useCreateWebDavWizardToken>);
  vi.mocked(useWebDavActivity).mockReturnValue({
    data: [
      {
        id: "event-1",
        api_token_id: "token-1",
        token_name: "WebDAV setup",
        method: "PROPFIND",
        path: "/",
        status_code: 207,
        read_only: false,
        ip_address: "203.0.113.7",
        user_agent: "Finder/15.0",
        created_at: "2026-05-21T10:00:00Z",
      },
    ],
    isLoading: false,
  } as unknown as ReturnType<typeof useWebDavActivity>);
  vi.mocked(useWebDavDiagnostics).mockReturnValue({
    data: [
      {
        token_id: "token-1",
        token_name: "MacBook Finder",
        webdav_enabled: true,
        webdav_read_only: false,
        webdav_root_folder_id: null,
        last_used_at: "2026-05-21T10:00:00Z",
        last_webdav_access_at: "2026-05-21T10:00:00Z",
        last_ip: "203.0.113.7",
        last_user_agent: "Finder/15.0",
        read_count: 3,
        write_count: 2,
        status_buckets: {
          "2xx": 4,
          "3xx": 0,
          "401": 0,
          "403": 1,
          "416": 0,
          "423": 1,
          "5xx": 0,
          other: 0,
        },
      },
    ],
    isFetching: false,
    isLoading: false,
    refetch: diagnosticsRefetch,
  } as unknown as ReturnType<typeof useWebDavDiagnostics>);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, status: 207 }),
  );
});

describe("WebDavAccessSection", () => {
  it("creates a 90-day read/write WebDAV token and tests it while visible", async () => {
    createMutate.mockImplementation((_input, options) => {
      options.onSuccess({
        token: {
          id: "token-1",
          name: "WebDAV setup",
          token: "secret-webdav-token",
          expires_at: "2026-08-19T00:00:00Z",
          created_at: "2026-05-21T00:00:00Z",
          webdav_enabled: true,
          webdav_read_only: false,
          webdav_root_folder_id: null,
        },
      });
    });

    render(<WebDavAccessSection />);

    await userEvent.click(
      screen.getByRole("button", { name: /Create read\/write token/i }),
    );

    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "MacBook Finder",
        webdav_read_only: false,
        webdav_root_folder_id: null,
      }),
      expect.objectContaining({
        onError: expect.any(Function),
        onSuccess: expect.any(Function),
      }),
    );
    expect(await screen.findByText("secret-webdav-token")).toBeInTheDocument();
    expect(screen.getByText(/Read\/write · expires/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:3000/dav/",
        expect.objectContaining({
          method: "PROPFIND",
          headers: expect.objectContaining({
            Depth: "0",
          }),
        }),
      );
    });
    const message = await screen.findByText(/Connection test passed/i);
    expect(message).toBeInTheDocument();
    const alert = message.closest(".appAlertMessage");
    expect(alert).toHaveClass("appAlertMessage", "appAlertMessage--info");
  });

  it("allows wizard status messages to be closed and auto-dismisses them", async () => {
    vi.useFakeTimers();
    createMutate.mockImplementation((_input, options) => {
      options.onSuccess({
        token: {
          id: "token-1",
          name: "WebDAV setup",
          token: "secret-webdav-token",
          expires_at: "2026-08-19T00:00:00Z",
          created_at: "2026-05-21T00:00:00Z",
          webdav_enabled: true,
          webdav_read_only: false,
          webdav_root_folder_id: null,
        },
      });
    });

    render(<WebDavAccessSection />);

    fireEvent.click(screen.getByRole("button", { name: /Create read\/write token/i }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText(/Connection test passed/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(screen.queryByText(/Connection test passed/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Create read\/write token/i }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText(/Connection test passed/i)).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByText(/Connection test passed/i)).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("lets users hide the one-time token and clears it after copying", async () => {
    createMutate.mockImplementation((_input, options) => {
      options.onSuccess({
        token: {
          id: "token-1",
          name: "WebDAV setup",
          token: "secret-webdav-token",
          expires_at: "2026-08-19T00:00:00Z",
          created_at: "2026-05-21T00:00:00Z",
          webdav_enabled: true,
          webdav_read_only: false,
          webdav_root_folder_id: null,
        },
      });
    });

    render(<WebDavAccessSection />);

    await userEvent.click(
      screen.getByRole("button", { name: /Create read\/write token/i }),
    );

    expect(await screen.findByText("secret-webdav-token")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Hide one-time token/i }));
    expect(screen.queryByText("secret-webdav-token")).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /Create read\/write token/i }),
    );
    expect(await screen.findByText("secret-webdav-token")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Copy token/i }));
    await waitFor(() => {
      expect(screen.queryByText("secret-webdav-token")).not.toBeInTheDocument();
    });
    expect(screen.getByText(/Token copied. Secret hidden/i)).toBeInTheDocument();
  });

  it("shows recent WebDAV activity without exposing the session token", () => {
    render(<WebDavAccessSection />);

    expect(screen.getByText("Recent WebDAV activity")).toBeInTheDocument();
    expect(screen.getByText("PROPFIND")).toBeInTheDocument();
    expect(screen.getByText("/")).toBeInTheDocument();
    expect(screen.getByText("207")).toBeInTheDocument();
    expect(screen.queryByText("session-token")).not.toBeInTheDocument();
  });

  it("shows WebDAV device diagnostics with client metadata and error buckets", () => {
    render(<WebDavAccessSection />);

    expect(screen.getByText("Device diagnostics")).toBeInTheDocument();
    expect(screen.getByText("MacBook Finder")).toBeInTheDocument();
    expect(screen.getByText("203.0.113.7")).toBeInTheDocument();
    expect(screen.getByText("Finder/15.0")).toBeInTheDocument();
    expect(screen.getByText(/Reads 3/i)).toBeInTheDocument();
    expect(screen.getByText(/Writes 2/i)).toBeInTheDocument();
    expect(screen.getByTestId("webdav-status-bucket-403")).toHaveTextContent("403-1");
    expect(screen.getByTestId("webdav-status-bucket-423")).toHaveTextContent("423-1");
    expect(screen.queryByText("session-token")).not.toBeInTheDocument();
  });

  it("explains each diagnostics card with dedicated field sections", () => {
    render(<WebDavAccessSection />);

    expect(screen.getByText("Latest source")).toBeInTheDocument();
    expect(screen.getByText("Access mode")).toBeInTheDocument();
    expect(screen.getByText("Request counts")).toBeInTheDocument();
    expect(screen.getByText("HTTP results")).toBeInTheDocument();
    expect(screen.getByText("Root scope")).toBeInTheDocument();
    expect(
      screen.getByText("Most recent IP and client fingerprint seen on this token."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Permission profile currently assigned to this device token."),
    ).toBeInTheDocument();
  });

  it("formats HTTP result chips with a dash separator and a purple-emphasis count", () => {
    render(<WebDavAccessSection />);

    const statusBucket = screen.getByTestId("webdav-status-bucket-403");
    const count = statusBucket.querySelector("span:last-child");

    expect(statusBucket).toHaveTextContent("403-1");
    expect(statusBucket).toContainHTML("-");
    expect(count).toHaveClass("text-[rgba(var(--rgb-purple-400),0.96)]");
  });

  it("renders the Basic Auth and Copy URL controls as matching primary neuromorphic pills", () => {
    render(<WebDavAccessSection />);

    const chip = screen.getByTestId("webdav-basic-auth-chip");
    const copyButton = screen.getByRole("button", { name: /Copy URL/i });
    const copyUsernameButton = screen.getByRole("button", { name: /Copy username/i });

    [chip, copyButton, copyUsernameButton].forEach((control) => {
      expect(control).toHaveClass("settings-neu-primary-pill");
      expect(control).toHaveClass("rounded-full");
      expect(control).toHaveClass("min-w-[clamp(8.75rem,12vw,9.5rem)]");
      expect(control).toHaveClass("[background:var(--settings-action-bg)]");
      expect(control).toHaveClass("shadow-[var(--settings-action-shadow)]");
      expect(control).toHaveClass("text-[var(--settings-action-text)]");
    });

    expect(screen.getByTestId("webdav-basic-auth-mobile-slot")).toHaveClass(
      "w-full",
      "px-[clamp(0.78rem,1.8vw,1rem)]",
      "md:w-auto",
      "md:px-0",
    );
    expect(chip).toHaveClass("w-full");
    expect(chip).toHaveClass("md:w-fit");
    expect(chip).toHaveClass("md:mr-[clamp(0.78rem,1.8vw,1rem)]");
    expect(chip).toHaveClass("whitespace-nowrap");
    expect(chip).toHaveClass("text-[length:var(--settings-text-sm)]");
    expect(chip).not.toHaveClass("text-[0.875rem]", "w-[8rem]", "min-w-[8rem]");
    expect(copyButton).not.toHaveClass("settings-neu-raised-button");
    expect(copyUsernameButton).toHaveClass(
      "webdav-copy-username-button",
      "font-brand",
      "w-full",
      "gap-[clamp(0.39rem,0.9vw,0.5rem)]",
    );
    expect(copyUsernameButton).not.toHaveClass(
      "settings-neu-raised-button",
      "text-[var(--settings-chip-text)]",
      "sm:w-fit",
    );
  });

  it("keeps Copy username on the theme action background token with light and dark variants", () => {
    render(<WebDavAccessSection />);

    const copyUsernameButton = screen.getByRole("button", { name: /Copy username/i });
    const tokenCss = readFileSync(
      resolve(__dirname, "../../styles/tokens.css"),
      "utf8",
    ).replace(/\s+/g, " ");
    const darkActionBg = tokenCss.match(
      /:root,\s*\[data-theme="dark"\],\s*\.dark\s*\{[^}]*--settings-action-bg:\s*([^;]+);/,
    )?.[1]?.trim();
    const lightActionBg = tokenCss.match(
      /:root\[data-theme="light"\],\s*:root\.light\s*\{[^}]*--settings-action-bg:\s*([^;]+);/,
    )?.[1]?.trim();

    expect(copyUsernameButton).toHaveClass("[background:var(--settings-action-bg)]");
    expect(darkActionBg).toBeTruthy();
    expect(lightActionBg).toBeTruthy();
    expect(lightActionBg).not.toEqual(darkActionBg);
  });

  it("shows a pressed animation state while Copy URL is tapped", () => {
    render(<WebDavAccessSection />);

    const copyButton = screen.getByRole("button", { name: /Copy URL/i });

    fireEvent.pointerDown(copyButton);

    expect(copyButton).toHaveClass("webdav-copy-url-pressed");
    expect(copyButton).toHaveClass("scale-[0.98]");
    expect(copyButton).toHaveClass(
      "shadow-[var(--settings-action-shadow-active)]",
    );

    fireEvent.pointerUp(copyButton);

    expect(copyButton).not.toHaveClass("webdav-copy-url-pressed");
    expect(copyButton).not.toHaveClass("scale-[0.98]");
  });

  it("refreshes only the WebDAV device diagnostics list from the panel header", async () => {
    render(<WebDavAccessSection />);

    await userEvent.click(
      screen.getByRole("button", { name: /Refresh device diagnostics/i }),
    );

    expect(diagnosticsRefetch).toHaveBeenCalledTimes(1);
    expect(screen.getByText("MacBook Finder")).toBeInTheDocument();
  });

  it("renders diagnostics count and refresh controls as matching inset actions", () => {
    render(<WebDavAccessSection />);

    const count = screen.getByTestId("webdav-diagnostics-count-action");
    const refresh = screen.getByRole("button", {
      name: /Refresh device diagnostics/i,
    });

    expect(count).toHaveClass("settings-neu-inset-control");
    expect(refresh).toHaveClass("settings-neu-inset-control");
    expect(count).toHaveClass("w-full");
    expect(refresh).toHaveClass("w-full");
    expect(count).toHaveClass("sm:w-auto");
    expect(refresh).toHaveClass("sm:w-auto");
    expect(count).toHaveClass("min-h-[clamp(2.5rem,5.8vw,2.75rem)]");
    expect(refresh).toHaveClass("min-h-[clamp(2.5rem,5.8vw,2.75rem)]");
    expect(refresh).not.toHaveClass("settings-neu-raised-button");
  });

  it("renders the diagnostics container with explicit neuromorphic inset material", () => {
    render(<WebDavAccessSection />);

    const panel = screen.getByTestId("webdav-diagnostics-panel");

    expect(panel).toHaveClass("settings-neu-inset-panel");
    expect(panel).toHaveClass("[background:var(--neu-inset-bg)]");
    expect(panel).toHaveClass("shadow-[var(--neu-inset-shadow)]");
    expect(panel).toHaveClass("border-transparent");
    expect(panel).not.toHaveClass("[background:var(--settings-panel-bg)]");
    expect(panel).not.toHaveClass("shadow-[var(--settings-panel-shadow)]");
  });

  it("renders the WebDAV wizard container as a concave neuromorphic panel", () => {
    render(<WebDavAccessSection />);

    const panel = screen.getByTestId("webdav-wizard-panel");

    expect(panel).toHaveClass("settings-neu-inset-panel");
    expect(panel).toHaveClass("[background:var(--neu-inset-bg)]");
    expect(panel).toHaveClass("shadow-[var(--neu-inset-shadow)]");
    expect(panel).toHaveClass("border-transparent");
    expect(panel).toHaveClass("rounded-[clamp(1rem,2.4vw,1.25rem)]");
    expect(panel).not.toHaveClass("[background:var(--settings-panel-bg)]");
    expect(panel).not.toHaveClass("shadow-[var(--settings-panel-shadow)]");
  });

  it("shows the backend WebDAV URL instead of the Vite dev server URL for Finder", () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        hostname: "192.168.0.102",
        origin: "http://192.168.0.102:5173",
        port: "5173",
        protocol: "http:",
      },
    });

    render(<WebDavAccessSection />);

    expect(screen.getByText("http://192.168.0.102:3000/dav")).toBeInTheDocument();
    expect(screen.queryByText("http://192.168.0.102:5173/dav")).not.toBeInTheDocument();
  });

  it("keeps device diagnostics to five visible rows with internal scrolling", () => {
    vi.mocked(useWebDavDiagnostics).mockReturnValue({
      data: Array.from({ length: 6 }, (_, index) => diagnosticFixture(index + 1)),
      isFetching: false,
      isLoading: false,
      refetch: diagnosticsRefetch,
    } as unknown as ReturnType<typeof useWebDavDiagnostics>);

    render(<WebDavAccessSection />);

    const viewport = screen.getByTestId("webdav-diagnostics-list-viewport");
    expect(viewport).toHaveClass("overflow-y-auto");
    expect(viewport).toHaveClass("max-h-[var(--webdav-diagnostics-list-max)]");
    expect(viewport).toHaveStyle({
      "--webdav-diagnostics-visible-rows": "5",
    });
    expect(screen.getAllByTestId("webdav-diagnostics-item")).toHaveLength(6);
  });

  it("lets users close recent WebDAV activity and keeps the full list bounded", async () => {
    vi.mocked(useWebDavActivity).mockReturnValue({
      data: Array.from({ length: 7 }, (_, index) => ({
        id: `event-${index + 1}`,
        api_token_id: "token-1",
        token_name: "WebDAV setup",
        method: index % 2 === 0 ? "PROPFIND" : "PUT",
        path: `/activity-${index + 1}`,
        status_code: index % 2 === 0 ? 207 : 201,
        read_only: false,
        ip_address: null,
        user_agent: null,
        created_at: `2026-05-21T10:0${index}:00Z`,
      })),
      isLoading: false,
    } as unknown as ReturnType<typeof useWebDavActivity>);

    render(<WebDavAccessSection />);

    expect(screen.getByText("Recent WebDAV activity")).toBeInTheDocument();
    expect(screen.getByText("7 total")).toBeInTheDocument();
    expect(screen.getByText("Audit WebDAV client requests, paths, status codes, and token names.")).toBeInTheDocument();
    expect(screen.getByText("/activity-1")).toBeInTheDocument();
    expect(screen.getByText("/activity-5")).toBeInTheDocument();
    expect(screen.getByText("/activity-6")).toBeInTheDocument();
    expect(screen.getByText("/activity-7")).toBeInTheDocument();
    expect(screen.getByTestId("webdav-activity-panel")).toHaveClass(
      "settings-neu-raised-card",
      "[background:var(--settings-surface-bg)]",
      "shadow-[var(--settings-surface-shadow)]",
    );
    expect(screen.getByTestId("webdav-activity-list")).toHaveClass(
      "settings-neu-inset-panel",
      "max-h-[clamp(16rem,42dvh,24rem)]",
      "overflow-y-auto",
    );

    await userEvent.click(
      screen.getByRole("button", { name: /Hide recent WebDAV activity/i }),
    );

    expect(screen.queryByText("Recent WebDAV activity")).not.toBeInTheDocument();
    expect(screen.queryByText("/activity-1")).not.toBeInTheDocument();
  });

  it("keeps WebDAV setup panels mobile-first without cramped fixed rows", () => {
    render(<WebDavAccessSection />);

    expect(screen.getByTestId("webdav-connection-heading-row")).toHaveClass(
      "flex-col",
      "items-start",
      "md:flex-row",
      "md:items-center",
    );
    expect(screen.getByTestId("webdav-connection-heading-row")).not.toHaveClass(
      "md:items-start",
    );
    expect(screen.getByTestId("webdav-url-row")).toHaveClass(
      "flex-col",
      "md:flex-row",
      "md:items-center",
    );
    expect(screen.getByRole("button", { name: /Copy URL/i })).toHaveClass(
      "w-full",
      "items-center",
      "md:w-auto",
    );
    expect(screen.getByRole("button", { name: /Copy username/i })).toHaveClass(
      "w-full",
      "items-center",
      "webdav-copy-username-button",
    );
    expect(screen.getByTestId("webdav-wizard-heading-row")).toHaveClass(
      "flex-col",
      "lg:flex-row",
    );
    expect(screen.getByRole("button", { name: /Create read\/write token/i })).toHaveClass(
      "w-full",
      "xl:w-auto",
    );
    expect(screen.getByTestId("webdav-activity-heading-row")).toHaveClass(
      "flex-col",
      "items-start",
      "md:flex-row",
    );
    expect(screen.getByTestId("webdav-activity-heading-actions")).toHaveClass(
      "w-full",
      "justify-between",
      "md:w-auto",
    );
    expect(screen.getByTestId("webdav-activity-list")).toHaveClass(
      "p-[clamp(0.35rem,0.9vw,0.6rem)]",
      "shadow-[var(--settings-panel-shadow)]",
    );
    expect(screen.getByTestId("webdav-activity-row-event-1")).toHaveClass(
      "grid",
      "grid-cols-[minmax(0,1fr)_auto]",
      "gap-y-[clamp(0.28rem,0.7vw,0.42rem)]",
      "p-[clamp(0.45rem,1vw,0.64rem)]",
      "sm:grid-cols-[minmax(0,0.36fr)_minmax(0,1fr)_auto]",
    );
    expect(screen.getByTestId("webdav-activity-row-event-1")).not.toHaveClass(
      "space-y-[clamp(0.35rem,0.9vw,0.5rem)]",
    );
    expect(screen.getByTestId("webdav-activity-row-header-event-1")).toHaveClass("contents");
    expect(screen.getByTestId("webdav-activity-method-event-1")).toHaveTextContent("Method");
    expect(screen.getByTestId("webdav-activity-method-event-1")).toHaveClass(
      "flex",
      "items-baseline",
    );
    expect(screen.getByTestId("webdav-activity-path-event-1")).toHaveTextContent("Path");
    expect(screen.getByTestId("webdav-activity-path-event-1")).toHaveClass(
      "flex",
      "items-baseline",
    );
    expect(screen.getByTestId("webdav-activity-status-event-1")).toHaveTextContent("Status");
    expect(screen.getByTestId("webdav-activity-status-event-1")).toHaveClass(
      "flex",
      "items-baseline",
    );
    expect(screen.getByTestId("webdav-activity-meta-event-1")).toHaveClass(
      "col-span-2",
      "grid",
      "grid-cols-[minmax(0,1fr)_auto]",
      "sm:col-span-3",
      "sm:grid-cols-[minmax(0,1fr)_auto]",
    );
    expect(screen.getByTestId("webdav-activity-token-event-1")).toHaveTextContent("Token");
    expect(screen.getByTestId("webdav-activity-token-event-1")).toHaveClass(
      "flex",
      "items-baseline",
    );
    expect(screen.getByTestId("webdav-activity-date-event-1")).toHaveTextContent("Date");
    expect(screen.getByTestId("webdav-activity-date-event-1")).toHaveClass(
      "flex",
      "items-baseline",
    );
  });
});
