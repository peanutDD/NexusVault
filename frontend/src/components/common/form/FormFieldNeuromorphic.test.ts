import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("FormField neuromorphic controls", () => {
  it("renders inputs and selects as inset controls", () => {
    const source = readFileSync(resolve(__dirname, "FormField.tsx"), "utf8");

    expect(source).toContain("shadow-[var(--neu-inset-shadow)]");
    expect(source).toContain("bg-[var(--control-input-bg)]");
    expect(source).toContain("border border-[var(--control-input-border)]");
  });
});
