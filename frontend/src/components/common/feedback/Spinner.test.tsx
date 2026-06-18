import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Spinner from "./Spinner";

describe("Spinner", () => {
  it("renders a CodePen-style neuromorphic raised shell around the loading ring", () => {
    render(<Spinner size="sm" className="custom-spinner-size" />);

    const spinner = screen.getByRole("status", { name: "加载中" });
    expect(spinner).toHaveClass("appSpinnerStatus");

    const shell = spinner.querySelector(".appSpinnerShell");
    const ring = spinner.querySelector(".appSpinnerRing");
    const icon = spinner.querySelector(".appSpinnerIcon");

    expect(shell).toBeInTheDocument();
    expect(ring).toBeInTheDocument();
    expect(icon).toBeInTheDocument();
    expect(ring).toHaveClass("custom-spinner-size");
    expect(ring).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("defines neuromorphic loading shell and icon styles from the CodePen raised primitive", () => {
    const css = readFileSync("src/styles/base.css", "utf8").replace(/\s+/g, " ");

    expect(css).toContain(".appSpinnerShell");
    expect(css).toContain("background: var(--neu-raised-bg, var(--glass-bg-soft))");
    expect(css).toContain("box-shadow: var(--neu-raised-sm-shadow, var(--shadow-glass-sm))");
    expect(css).toContain(".appSpinnerRing");
    expect(css).toContain("display: none");
    expect(css).toContain(".appSpinnerIcon");
    expect(css).toContain("display: inline-flex");
    expect(css).toContain("color: var(--spinner-accent-color)");
    expect(css).toContain('.neuromorphic-style .appSpinnerShell');
    expect(css).toContain("background: var(--neu-raised-bg)");
    expect(css).toContain("box-shadow: var(--neu-raised-sm-shadow)");
    expect(css).toContain('.neuromorphic-style .appSpinnerIcon');
    expect(css).toContain("color: var(--neu-primary)");
  });
});
