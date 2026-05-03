import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Modal from "./Modal";

describe("Modal", () => {
  it("uses the themed tech glass shell without changing close behavior", async () => {
    const onClose = vi.fn();

    render(
      <Modal title="分享文件" onClose={onClose} variant="glass">
        <button type="button">创建分享</button>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog", { name: "分享文件" });
    expect(dialog).toHaveClass("modal-dialog-tech");
    expect(dialog.querySelector(".modal-dialog-tech-panel")).not.toBeNull();
    expect(screen.getByRole("button", { name: "创建分享" })).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "关闭" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
