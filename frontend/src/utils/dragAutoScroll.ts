const EDGE_THRESHOLD_PX = 96;
const MAX_SCROLL_DELTA_PX = 22;

export class DragAutoScroller {
  private rafId: number | null = null;
  private latestClientY: number | null = null;

  private tick = () => {
    if (this.latestClientY == null) {
      this.rafId = null;
      return;
    }

    const delta = calculateDragAutoScrollDelta(this.latestClientY, window.innerHeight);
    if (delta !== 0) {
      window.scrollBy({ top: delta, behavior: "auto" });
      this.rafId = window.requestAnimationFrame(this.tick);
      return;
    }

    this.rafId = null;
  };

  start() {
    if (this.rafId != null) return;
    this.rafId = window.requestAnimationFrame(this.tick);
  }

  update(clientY: number) {
    this.latestClientY = clientY;
    if (calculateDragAutoScrollDelta(clientY, window.innerHeight) === 0) {
      return;
    }
    this.start();
  }

  stop() {
    this.latestClientY = null;
    if (this.rafId != null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}

export function createDragAutoScroller() {
  return new DragAutoScroller();
}

const defaultDragAutoScroller = createDragAutoScroller();

export function calculateDragAutoScrollDelta(
  clientY: number,
  viewportHeight: number,
) {
  if (viewportHeight <= 0) return 0;

  if (clientY < EDGE_THRESHOLD_PX) {
    const intensity = (EDGE_THRESHOLD_PX - Math.max(0, clientY)) / EDGE_THRESHOLD_PX;
    return -Math.ceil(intensity * MAX_SCROLL_DELTA_PX);
  }

  if (clientY > viewportHeight - EDGE_THRESHOLD_PX) {
    const distance = Math.max(0, viewportHeight - clientY);
    const intensity = (EDGE_THRESHOLD_PX - distance) / EDGE_THRESHOLD_PX;
    return Math.ceil(intensity * MAX_SCROLL_DELTA_PX);
  }

  return 0;
}

export function startDragAutoScroll() {
  defaultDragAutoScroller.start();
}

export function updateDragAutoScroll(clientY: number) {
  defaultDragAutoScroller.update(clientY);
}

export function stopDragAutoScroll() {
  defaultDragAutoScroller.stop();
}
