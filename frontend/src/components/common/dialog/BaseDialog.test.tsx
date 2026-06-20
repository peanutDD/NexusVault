import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BaseDialog from "./BaseDialog";

describe("BaseDialog", () => {
  it("maps the default panel to neuromorphic raised primitives", () => {
    render(
      <BaseDialog open title="默认基础弹窗" onClose={vi.fn()}>
        <p>默认内容</p>
      </BaseDialog>,
    );

    const dialog = screen.getByRole("dialog", { name: "默认基础弹窗" });
    const panel = dialog.querySelector("[data-oid='uliq6c0']");

    expect(panel).toHaveClass("neu-raised");
    expect(dialog.querySelector(".modal-dialog-tech-grid")).toBeNull();
    expect(panel).not.toHaveClass("shadow-2xl");
  });
});
