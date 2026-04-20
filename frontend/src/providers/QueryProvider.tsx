import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import axios from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: (failureCount, error: unknown) => {
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          if (status != null && [401, 403, 404].includes(status)) return false;
        }
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
    },
  },
});

const ReactQueryDevtoolsPanel = import.meta.env.DEV
  ? lazy(() =>
      import("@tanstack/react-query-devtools").then((mod) => ({
        default: mod.ReactQueryDevtoolsPanel,
      })),
    )
  : null;

type DevtoolsPos = {
  x: number;
  y: number;
};

const DEVTOOLS_POS_KEY = "rq-devtools-pos";
const DEVTOOLS_BUTTON_SIZE = 44;

function clampValue(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function clampPos(pos: DevtoolsPos): DevtoolsPos {
  if (typeof window === "undefined") return pos;
  const maxX = Math.max(8, window.innerWidth - DEVTOOLS_BUTTON_SIZE - 8);
  const maxY = Math.max(8, window.innerHeight - DEVTOOLS_BUTTON_SIZE - 8);

  return {
    x: clampValue(pos.x, 8, maxX),
    y: clampValue(pos.y, 8, maxY),
  };
}

function getInitialDevtoolsPos(): DevtoolsPos {
  if (typeof window === "undefined") return { x: 16, y: 16 };

  const fallback = clampPos({
    x: window.innerWidth - DEVTOOLS_BUTTON_SIZE - 16,
    y: window.innerHeight - DEVTOOLS_BUTTON_SIZE - 16,
  });

  try {
    const raw = localStorage.getItem(DEVTOOLS_POS_KEY);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as { x?: unknown }).x === "number" &&
      typeof (parsed as { y?: unknown }).y === "number"
    ) {
      return clampPos({
        x: (parsed as { x: number }).x,
        y: (parsed as { y: number }).y,
      });
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function QueryDevtools() {
  const [devtoolsOpen, setDevtoolsOpen] = useState(false);
  const [devtoolsPos, setDevtoolsPos] = useState<DevtoolsPos>(() =>
    getInitialDevtoolsPos(),
  );
  const [devtoolsBounce, setDevtoolsBounce] = useState(false);
  const [devtoolsViewport, setDevtoolsViewport] = useState(() => ({
    width: 960,
    height: 640,
    contentWidth: 960,
    contentHeight: 640,
    scale: 1,
  }));

  const posRef = useRef(devtoolsPos);
  const devtoolsContainerRef = useRef<HTMLDivElement | null>(null);
  const devtoolsButtonRef = useRef<HTMLButtonElement | null>(null);
  const dragRef = useRef({
    active: false,
    moved: false,
    dragging: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    pointerId: null as number | null,
    pointerType: "mouse",
    threshold: 6,
  });

  useEffect(() => {
    posRef.current = devtoolsPos;
  }, [devtoolsPos]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(DEVTOOLS_POS_KEY, JSON.stringify(devtoolsPos));
    } catch {
      return;
    }
  }, [devtoolsPos]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isTauri = Boolean((window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
    const isMacOS = navigator.userAgent.includes("Mac OS X");

    if (isTauri && isMacOS) {
      document.documentElement.classList.add("platform-macos");
    }

    const onResize = () => {
      setDevtoolsPos((pos) => clampPos(pos));
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const html = document.documentElement;
    const body = document.body;
    const prevOverflow = html.style.overflow;
    const prevOverscroll = body.style.overscrollBehavior;

    if (devtoolsOpen) {
      html.style.overflow = "hidden";
      body.style.overscrollBehavior = "contain";
    }

    return () => {
      html.style.overflow = prevOverflow;
      body.style.overscrollBehavior = prevOverscroll;
    };
  }, [devtoolsOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const calc = () => {
      const vv = window.visualViewport;
      const container = devtoolsContainerRef.current;
      let width = vv?.width ?? window.innerWidth;
      let height = vv?.height ?? window.innerHeight;

      if (container) {
        const styles = getComputedStyle(container);
        const paddingX =
          parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
        const paddingY =
          parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
        width = Math.max(0, container.clientWidth - paddingX);
        height = Math.max(0, container.clientHeight - paddingY);
      }

      const isDesktop = width >= 640;
      const pad = isDesktop
        ? 0
        : Math.round(Math.min(16, Math.max(8, width * 0.02)));
      const availableW = Math.max(260, width - pad * 2);
      const availableH = Math.max(
        240,
        (isDesktop ? Math.round(height * 0.6) : height) - pad * 2,
      );
      const factor = width < 480 ? 1.5 : width < 768 ? 1.35 : 1.2;
      const contentWidth = isDesktop
        ? availableW
        : Math.max(320, Math.min(1200, availableW * factor));
      const contentHeight = isDesktop
        ? availableH
        : Math.max(240, Math.min(900, availableH * factor));
      const scale = isDesktop
        ? 1
        : Math.min(1, availableW / contentWidth, availableH / contentHeight);

      setDevtoolsViewport({
        width: availableW,
        height: availableH,
        contentWidth,
        contentHeight,
        scale,
      });
    };

    calc();
    window.addEventListener("resize", calc);
    window.visualViewport?.addEventListener("resize", calc);
    window.visualViewport?.addEventListener("scroll", calc);

    const container = devtoolsContainerRef.current;
    const observer = container ? new ResizeObserver(() => calc()) : null;
    if (container && observer) {
      observer.observe(container);
    }

    return () => {
      window.removeEventListener("resize", calc);
      window.visualViewport?.removeEventListener("resize", calc);
      window.visualViewport?.removeEventListener("scroll", calc);
      observer?.disconnect();
    };
  }, [devtoolsOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onMove = (event: globalThis.PointerEvent) => {
      if (!dragRef.current.active) return;
      if (
        dragRef.current.pointerId != null &&
        event.pointerId !== dragRef.current.pointerId
      ) {
        return;
      }

      const dx = event.clientX - dragRef.current.startX;
      const dy = event.clientY - dragRef.current.startY;
      if (
        !dragRef.current.dragging &&
        Math.abs(dx) + Math.abs(dy) < dragRef.current.threshold
      ) {
        return;
      }

      if (!dragRef.current.dragging) {
        dragRef.current.dragging = true;
        dragRef.current.moved = true;
      }

      const next = clampPos({
        x: dragRef.current.originX + dx,
        y: dragRef.current.originY + dy,
      });

      if (next.x !== posRef.current.x || next.y !== posRef.current.y) {
        posRef.current = next;
        setDevtoolsPos(next);
      }
    };

    const onUp = (event?: globalThis.PointerEvent) => {
      if (!dragRef.current.active) return;
      if (
        event &&
        dragRef.current.pointerId != null &&
        event.pointerId !== dragRef.current.pointerId
      ) {
        return;
      }

      const wasDragging = dragRef.current.dragging;
      dragRef.current.active = false;
      dragRef.current.dragging = false;
      dragRef.current.pointerId = null;
      dragRef.current.pointerType = "mouse";
      dragRef.current.threshold = 6;

      if (devtoolsButtonRef.current && event) {
        try {
          devtoolsButtonRef.current.releasePointerCapture(event.pointerId);
        } catch {
          return;
        }
      }

      if (wasDragging) {
        const margin = 8;
        const left = margin;
        const right = Math.max(
          margin,
          window.innerWidth - DEVTOOLS_BUTTON_SIZE - margin,
        );
        const current = posRef.current;
        const targetX =
          current.x + DEVTOOLS_BUTTON_SIZE / 2 < window.innerWidth / 2
            ? left
            : right;
        const target = clampPos({ x: targetX, y: current.y });
        posRef.current = target;
        setDevtoolsPos(target);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    event.preventDefault();
    dragRef.current.active = true;
    dragRef.current.moved = false;
    dragRef.current.dragging = false;
    dragRef.current.startX = event.clientX;
    dragRef.current.startY = event.clientY;
    dragRef.current.originX = posRef.current.x;
    dragRef.current.originY = posRef.current.y;
    dragRef.current.pointerId = event.pointerId;
    dragRef.current.pointerType = event.pointerType;
    dragRef.current.threshold = event.pointerType === "touch" ? 2 : 6;

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      return;
    }
  };

  const handleClick = () => {
    if (dragRef.current.moved) {
      dragRef.current.moved = false;
      return;
    }

    setDevtoolsOpen((value) => !value);
    setDevtoolsBounce(true);
    window.setTimeout(() => setDevtoolsBounce(false), 240);
  };

  const handlePointerUp = () => {
    if (!dragRef.current.active) return;
    handleClick();
  };

  if (!ReactQueryDevtoolsPanel) return null;

  return (
    <>
      <Suspense fallback={null}>
        {devtoolsOpen && (
          <div
            ref={devtoolsContainerRef}
            className="fixed inset-0 z-[9998] devtools-vh devtools-shell border-t border-white/10 bg-slate-950/85 backdrop-blur-xl sm:inset-x-0 sm:bottom-0 sm:h-[60vh] sm:min-h-[360px] sm:max-h-[70vh]"
          >
            <div className="flex h-full w-full items-center justify-center overflow-hidden sm:items-end sm:justify-end">
              <div
                className="relative"
                style={{
                  width: `${devtoolsViewport.width}px`,
                  height: `${devtoolsViewport.height}px`,
                  ["--tsqd-scale" as string]: String(devtoolsViewport.scale),
                }}
              >
                <div
                  style={{
                    width: `${devtoolsViewport.contentWidth}px`,
                    height: `${devtoolsViewport.contentHeight}px`,
                    transform: `scale(${devtoolsViewport.scale})`,
                    transformOrigin: "top left",
                  }}
                >
                  <ReactQueryDevtoolsPanel
                    onClose={() => setDevtoolsOpen(false)}
                    style={{ height: "100%", width: "100%" }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </Suspense>

      <button
        type="button"
        aria-label="React Query Devtools"
        ref={devtoolsButtonRef}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        className={`group fixed z-[9999] flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-white shadow-[0_12px_40px_rgba(0,0,0,0.35),0_0_24px_rgba(168,85,247,0.22),0_0_32px_rgba(34,211,238,0.18)] backdrop-blur-md transition-transform active:scale-95 cursor-grab active:cursor-grabbing sm:h-11 sm:w-11 transition-[left,top] duration-200 ease-out touch-none select-none ${devtoolsBounce ? "devtools-bounce" : ""}`}
        style={{ left: devtoolsPos.x, top: devtoolsPos.y }}
      >
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-fuchsia-500/25 via-white/5 to-cyan-400/25 opacity-80 transition-opacity group-hover:opacity-100" />
        <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.35),transparent_55%)] opacity-70" />
        <svg
          viewBox="0 0 64 64"
          aria-hidden="true"
          className="relative z-10 h-8 w-8 select-none sm:h-7 sm:w-7"
        >
          <defs>
            <linearGradient id="devtools-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.9" />
              <stop offset="55%" stopColor="#a855f7" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#ec4899" stopOpacity="0.85" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="30" fill="url(#devtools-grad)" />
          <circle cx="32" cy="32" r="18" fill="#0f172a" opacity="0.75" />
          <path
            d="M28 18h8l-4 10h8l-12 18 4-12h-8l4-16z"
            fill="#f8fafc"
            opacity="0.9"
          />
        </svg>
      </button>
    </>
  );
}

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <QueryDevtools />
    </QueryClientProvider>
  );
}
