import { readFileSync } from "node:fs";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ErrorMessage from "./ErrorMessage";

describe("ErrorMessage", () => {
  it("keeps alert behavior while exposing hooks for the neuromorphic alert treatment", () => {
    const onClose = vi.fn();

    render(<ErrorMessage message="Something failed" onClose={onClose} type="warning" />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveClass("appAlertMessage", "appAlertMessage--warning");
    expect(alert).toHaveClass("appAlertMessage--codepen");
    expect(alert.querySelector(".appAlertMessageAmbient")).toBeInTheDocument();
    expect(alert.querySelector(".appAlertMessageHairline")).toBeInTheDocument();
    expect(alert.querySelector(".appAlertMessageIcon")).toBeInTheDocument();
    expect(alert.querySelector(".appAlertMessageTitle")).toHaveTextContent("Warning");
    expect(alert.querySelector(".appAlertMessageText")).toHaveTextContent("Something failed");

    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders CodePen Alert Messages titles for info, error, and warning", () => {
    const { rerender } = render(<ErrorMessage message="Saved" type="info" />);

    expect(screen.getByText("Info")).toBeInTheDocument();
    expect(screen.queryByText("Success")).not.toBeInTheDocument();
    expect(screen.getByText("Saved")).toBeInTheDocument();

    rerender(<ErrorMessage message="Broken" type="error" />);
    expect(screen.getByText("Error")).toBeInTheDocument();

    rerender(<ErrorMessage message="Expiring" type="warning" />);
    expect(screen.getByText("Warning")).toBeInTheDocument();
  });

  it("maps neuromorphic alerts to the CodePen Alert Messages raised surface", () => {
    const css = readFileSync("src/styles/base.css", "utf8").replace(/\s+/g, " ");

    expect(css).toContain(".appAlertMessage--codepen");
    expect(css).toContain("--app-alert-surface: rgba(var(--rgb-emerald-950)");
    expect(css).toContain("--app-alert-surface: rgba(var(--rgb-red-950)");
    expect(css).toContain("--app-alert-surface: rgba(var(--rgb-amber-950)");
    expect(css).toContain("border-radius: clamp(0.85rem, 2vw, 1.1rem)");
    expect(css).toContain("min-height: clamp(4rem, 8vw, 5rem)");
    expect(css).toContain("padding: clamp(0.9rem, 2vw, 1.15rem) clamp(1rem, 2.4vw, 1.35rem)");
    expect(css).toContain("height: clamp(1.35rem, 2.6vw, 1.65rem)");
    expect(css).toContain('.neuromorphic-style .appAlertMessageAmbient');
    expect(css).toContain("display: none");
    expect(css).toContain('.appAlertMessageIcon');
    expect(css).toContain("background: transparent");
    expect(css).toContain('.neuromorphic-style .appAlertMessageClose:active');
    expect(css).toContain("box-shadow: var(--neu-pressed-shadow)");
  });

  it("uses app alert messages instead of native browser alerts in share copy flows", () => {
    const files = [
      "src/components/files/dialogs/ShareDialog.tsx",
      "src/components/files/dialogs/BatchShareDialog.tsx",
    ];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("alert(");
      expect(source).toContain("<ErrorMessage");
    }
  });
});
