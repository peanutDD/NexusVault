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
    expect(shell).toHaveClass("neu-raised-sm");
    expect(ring).toBeInTheDocument();
    expect(icon).toBeInTheDocument();
    expect(ring).toHaveClass("custom-spinner-size");
    expect(ring).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps custom sizing on the hidden fallback ring", () => {
    render(<Spinner size="lg" className="custom-spinner-size" />);

    const spinner = screen.getByRole("status", { name: "加载中" });
    expect(spinner.querySelector(".appSpinnerRing")).toHaveClass(
      "custom-spinner-size",
      "border-4",
    );
    expect(spinner.querySelector(".appSpinnerIcon")).toHaveClass(
      "w-[clamp(1.75rem,3.6vw,2rem)]",
    );
  });
});
