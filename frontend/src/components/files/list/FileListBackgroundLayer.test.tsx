import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FileListBackgroundLayer from "./FileListBackgroundLayer";

vi.mock("./FileListLightCanvasBackground", () => ({
  default: () => <canvas data-testid="filelist-light-canvas-background" />,
}));

vi.mock("./FileListDarkShapeWaveBackground", () => ({
  default: () => <canvas data-testid="filelist-dark-shape-wave-background" />,
}));

vi.mock("./FileListPortfolioFireworksBackground", () => ({
  default: () => <canvas data-testid="filelist-portfolio-fireworks-background" />,
}));

describe("FileListBackgroundLayer", () => {
  it("does not mount the yyapzOP Shape Wave backgrounds on the logged-in file list", () => {
    render(<FileListBackgroundLayer />);

    expect(screen.queryByTestId("filelist-light-canvas-background")).not.toBeInTheDocument();
    expect(screen.queryByTestId("filelist-dark-shape-wave-background")).not.toBeInTheDocument();
    expect(screen.getByTestId("filelist-portfolio-fireworks-background")).toBeInTheDocument();
  });
});
