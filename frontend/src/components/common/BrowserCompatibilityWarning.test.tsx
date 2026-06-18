import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BrowserCompatibilityWarning from "./BrowserCompatibilityWarning";
import { detectBrowser, isBrowserSupported } from "../../utils/browserDetection";

vi.mock("../../utils/browserDetection", () => ({
  detectBrowser: vi.fn(),
  isBrowserSupported: vi.fn(),
}));

describe("BrowserCompatibilityWarning", () => {
  it("uses the shared neuromorphic alert structure and can be dismissed", () => {
    vi.mocked(isBrowserSupported).mockReturnValue(false);
    vi.mocked(detectBrowser).mockReturnValue({
      name: "chrome",
      version: 80,
      isSupported: false,
    });

    render(<BrowserCompatibilityWarning />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveClass(
      "appAlertMessage",
      "appAlertMessage--codepen",
      "appAlertMessage--warning",
    );
    expect(alert.querySelector(".appAlertMessageAmbient")).toBeInTheDocument();
    expect(alert.querySelector(".appAlertMessageHairline")).toBeInTheDocument();
    expect(alert.querySelector(".appAlertMessageIcon")).toBeInTheDocument();
    expect(alert).not.toHaveClass("bg-[rgba(var(--rgb-pistachio-400),0.86)]");

    fireEvent.click(screen.getByRole("button", { name: "关闭提示" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
