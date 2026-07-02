import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FileListBackgroundLayer from "./FileListBackgroundLayer";

describe("FileListBackgroundLayer", () => {
  it("mounts the inert fireworks background behind the file workspace", () => {
    const { container } = render(<FileListBackgroundLayer />);

    expect(container).not.toBeEmptyDOMElement();
    expect(container.querySelector('[data-testid="filelist-portfolio-fireworks-background"]')).toBeInTheDocument();
  });
});
