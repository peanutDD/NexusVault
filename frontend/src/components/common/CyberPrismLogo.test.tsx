import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CyberPrismLogo } from "./CyberPrismLogo";

describe("CyberPrismLogo", () => {
  it("renders the CodePen-style pixel logo instead of the old prism artwork", () => {
    render(<CyberPrismLogo className="logo-size" />);

    const logo = screen.getByRole("img", { name: "Logo" });
    expect(logo).toHaveAttribute("data-testid", "pixel-logo");
    expect(logo).toHaveAttribute("shape-rendering", "crispEdges");
    expect(logo).toHaveAttribute("viewBox", "0 0 31 39");
    expect(logo).toHaveClass("logo-size");
    expect(logo.querySelector("linearGradient")).toBeNull();
    expect(logo.querySelector("filter")).toBeNull();
    expect(logo.querySelector("polygon")).toBeNull();
    expect(logo.querySelectorAll("rect")).toHaveLength(661);
  });

  it("uses the exact CodePen Sonic pixel-art color palette", () => {
    render(<CyberPrismLogo />);

    const fills = new Set(
      Array.from(screen.getByTestId("pixel-logo").querySelectorAll("rect"))
        .map((rect) => rect.getAttribute("fill"))
        .filter(Boolean),
    );

    expect(fills).toEqual(
      new Set([
        "rgb(0, 52, 206)",
        "rgb(0, 0, 152)",
        "rgb(52, 102, 249)",
        "rgb(239, 198, 136)",
        "rgb(151, 71, 8)",
        "rgb(245, 239, 249)",
        "rgb(178, 178, 178)",
        "rgb(220, 231, 237)",
        "rgb(128, 128, 128)",
        "rgb(1, 0, 0)",
        "rgb(151, 1, 0)",
        "rgb(253, 0, 7)",
      ]),
    );
  });
});
