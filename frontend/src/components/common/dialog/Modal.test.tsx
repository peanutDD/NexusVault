import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Modal from "./Modal";

describe("Modal", () => {
  it("maps the default panel to neuromorphic raised primitives", () => {
    render(
      <Modal title="默认弹窗" onClose={vi.fn()}>
        <p>默认内容</p>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog", { name: "默认弹窗" });
    const panel = dialog.querySelector("[data-oid='o0:osfm']");

    expect(dialog).toHaveClass("items-start");
    expect(dialog).toHaveClass(
      "pt-[calc(clamp(5.5rem,10vw,8rem)+env(safe-area-inset-top))]",
    );
    expect(panel).toHaveClass(
      "neu-raised",
      "max-h-[calc(100dvh_-_clamp(6.5rem,12vw,9rem))]",
    );
    expect(panel).not.toHaveClass("shadow-2xl");
  });

  it("uses the shared raised shell without changing close behavior", async () => {
    const onClose = vi.fn();

    render(
      <Modal title="分享文件" onClose={onClose} variant="glass">
        <button type="button">创建分享</button>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog", { name: "分享文件" });
    expect(dialog).not.toHaveClass("modal-dialog-tech");
    expect(dialog.querySelector(".modal-dialog-tech-grid")).toBeNull();
    expect(dialog.querySelector(".neu-raised")).not.toBeNull();
    expect(screen.getByRole("button", { name: "创建分享" })).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "关闭" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("can center a dialog inside the nav-safe viewport", () => {
    render(
      <Modal title="活动记录" onClose={vi.fn()} placement="nav-safe-center">
        <p>内容</p>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog", { name: "活动记录" });
    expect(dialog).toHaveClass("items-center", "justify-center");
    expect(dialog).toHaveClass(
      "pt-[calc(clamp(5.5rem,10vw,8rem)+env(safe-area-inset-top))]",
    );
    expect(dialog).not.toHaveClass("items-start");
  });

  it("allows long description tokens to wrap inside the panel", () => {
    render(
      <Modal
        title="活动记录"
        description="mmexport3bc69d9b43566b11382eb893de2c118e_1779939883225.png"
        onClose={vi.fn()}
        variant="glass"
      >
        <p>内容</p>
      </Modal>,
    );

    expect(screen.getByText(/mmexport3bc69/)).toHaveClass(
      "max-w-full",
      "min-w-0",
      "[overflow-wrap:anywhere]",
    );
  });
});
