import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

  it("maps neuromorphic glass dialogs to the CodePen raised and inset primitives", () => {
    const css = readFileSync(
      resolve(__dirname, "../../../styles/confirm-dialog.css"),
      "utf8",
    );

    expect(css).toContain('.neuromorphic-style .confirm-dialog-tech-panel');
    expect(css).toContain("background: var(--neu-raised-bg)");
    expect(css).toContain("box-shadow: var(--neu-raised-shadow)");
    expect(css).toContain('.neuromorphic-style .confirm-dialog-tech-groove');
    expect(css).toContain("background: var(--neu-inset-bg)");
    expect(css).toContain("box-shadow: var(--neu-inset-shadow)");
    expect(css).toContain('.neuromorphic-style .confirm-dialog-tech-grid');
    expect(css).toContain("display: none");
    expect(css).toContain('.neuromorphic-style .confirm-dialog-tech-confirm');
    expect(css).toContain(
      "background: linear-gradient(145deg, var(--neu-primary), var(--neu-primary-dark))",
    );
    expect(css).toContain('.neuromorphic-style .confirm-dialog-tech-cancel');
    expect(css).toContain("box-shadow: var(--neu-raised-sm-shadow)");
    expect(css).toContain("background: var(--confirm-backdrop-glass)");
    expect(css).not.toContain("background: rgba(var(--rgb-slate-950), 0.72);");
  });

  it("maps neuromorphic dialog content, fields, and action rows to inset or raised material", () => {
    const css = readFileSync(
      resolve(__dirname, "../../../styles/confirm-dialog.css"),
      "utf8",
    );

    expect(css).toContain(
      '.neuromorphic-style .confirm-dialog-tech [class*="bg-[var(--dialog-panel-bg)]"]',
    );
    expect(css).toContain(
      '.neuromorphic-style .confirm-dialog-tech [class*="border-[var(--dialog-field-border)]"]',
    );
    expect(css).toContain(
      '.neuromorphic-style .confirm-dialog-tech [class*="bg-[var(--dialog-list-bg)]"]',
    );
    expect(css).toContain(
      '.neuromorphic-style .confirm-dialog-tech [class*="bg-[var(--dialog-action-bg)]"]',
    );
    expect(css).toContain(
      '.neuromorphic-style .confirm-dialog-tech [class*="bg-[var(--dialog-batch-action-bg)]"]',
    );
  });
});
