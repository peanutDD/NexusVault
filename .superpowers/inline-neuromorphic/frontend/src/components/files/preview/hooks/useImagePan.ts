import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";

export interface ImagePanPoint {
  x: number;
  y: number;
}

interface UseImagePanOptions {
  zoom: number;
  resetKey?: string;
}

interface DragStart {
  pointerId: number;
  clientX: number;
  clientY: number;
  panX: number;
  panY: number;
  resetKey?: string;
}

interface PanState {
  pan: ImagePanPoint;
  resetKey?: string;
}

const ZERO_PAN: ImagePanPoint = { x: 0, y: 0 };

export function useImagePan({ zoom, resetKey }: UseImagePanOptions) {
  const [panState, setPanState] = useState<PanState>({
    pan: ZERO_PAN,
    resetKey,
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<DragStart | null>(null);
  const canPan = zoom > 1;
  const pan =
    canPan && panState.resetKey === resetKey ? panState.pan : ZERO_PAN;

  const resetPan = useCallback(() => {
    dragStartRef.current = null;
    setIsDragging(false);
    setPanState({ pan: ZERO_PAN, resetKey });
  }, [resetKey]);

  useEffect(() => {
    if (canPan && panState.resetKey === resetKey) {
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) resetPan();
    });

    return () => {
      cancelled = true;
    };
  }, [canPan, panState.resetKey, resetKey, resetPan]);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!canPan) return;

      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragStartRef.current = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        panX: pan.x,
        panY: pan.y,
        resetKey,
      };
      setIsDragging(true);
    },
    [canPan, pan.x, pan.y, resetKey],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const dragStart = dragStartRef.current;
      if (
        !dragStart ||
        dragStart.pointerId !== event.pointerId ||
        dragStart.resetKey !== resetKey ||
        !canPan
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setPanState({
        resetKey,
        pan: {
          x: dragStart.panX + event.clientX - dragStart.clientX,
          y: dragStart.panY + event.clientY - dragStart.clientY,
        },
      });
    },
    [canPan, resetKey],
  );

  const stopDragging = useCallback(
    (event?: PointerEvent<HTMLDivElement>) => {
      const dragStart = dragStartRef.current;
      if (!dragStart) return;

      if (event && event.pointerId === dragStart.pointerId) {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      dragStartRef.current = null;
      setIsDragging(false);
    },
    [],
  );

  return {
    pan,
    isDragging: canPan && isDragging,
    resetPan,
    onPointerDown,
    onPointerMove,
    onPointerUp: stopDragging,
    onPointerCancel: stopDragging,
  };
}
