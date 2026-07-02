import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ConfirmDialog from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("uses the global raised shell without changing confirm behavior", async () => {
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
    expect(dialog).not.toHaveClass("confirm-dialog-tech");
    expect(dialog.querySelector(".confirm-dialog-tech-grid")).toBeNull();
    expect(dialog.querySelector(".neu-raised")).not.toBeNull();
    expect(screen.getByRole("button", { name: "创建" })).toHaveClass(
      "neu-raised-sm",
    );

    await userEvent.click(screen.getByRole("button", { name: "创建" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

});
