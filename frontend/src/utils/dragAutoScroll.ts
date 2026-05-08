const EDGE_THRESHOLD_PX = 96;
const MAX_SCROLL_DELTA_PX = 22;

let rafId: number | null = null;
let latestClientY: number | null = null;

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

function tick() {
  if (latestClientY == null) {
    rafId = null;
    return;
  }

  const delta = calculateDragAutoScrollDelta(latestClientY, window.innerHeight);
  if (delta !== 0) {
    window.scrollBy({ top: delta, behavior: "auto" });
    rafId = window.requestAnimationFrame(tick);
    return;
  }

  rafId = null;
}

export function startDragAutoScroll() {
  if (rafId != null) return;
  rafId = window.requestAnimationFrame(tick);
}

export function updateDragAutoScroll(clientY: number) {
  latestClientY = clientY;
  if (calculateDragAutoScrollDelta(clientY, window.innerHeight) === 0) {
    return;
  }
  startDragAutoScroll();
}

export function stopDragAutoScroll() {
  latestClientY = null;
  if (rafId != null) {
    window.cancelAnimationFrame(rafId);
    rafId = null;
  }
}
