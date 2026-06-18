import { describe, expect, it } from "vitest";
import {
  AUTH_BUTTON_CLASSES,
  AUTH_CARD_CLASSES,
  AUTH_ERROR_BOX_CLASSES,
  AUTH_INPUT_CLASSES,
  AUTH_PAGE_CLASSES,
} from "./styles";

describe("auth Neuromorphic style contract", () => {
  it("maps auth containers to tokenized Neuromorphic surfaces", () => {
    expect(AUTH_PAGE_CLASSES).toContain("bg-[image:var(--auth-page-bg)]");
    expect(AUTH_PAGE_CLASSES).not.toContain("dark:bg-[image:var(--auth-page-bg-dark)]");

    expect(AUTH_CARD_CLASSES).toContain("[background:var(--auth-card-bg)]");
    expect(AUTH_CARD_CLASSES).toContain("shadow-[var(--auth-card-shadow)]");
    expect(AUTH_CARD_CLASSES).toContain("backdrop-blur-[var(--auth-card-backdrop)]");
  });

  it("maps auth inputs and notices to inset Neuromorphic primitives", () => {
    expect(AUTH_INPUT_CLASSES).toContain("[background:var(--auth-input-bg)]");
    expect(AUTH_INPUT_CLASSES).toContain("border-[var(--auth-input-border)]");
    expect(AUTH_INPUT_CLASSES).toContain("shadow-[var(--auth-input-shadow)]");
    expect(AUTH_INPUT_CLASSES).toContain("focus:shadow-[var(--auth-input-shadow-focus)]");
    expect(AUTH_INPUT_CLASSES).not.toContain("dark:bg-[var(--auth-input-bg-dark)]");
    expect(AUTH_INPUT_CLASSES).not.toContain("dark:border-[var(--auth-input-border-dark)]");

    expect(AUTH_ERROR_BOX_CLASSES).toContain("shadow-[var(--auth-error-shadow)]");
  });

  it("maps primary auth buttons to raised and pressed Neuromorphic states without scaling", () => {
    expect(AUTH_BUTTON_CLASSES).toContain("shadow-[var(--auth-button-shadow)]");
    expect(AUTH_BUTTON_CLASSES).toContain("active:shadow-[var(--auth-button-shadow-active)]");
    expect(AUTH_BUTTON_CLASSES).not.toContain("hover:scale-[1.02]");
    expect(AUTH_BUTTON_CLASSES).not.toContain("active:scale-[0.98]");
  });
});
