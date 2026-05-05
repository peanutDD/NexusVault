import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ConfirmDialog from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("uses the themed tech glass shell without changing confirm behavior", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open
        appearance="glass"
        variant="info"
        title="新建文件夹"
        message="输入文件夹名称"
        confirmText="创建"
        cancelText="取消"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    const dialog = screen.getByRole("alertdialog", { name: "新建文件夹" });
    expect(dialog).toHaveClass("confirm-dialog-tech");
    expect(dialog.querySelector(".confirm-dialog-tech-panel")).not.toBeNull();
    expect(dialog.querySelector(".confirm-dialog-tech-grid")).not.toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "创建" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });
});
