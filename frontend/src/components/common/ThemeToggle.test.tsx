import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { useThemeStore } from "../../store/themeStore";
import ThemeToggle from "./ThemeToggle";

function resetThemeStore() {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.classList.remove("dark", "light", "purple", "terminal", "portfolio", "neuromorphic");
  useThemeStore.getState().setTheme("dark");
}

describe("ThemeToggle", () => {
  beforeEach(() => {
    resetThemeStore();
  });

  it("only offers Dark and Light and cycles Light back to Dark", async () => {
    useThemeStore.getState().setTheme("light");

    render(<ThemeToggle showLabel />);

    const toggle = screen.getByRole("button", {
      name: /current Light, click to switch to Dark/i,
    });

    expect(toggle).toHaveTextContent("Light");
    expect(screen.queryByText("Purple")).not.toBeInTheDocument();
    expect(screen.queryByText("Terminal")).not.toBeInTheDocument();
    expect(screen.queryByText("Portfolio")).not.toBeInTheDocument();
    expect(screen.queryByText("Neuromorphic")).not.toBeInTheDocument();
    await userEvent.click(toggle);

    expect(useThemeStore.getState().effectiveTheme).toBe("dark");
    expect(screen.getByRole("button", { name: /current Dark, click to switch to Light/i })).toBeInTheDocument();
  });

  it("does not keep a press translation after switching from dark to light", async () => {
    render(<ThemeToggle showLabel />);

    const toggle = screen.getByRole("button", {
      name: /current Dark, click to switch to Light/i,
    });

    expect(toggle).toHaveClass("nav-theme-toggle");
    expect(toggle).not.toHaveClass("active:translate-y-px");

    await userEvent.click(toggle);

    const lightToggle = screen.getByRole("button", {
      name: /current Light, click to switch to Dark/i,
    });
    expect(lightToggle).toHaveClass("nav-theme-toggle");
    expect(lightToggle).not.toHaveClass("active:translate-y-px");
  });

  it("uses an instant custom tooltip contract for both Dark and Light buttons", async () => {
    render(<ThemeToggle showLabel />);

    const darkToggle = screen.getByRole("button", {
      name: /current Dark, click to switch to Light/i,
    });

    expect(darkToggle).toHaveClass("nav-theme-tooltip");
    expect(darkToggle).toHaveAttribute("data-tooltip", "Click to switch");
    expect(darkToggle).toHaveAttribute("data-tooltip-placement", "bottom");
    expect(darkToggle).not.toHaveAttribute("title");

    await userEvent.click(darkToggle);

    const lightToggle = screen.getByRole("button", {
      name: /current Light, click to switch to Dark/i,
    });

    expect(lightToggle).toHaveClass("nav-theme-tooltip");
    expect(lightToggle).toHaveAttribute("data-tooltip", "Click to switch");
    expect(lightToggle).toHaveAttribute("data-tooltip-placement", "bottom");
    expect(lightToggle).not.toHaveAttribute("title");
  });
});
