import { readFileSync } from "node:fs";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ErrorMessage from "./ErrorMessage";

describe("ErrorMessage", () => {
  it("keeps alert behavior while exposing hooks for the neuromorphic alert treatment", () => {
    const onClose = vi.fn();

    render(<ErrorMessage message="Something failed" onClose={onClose} type="warning" />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveClass(
      "appAlertMessage",
      "appAlertMessage--warning",
      "neu-semantic-raised",
    );
    expect(alert).not.toHaveClass("appAlertMessage--codepen");
    expect(alert.querySelector(".appAlertMessageAmbient")).not.toBeInTheDocument();
    expect(alert.querySelector(".appAlertMessageHairline")).not.toBeInTheDocument();
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

  it("uses the shared semantic primitive without decorative alert layers", () => {
    const source = readFileSync("src/components/common/feedback/ErrorMessage.tsx", "utf8");

    expect(source).toContain('"neu-semantic-raised"');
    expect(source).not.toContain("appAlertMessage--codepen");
    expect(source).not.toContain("appAlertMessageAmbient");
    expect(source).not.toContain("appAlertMessageHairline");
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
