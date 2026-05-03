import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ImagePreview } from "./ImagePreview";

describe("ImagePreview", () => {
  it("applies pan offset while dragging a zoomed image", () => {
    const { getByRole } = render(
      <ImagePreview
        src="/preview.png"
        alt="preview"
        imageLoaded
        onImageLoad={() => {}}
        onImageError={() => {}}
        zoom={2}
        rotation={0}
        pan={{ x: 0, y: 0 }}
        isDragging={false}
        onPointerDown={() => {}}
        onPointerMove={() => {}}
        onPointerUp={() => {}}
        onPointerCancel={() => {}}
      />,
    );

    const viewer = getByRole("img", { name: "preview" }).parentElement;

    expect(viewer).toHaveStyle({
      "--preview-pan-x": "0px",
      "--preview-pan-y": "0px",
    });
  });

  it("wires pointer events to the image pan handlers", () => {
    const onPointerDown = vi.fn();
    const onPointerMove = vi.fn();
    const onPointerUp = vi.fn();
    const onPointerCancel = vi.fn();
    const { getByTestId } = render(
      <ImagePreview
        src="/preview.png"
        alt="preview"
        imageLoaded
        onImageLoad={() => {}}
        onImageError={() => {}}
        zoom={2}
        rotation={0}
        pan={{ x: 24, y: -16 }}
        isDragging
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      />,
    );

    const panSurface = getByTestId("image-preview-pan-surface");

    expect(panSurface).toHaveStyle({
      "--preview-pan-x": "24px",
      "--preview-pan-y": "-16px",
    });
    expect(panSurface).toHaveClass("cursor-grabbing");

    fireEvent.pointerDown(panSurface, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(panSurface, { pointerId: 1, clientX: 20, clientY: 30 });
    fireEvent.pointerUp(panSurface, { pointerId: 1, clientX: 20, clientY: 30 });
    fireEvent.pointerCancel(panSurface, { pointerId: 1 });

    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(onPointerMove).toHaveBeenCalledTimes(1);
    expect(onPointerUp).toHaveBeenCalledTimes(1);
    expect(onPointerCancel).toHaveBeenCalledTimes(1);
  });
});
