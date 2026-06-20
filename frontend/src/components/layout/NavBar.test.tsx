import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useThemeStore } from "../../store/themeStore";
import NavBar from "./NavBar";

function renderNavBar(onLogout = vi.fn()) {
  useThemeStore.getState().setTheme("dark");

  render(
    <MemoryRouter initialEntries={["/preview/1?from=files"]}>
      <Routes>
        <Route
          path="*"
          element={
            <NavBar
              backTo={{ path: "/files", label: "Back" }}
              username="tyone"
              onLogout={onLogout}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

function BrowserBackButton() {
  const navigate = useNavigate();

  return (
    <button type="button" onClick={() => navigate(-1)}>
      Browser Back
    </button>
  );
}

describe("NavBar", () => {
  it("uses the shared pixel logo in the top bar", () => {
    renderNavBar();

    const nav = screen.getByRole("navigation");
    expect(nav).toHaveClass("neu-raised", "nav-surface-shell");
    expect(nav).not.toHaveClass("backdrop-blur-[var(--nav-surface-blur)]");

    const logo = screen.getByRole("img", { name: "Logo" });
    expect(logo).toHaveAttribute("data-testid", "pixel-logo");
    expect(logo).toHaveAttribute("shape-rendering", "crispEdges");
    expect(logo.querySelector("linearGradient")).toBeNull();
  });

  it("renders the NexusVault product title with the dedicated brand treatment", () => {
    renderNavBar();

    const title = screen.getByRole("heading", { name: "NexusVault" });
    expect(title).toHaveClass("nav-brand-title");
    expect(title).toHaveClass("nav-title-fluid");
    expect(title).not.toHaveTextContent("File Upload Download Server");
  });

  it("renders every top menu action from the shared raised primitive without changing labels", async () => {
    const onLogout = vi.fn();
    renderNavBar(onLogout);

    const buttons = [
      screen.getByRole("button", { name: "Back" }),
      screen.getByRole("button", { name: "Activity" }),
      screen.getByRole("button", { name: "Settings" }),
      screen.getByRole("button", { name: "Trash" }),
      screen.getByRole("button", { name: /Switch theme: current Dark, click to switch to Light/i }),
      screen.getByRole("button", { name: "Logout" }),
    ];

    for (const button of buttons) {
      expect(button).toHaveClass("nav-btn");
      expect(button).toHaveClass("neu-raised-sm");
      expect(button).not.toHaveClass("border-[var(--nav-btn-border)]");
      expect(button).not.toHaveClass("bg-[var(--nav-btn-bg)]");
    }

    const panel = screen.getByTestId("nav-panel");
    expect(panel).toHaveClass("neu-inset");
    expect(panel).not.toHaveClass("border-[var(--nav-panel-border)]");

    const usernameChip = screen.getByTitle("tyone");
    expect(usernameChip).toHaveClass("nav-chip");
    expect(usernameChip).toHaveClass("neu-inset");

    await userEvent.click(screen.getByRole("button", { name: "Logout" }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("does not render legacy glow, divider, or ambience layers", () => {
    renderNavBar();

    const nav = screen.getByRole("navigation");
    expect(nav.innerHTML).not.toContain("--nav-top-glow");
    expect(nav.innerHTML).not.toContain("--nav-bottom-line");
    expect(nav.innerHTML).not.toContain("--nav-side-ambience");
    expect(nav.innerHTML).not.toContain("--nav-panel-edge-glow");
  });

  it("does not clip the theme toggle tooltip when the nav is narrow", () => {
    renderNavBar();

    const nav = screen.getByRole("navigation");
    const themeToggle = screen.getByRole("button", {
      name: /Switch theme: current Dark, click to switch to Light/i,
    });

    expect(nav).toHaveClass("overflow-visible");
    expect(nav).not.toHaveClass("overflow-hidden");
    expect(themeToggle.closest(".nav-panel")).toHaveClass("overflow-visible");
    expect(themeToggle).toHaveClass("nav-theme-tooltip");
    expect(themeToggle).toHaveAttribute("data-tooltip-placement", "bottom");
  });

  it("keeps the page navigation bar separate from macOS window dragging", () => {
    renderNavBar();

    const nav = screen.getByRole("navigation");

    expect(nav).toHaveClass("nav-surface-shell");
    expect(screen.queryByTestId("macos-window-drag-region")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nav-content-shell")).not.toBeInTheDocument();

    expect(nav).not.toHaveAttribute("data-tauri-drag-region");
    expect(screen.getByRole("button", { name: "Home" })).not.toHaveAttribute("data-tauri-drag-region");
    expect(screen.getByRole("button", { name: "Settings" })).not.toHaveAttribute("data-tauri-drag-region");
    expect(screen.getByRole("button", { name: "Logout" })).not.toHaveAttribute("data-tauri-drag-region");
  });

  it("navigates to the files homepage when the logo is clicked", async () => {
    useThemeStore.getState().setTheme("dark");

    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route
            path="/settings"
            element={
              <NavBar
                username="tyone"
                onLogout={vi.fn()}
              />
            }
          />
          <Route path="/files" element={<div data-testid="files-home" />} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Home" }));

    expect(screen.getByTestId("files-home")).toBeInTheDocument();
  });

  it("does not add a duplicate /files history entry when home is clicked on the current files page", async () => {
    useThemeStore.getState().setTheme("dark");

    render(
      <MemoryRouter initialEntries={["/settings", "/files"]} initialIndex={1}>
        <Routes>
          <Route
            path="/files"
            element={
              <>
                <NavBar username="tyone" onLogout={vi.fn()} />
                <div data-testid="files-home" />
                <BrowserBackButton />
              </>
            }
          />
          <Route
            path="/settings"
            element={<div data-testid="settings-page" />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Home" }));
    await userEvent.click(screen.getByRole("button", { name: "Browser Back" }));

    expect(screen.getByTestId("settings-page")).toBeInTheDocument();
  });

  it("does not add a duplicate /settings history entry when settings is clicked on the current page", async () => {
    useThemeStore.getState().setTheme("dark");

    render(
      <MemoryRouter initialEntries={["/files", "/settings"]} initialIndex={1}>
        <Routes>
          <Route
            path="/files"
            element={<div data-testid="files-home" />}
          />
          <Route
            path="/settings"
            element={
              <>
                <NavBar username="tyone" onLogout={vi.fn()} />
                <div data-testid="settings-page" />
                <BrowserBackButton />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    await userEvent.click(screen.getByRole("button", { name: "Browser Back" }));

    expect(screen.getByTestId("files-home")).toBeInTheDocument();
  });
});
