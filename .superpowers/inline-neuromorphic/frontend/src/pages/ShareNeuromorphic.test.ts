import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Share page neuromorphic surfaces", () => {
  it("uses raised/inset primitives and the shared spinner instead of glass leftovers", () => {
    const source = readFileSync(resolve(__dirname, "Share.tsx"), "utf8");

    expect(source).toContain('import Spinner from "../components/common/feedback/Spinner"');
    expect(source).toContain("sharePageCard");
    expect(source).toContain("neu-raised sharePageCard");
    expect(source).not.toContain("shadow-[var(--shadow-glass-md)]");
    expect(source).toContain("<Spinner");
    expect(source).not.toContain("border-4 border-[rgba(var(--rgb-white),0.18)]");
    expect(source).toContain("shareFileInfoPanel");
    expect(source).toContain("neu-inset shareFileInfoPanel");
    expect(source).toContain("sharePrimaryButton");
    expect(source).toContain("neu-raised-sm sharePrimaryButton");
    expect(source).toContain("shareSecondaryButton");
    expect(source).toContain("neu-raised-sm shareSecondaryButton");
    expect(source).not.toContain("[background:var(--btn-primary-bg)]");
    expect(source).not.toContain("[background:var(--btn-secondary-bg)]");
    expect(source).not.toContain("bg-[image:");
    expect(source).not.toContain("bg-[var(--btn-primary-bg)]");
    expect(source).not.toContain("bg-[var(--btn-secondary-bg)]");
  });
});
