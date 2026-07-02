import { existsSync, readFileSync } from "node:fs";
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
    expect(AUTH_PAGE_CLASSES).toContain("neu-flat");
    expect(AUTH_PAGE_CLASSES).not.toContain("bg-[image:var(--auth-page-bg)]");

    expect(AUTH_CARD_CLASSES).toContain("neu-raised");
    expect(AUTH_CARD_CLASSES).not.toContain("[background:var(--auth-card-bg)]");
    expect(AUTH_CARD_CLASSES).not.toContain("backdrop-blur");
  });

  it("maps auth inputs and notices to inset Neuromorphic primitives", () => {
    expect(AUTH_INPUT_CLASSES).toContain("neu-inset");
    expect(AUTH_INPUT_CLASSES).not.toContain("border-[var(--auth-input-border)]");
    expect(AUTH_INPUT_CLASSES).not.toContain("dark:bg-[var(--auth-input-bg-dark)]");
    expect(AUTH_INPUT_CLASSES).not.toContain("dark:border-[var(--auth-input-border-dark)]");

    expect(AUTH_ERROR_BOX_CLASSES).toContain("neu-inset");
  });

  it("maps primary auth buttons to raised and pressed Neuromorphic states without scaling", () => {
    expect(AUTH_BUTTON_CLASSES).toContain("neu-raised-sm");
    expect(AUTH_BUTTON_CLASSES).toContain("bg-indigo-500");
    expect(AUTH_BUTTON_CLASSES).toContain("hover:bg-indigo-600");
    expect(AUTH_BUTTON_CLASSES).toContain(
      "active:shadow-[var(--neu-pressed-shadow)]",
    );
    expect(AUTH_BUTTON_CLASSES).not.toContain("neu-semantic-raised");
    expect(AUTH_BUTTON_CLASSES).not.toContain("hover:scale-[1.02]");
    expect(AUTH_BUTTON_CLASSES).not.toContain("active:scale-[0.98]");
  });

  it("keeps Shape Wave decorative while removing obsolete aura, edge, and glow assets from auth", () => {
    const tokens = readFileSync("src/styles/tokens.css", "utf8");

    expect(tokens).toContain("--auth-shape-wave-opacity");
    expect(tokens).toContain("--auth-shape-wave-wash");
    expect(tokens).not.toContain("--auth-card-glow-bg");
    expect(tokens).not.toContain("--auth-card-edge-bg");
    expect(tokens).not.toContain("--auth-logo-aura-bg");
    expect(tokens).not.toContain("--auth-logo-aura-opacity");
    expect(existsSync("src/components/auth/AuthShapeWaveBackground.tsx")).toBe(true);
  });
});
