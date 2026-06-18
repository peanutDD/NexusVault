import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import PageLayout from "./PageLayout";

vi.mock("./NavBar", () => ({
  default: () => <nav data-testid="nav-bar" />,
}));

vi.mock("./BottomBar", () => ({
  default: () => <footer data-testid="bottom-bar" />,
}));

function renderLayout(
  backgroundLayer?: React.ReactNode,
  useSolidBackground = false,
  hideFooter = false,
) {
  return render(
    <MemoryRouter>
      <PageLayout
        onLogout={vi.fn()}
        backgroundLayer={backgroundLayer}
        useSolidBackground={useSolidBackground}
        hideFooter={hideFooter}
      >
        <section data-testid="page-content">Files</section>
      </PageLayout>
    </MemoryRouter>,
  );
}

describe("PageLayout", () => {
  it("renders an optional decorative background layer behind page content", () => {
    renderLayout(<canvas data-testid="decorative-canvas" />);

    expect(screen.getByTestId("page-background-layer")).toContainElement(
      screen.getByTestId("decorative-canvas"),
    );
    expect(screen.getByTestId("main-content")).toHaveClass("relative", "z-10");
    expect(screen.getByTestId("bottom-bar-shell")).toHaveClass("relative", "z-10");
  });

  it("does not render a background layer shell when no background layer is provided", () => {
    renderLayout();

    expect(screen.queryByTestId("page-background-layer")).not.toBeInTheDocument();
    expect(screen.getByTestId("page-content")).toBeInTheDocument();
  });

  it("uses the background shorthand for solid file-list pages so theme gradients render", () => {
    renderLayout(undefined, true);

    expect(screen.getByTestId("page-layout-shell")).toHaveClass(
      "[background:var(--filelist-page-bg)]",
    );
    expect(screen.getByTestId("page-layout-shell")).not.toHaveClass(
      "bg-[color:var(--filelist-page-bg)]",
    );
  });

  it("can hide the footer for modal-dominant page states", () => {
    renderLayout(undefined, false, true);

    expect(screen.queryByTestId("bottom-bar-shell")).not.toBeInTheDocument();
    expect(screen.queryByTestId("bottom-bar")).not.toBeInTheDocument();
    expect(screen.getByTestId("page-content")).toBeInTheDocument();
  });
});
