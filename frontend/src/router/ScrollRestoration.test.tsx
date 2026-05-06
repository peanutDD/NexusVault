import type { ComponentProps } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ScrollRestoration from "./ScrollRestoration";

const scrollToMock = vi.fn();
let scrollYValue = 0;
const settingsEntry = { pathname: "/settings", key: "settings-key" };
const refreshedSettingsEntry = { pathname: "/settings", key: "settings-key-after-refresh" };
const filesEntry = { pathname: "/files", key: "files-key" };
const refreshedFilesEntry = { pathname: "/files", key: "files-key-after-refresh" };

function Harness() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <>
      <ScrollRestoration />
      <output data-testid="location">{location.pathname}</output>
      <button type="button" onClick={() => navigate("/settings")}>settings</button>
      <button type="button" onClick={() => navigate(-1)}>back</button>
    </>
  );
}

const renderAt = (initialEntries: ComponentProps<typeof MemoryRouter>["initialEntries"]) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <Harness />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  scrollYValue = 0;
  Object.defineProperty(window, "scrollY", { configurable: true, get: () => scrollYValue });
  Object.defineProperty(window, "scrollTo", { configurable: true, value: scrollToMock });
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => (callback(0), 0));
});

describe("ScrollRestoration", () => {
  it("starts a new route at the top instead of inheriting the previous scroll", async () => {
    sessionStorage.setItem("routeScroll:old-settings:/settings", "640");
    sessionStorage.setItem("routeScrollUrl:/settings", "640");
    renderAt(["/home"]);
    scrollToMock.mockClear();
    scrollYValue = 900;
    await userEvent.click(screen.getByRole("button", { name: "settings" }));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/settings"));
    expect(scrollToMock).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: "auto" });
  });

  it("restores the previous history entry scroll when navigating back", async () => {
    renderAt(["/home"]);
    scrollToMock.mockClear();
    scrollYValue = 720;
    window.dispatchEvent(new Event("scroll"));
    await userEvent.click(screen.getByRole("button", { name: "settings" }));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/settings"));
    scrollToMock.mockClear();
    scrollYValue = 280;
    await userEvent.click(screen.getByRole("button", { name: "back" }));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/home"));
    await waitFor(() =>
      expect(scrollToMock).toHaveBeenLastCalledWith({ top: 720, left: 0, behavior: "auto" }),
    );
  });

  it("restores a refreshed page when the history key is retained", async () => {
    const { unmount } = renderAt([settingsEntry]);
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/settings"));
    scrollToMock.mockClear();
    scrollYValue = 680;
    window.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("pagehide"));
    expect(sessionStorage.getItem("routeScroll:settings-key:/settings")).toBe("680");
    unmount();
    renderAt([settingsEntry]);
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/settings"));
    await waitFor(() =>
      expect(scrollToMock).toHaveBeenLastCalledWith({ top: 680, left: 0, behavior: "auto" }),
    );
  });

  it("restores a refreshed page when the history key changes", async () => {
    const { unmount } = renderAt([settingsEntry]);
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/settings"));
    scrollToMock.mockClear();
    scrollYValue = 740;
    window.dispatchEvent(new Event("beforeunload"));
    expect(sessionStorage.getItem("routeScrollUrl:/settings")).toBe("740");

    unmount();
    renderAt([refreshedSettingsEntry]);

    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/settings"));
    await waitFor(() =>
      expect(scrollToMock).toHaveBeenLastCalledWith({ top: 740, left: 0, behavior: "auto" }),
    );
  });

  it("restores scroll position on /files after browser refresh (same history key)", async () => {
    const { unmount } = renderAt([filesEntry]);
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/files"));
    scrollToMock.mockClear();
    scrollYValue = 512;
    window.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("pagehide"));
    expect(sessionStorage.getItem("routeScroll:files-key:/files")).toBe("512");

    unmount();
    renderAt([filesEntry]);
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/files"));
    await waitFor(() =>
      expect(scrollToMock).toHaveBeenLastCalledWith({ top: 512, left: 0, behavior: "auto" }),
    );
  });

  it("restores scroll position on /files after browser refresh (history key changes)", async () => {
    const { unmount } = renderAt([filesEntry]);
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/files"));
    scrollToMock.mockClear();
    scrollYValue = 880;
    window.dispatchEvent(new Event("beforeunload"));
    expect(sessionStorage.getItem("routeScrollUrl:/files")).toBe("880");

    unmount();
    renderAt([refreshedFilesEntry]);
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/files"));
    await waitFor(() =>
      expect(scrollToMock).toHaveBeenLastCalledWith({ top: 880, left: 0, behavior: "auto" }),
    );
  });
});
