import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useImagePan } from "./useImagePan";

describe("useImagePan", () => {
  it("tracks pointer dragging when image is zoomed", () => {
    const { result } = renderHook(({ zoom }) => useImagePan({ zoom }), {
      initialProps: { zoom: 2 },
    });

    act(() => {
      result.current.onPointerDown(makePointerEvent("pointerdown", 10, 20));
      result.current.onPointerMove(makePointerEvent("pointermove", 42, 55));
    });

    expect(result.current.pan).toEqual({ x: 32, y: 35 });
    expect(result.current.isDragging).toBe(true);

    act(() => {
      result.current.onPointerUp();
    });

    expect(result.current.isDragging).toBe(false);
  });

  it("ignores dragging and resets pan when zoom returns to 1", async () => {
    const { result, rerender } = renderHook(
      ({ zoom }) => useImagePan({ zoom }),
      { initialProps: { zoom: 2 } },
    );

    act(() => {
      result.current.onPointerDown(makePointerEvent("pointerdown", 10, 10));
      result.current.onPointerMove(makePointerEvent("pointermove", 50, 50));
      result.current.onPointerUp();
    });

    expect(result.current.pan).toEqual({ x: 40, y: 40 });

    await act(async () => {
      rerender({ zoom: 1 });
      await Promise.resolve();
    });

    expect(result.current.pan).toEqual({ x: 0, y: 0 });

    act(() => {
      result.current.onPointerDown(makePointerEvent("pointerdown", 0, 0));
      result.current.onPointerMove(makePointerEvent("pointermove", 40, 40));
    });

    expect(result.current.pan).toEqual({ x: 0, y: 0 });
  });

  it("does not carry pan offset across previewed files", async () => {
    const { result, rerender } = renderHook(
      ({ resetKey }) => useImagePan({ zoom: 2, resetKey }),
      { initialProps: { resetKey: "file-a" } },
    );

    act(() => {
      result.current.onPointerDown(makePointerEvent("pointerdown", 0, 0));
      result.current.onPointerMove(makePointerEvent("pointermove", 64, -24));
      result.current.onPointerUp();
    });

    expect(result.current.pan).toEqual({ x: 64, y: -24 });

    await act(async () => {
      rerender({ resetKey: "file-b" });
      await Promise.resolve();
    });

    expect(result.current.pan).toEqual({ x: 0, y: 0 });
  });
});

function makePointerEvent(
  type: string,
  clientX: number,
  clientY: number,
): React.PointerEvent<HTMLDivElement> {
  return ({
    type,
    pointerId: 1,
    clientX,
    clientY,
    currentTarget: {
      setPointerCapture: () => {},
      releasePointerCapture: () => {},
    },
    preventDefault: () => {},
    stopPropagation: () => {},
  } as unknown) as React.PointerEvent<HTMLDivElement>;
}
