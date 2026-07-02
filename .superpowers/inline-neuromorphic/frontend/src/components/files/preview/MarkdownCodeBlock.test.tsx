import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MarkdownCodeBlock from "./MarkdownCodeBlock";

describe("MarkdownCodeBlock", () => {
  it("uses an inset primitive for the code block shell", () => {
    render(
      <MarkdownCodeBlock
        language="ts"
        codeClassName="language-ts"
        code="const answer = 42;"
      />,
    );

    expect(screen.getByTestId("markdown-code-block")).toHaveClass(
      "neu-inset",
      "previewMarkdownCodeBlock",
    );
    expect(screen.getByTestId("markdown-code-block")).not.toHaveClass(
      "[background:var(--preview-markdown-codeblock-bg)]",
    );
  });
});
