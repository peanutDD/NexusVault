import { useEffect, useRef } from "react";

const FRAME_INTERVAL_MS = 42;
const MAX_CANVAS_DPR = 1.5;
const GRID_GAP_PX = 40;
const REST_SCALE = 0.09;
const MIN_HOVER_SCALE = 1;
const MAX_HOVER_SCALE = 3;
const POINTER_RADIUS_RATIO = 0.3;
const WAVE_SPEED_PX_PER_SECOND = 1200;
const WAVE_WIDTH_PX = 180;

type ShapeColor =
  | { type: "solid"; value: string }
  | { type: "gradient"; stops: [string, string] };

type ShapeType = "circle" | "pill" | "star";

type Shape = {
  angle: number;
  color: ShapeColor;
  hovered: boolean;
  innerRatio: number;
  maxScale: number;
  points: number;
  scale: number;
  size: number;
  type: ShapeType;
  x: number;
  y: number;
};

type ShapeGrid = {
  height: number;
  shapes: Shape[];
  width: number;
};

type Point = {
  x: number;
  y: number;
};

type Wave = Point & {
  startTime: number;
};

type ShapeWaveBackgroundProps = {
  className?: string;
  enabled?: () => boolean;
  testId: string;
  tokenPrefix: "--auth-shape-wave" | "--filelist-shape-wave";
  transparentBackground?: boolean;
};

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function readToken(styles: CSSStyleDeclaration, name: string, fallback: string) {
  return styles.getPropertyValue(name).trim() || fallback;
}

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function randomInt(min: number, max: number) {
  return Math.floor(randomBetween(min, max + 1));
}

function pick<T>(values: T[]) {
  return values[Math.floor(Math.random() * values.length)] ?? values[0];
}

function smoothstep(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function durationToFactor(seconds: number) {
  if (seconds <= 0) return 1;
  return 1 - Math.pow(0.05, 1 / (60 * seconds));
}

function readPalette(styles: CSSStyleDeclaration, tokenPrefix: ShapeWaveBackgroundProps["tokenPrefix"]): ShapeColor[] {
  const token = (name: string, fallback: string) =>
    readToken(styles, `${tokenPrefix}-${name}`, fallback);

  return [
    { type: "solid", value: token("color-emerald", "#22c55e") },
    { type: "solid", value: token("color-cyan", "#06b6d4") },
    { type: "solid", value: token("color-orange", "#f97316") },
    { type: "solid", value: token("color-rose", "#ef4444") },
    { type: "solid", value: token("color-yellow", "#facc15") },
    { type: "solid", value: token("color-pink", "#ec4899") },
    { type: "solid", value: token("color-slate", "#9ca3af") },
    { type: "solid", value: token("color-violet", "#a78bfa") },
    { type: "solid", value: token("color-blue", "#60a5fa") },
    { type: "solid", value: token("color-mint", "#34d399") },
    {
      type: "gradient",
      stops: [
        token("gradient-purple-start", "#8b5cf6"),
        token("gradient-purple-end", "#06b6d4"),
      ],
    },
    {
      type: "gradient",
      stops: [
        token("gradient-cyan-start", "#06b6d4"),
        token("gradient-cyan-end", "#22c55e"),
      ],
    },
    {
      type: "gradient",
      stops: [
        token("gradient-solar-start", "#f97316"),
        token("gradient-solar-end", "#ef4444"),
      ],
    },
  ];
}

function createShape(type: ShapeType, x: number, y: number, color: ShapeColor): Shape {
  return {
    angle: randomBetween(0, Math.PI * 2),
    color,
    hovered: false,
    innerRatio: randomBetween(0.1, 0.5),
    maxScale: randomBetween(MIN_HOVER_SCALE, MAX_HOVER_SCALE),
    points: randomInt(4, 10),
    scale: REST_SCALE,
    size: GRID_GAP_PX * 0.38,
    type,
    x,
    y,
  };
}

function buildGrid(width: number, height: number, palette: ShapeColor[]): ShapeGrid {
  const columns = Math.max(1, Math.floor(width / GRID_GAP_PX));
  const rows = Math.max(1, Math.floor(height / GRID_GAP_PX));
  const offsetX = (width - (columns - 1) * GRID_GAP_PX) / 2;
  const offsetY = (height - (rows - 1) * GRID_GAP_PX) / 2;
  const shapeTypes: ShapeType[] = ["circle", "pill", "star", "star"];
  const shapes: Shape[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      shapes.push(
        createShape(
          pick(shapeTypes),
          offsetX + column * GRID_GAP_PX,
          offsetY + row * GRID_GAP_PX,
          pick(palette),
        ),
      );
    }
  }

  return { height, shapes, width };
}

function resizeCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_CANVAS_DPR);

  canvas.width = Math.max(1, Math.floor(width * dpr));
  canvas.height = Math.max(1, Math.floor(height * dpr));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  return { height, width };
}

function drawCircle(ctx: CanvasRenderingContext2D, size: number) {
  ctx.beginPath();
  ctx.arc(0, 0, size, 0, Math.PI * 2);
  ctx.fill();
}

function drawPill(ctx: CanvasRenderingContext2D, size: number) {
  const width = size * 0.48;
  const height = size;
  ctx.beginPath();
  ctx.roundRect(-width, -height, width * 2, height * 2, width);
  ctx.fill();
}

function drawStar(ctx: CanvasRenderingContext2D, shape: Shape) {
  ctx.beginPath();
  for (let index = 0; index < shape.points * 2; index += 1) {
    const angle = (index * Math.PI) / shape.points - Math.PI / 2;
    const radius = index % 2 === 0 ? shape.size : shape.size * shape.innerRatio;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.fill();
}

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape) {
  if (shape.type === "circle") {
    drawCircle(ctx, shape.size / 1.5);
    return;
  }
  if (shape.type === "pill") {
    drawPill(ctx, shape.size / 1.4);
    return;
  }
  drawStar(ctx, shape);
}

function resolveFill(ctx: CanvasRenderingContext2D, color: ShapeColor, size: number) {
  if (color.type === "solid") return color.value;
  const gradient = ctx.createRadialGradient(0, -size * 0.3, 0, 0, size * 0.3, size * 1.5);
  gradient.addColorStop(0, color.stops[0]);
  gradient.addColorStop(1, color.stops[1]);
  return gradient;
}

function drawFrame(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  grid: ShapeGrid,
  pointer: Point | null,
  activity: number,
  waves: Wave[],
  now: number,
  tokenPrefix: ShapeWaveBackgroundProps["tokenPrefix"],
  transparentBackground: boolean,
) {
  const styles = getComputedStyle(document.documentElement);
  const bg = readToken(styles, `${tokenPrefix}-bg`, "rgb(2, 6, 23)");
  const wash = readToken(
    styles,
    `${tokenPrefix}-wash`,
    transparentBackground ? "rgba(0, 0, 0, 0)" : "rgba(2, 6, 23, 0.48)",
  );
  const radius = Math.min(grid.width, grid.height) * POINTER_RADIUS_RATIO;
  const maxDistance = Math.sqrt(grid.width * grid.width + grid.height * grid.height);
  let active = activity > 0.001;

  canvas.style.background = transparentBackground ? "transparent" : bg;
  ctx.clearRect(0, 0, grid.width, grid.height);
  if (!transparentBackground) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, grid.width, grid.height);
  }

  const liveWaves = waves.filter((wave) => {
    const waveRadius = ((now - wave.startTime) / 1000) * WAVE_SPEED_PX_PER_SECOND;
    return waveRadius < maxDistance + WAVE_WIDTH_PX;
  });
  if (liveWaves.length > 0) active = true;

  for (const shape of grid.shapes) {
    let pointerInfluence = 0;
    if (pointer && activity > 0.001) {
      const dx = shape.x - pointer.x;
      const dy = shape.y - pointer.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      pointerInfluence = smoothstep(1 - distance / radius) * activity;

      if (pointerInfluence > 0.05 && !shape.hovered) {
        shape.hovered = true;
        shape.maxScale = randomBetween(MIN_HOVER_SCALE, MAX_HOVER_SCALE);
        shape.angle = randomBetween(0, Math.PI * 2);
        shape.points = randomInt(4, 10);
        shape.innerRatio = randomBetween(0.1, 0.5);
      } else if (pointerInfluence <= 0.05) {
        shape.hovered = false;
      }
    } else {
      shape.hovered = false;
    }

    let waveInfluence = 0;
    for (const wave of liveWaves) {
      const waveRadius = ((now - wave.startTime) / 1000) * WAVE_SPEED_PX_PER_SECOND;
      const dx = shape.x - wave.x;
      const dy = shape.y - wave.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const t = 1 - Math.abs(distance - waveRadius) / WAVE_WIDTH_PX;
      if (t > 0) waveInfluence = Math.max(waveInfluence, Math.sin(Math.PI * t));
    }

    const pointerTarget = REST_SCALE + pointerInfluence * (shape.maxScale - REST_SCALE);
    const waveTarget = REST_SCALE + waveInfluence * (shape.maxScale - REST_SCALE);
    const target = Math.max(pointerTarget, waveTarget);
    const factor = target > shape.scale ? durationToFactor(0.5) : durationToFactor(0.6);
    shape.scale += (target - shape.scale) * factor;
    if (Math.abs(shape.scale - REST_SCALE) > 0.01) active = true;
    if (shape.scale < REST_SCALE * 0.15) continue;

    ctx.save();
    ctx.translate(shape.x, shape.y);
    ctx.rotate(shape.angle);
    ctx.scale(shape.scale, shape.scale);
    ctx.fillStyle = resolveFill(ctx, shape.color, shape.size);
    drawShape(ctx, shape);
    ctx.restore();
  }

  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, grid.width, grid.height);

  return { active, waves: liveWaves };
}

export default function ShapeWaveBackground({
  className = "",
  enabled = () => true,
  testId,
  tokenPrefix,
  transparentBackground = false,
}: ShapeWaveBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    let frameId: number | null = null;
    let lastFrameAt = 0;
    let grid: ShapeGrid | null = null;
    let pointer: Point | null = null;
    let activity = 0;
    let waves: Wave[] = [];
    let listeningForInteraction = false;

    const isEnabled = () => enabled();

    const cancelFrame = () => {
      if (frameId == null) return;
      window.cancelAnimationFrame(frameId);
      frameId = null;
    };

    const clearCanvas = () => {
      canvas.style.background = "none";
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const initializeGrid = () => {
      const { height, width } = resizeCanvas(canvas, ctx);
      const palette = readPalette(getComputedStyle(document.documentElement), tokenPrefix);
      grid = buildGrid(width, height, palette);
      return grid;
    };

    const renderStill = () => {
      const currentGrid = grid ?? initializeGrid();
      const result = drawFrame(
        canvas,
        ctx,
        currentGrid,
        null,
        0,
        [],
        performance.now(),
        tokenPrefix,
        transparentBackground,
      );
      waves = result.waves;
    };

    const scheduleFrame = () => {
      if (frameId != null || !isEnabled() || prefersReducedMotion()) return;
      frameId = window.requestAnimationFrame(loop);
    };

    const triggerWave = (x = window.innerWidth / 2, y = window.innerHeight / 2) => {
      waves.push({ x, y, startTime: performance.now() });
      scheduleFrame();
    };

    const onPointerMove = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
      activity = 1;
      scheduleFrame();
    };

    const onClick = (event: MouseEvent) => {
      triggerWave(event.clientX, event.clientY);
    };

    const addInteractionListeners = () => {
      if (listeningForInteraction) return;
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("click", onClick);
      listeningForInteraction = true;
    };

    const removeInteractionListeners = () => {
      if (!listeningForInteraction) return;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("click", onClick);
      listeningForInteraction = false;
    };

    const loop = (timestamp: number) => {
      frameId = null;
      if (!isEnabled()) {
        clearCanvas();
        return;
      }

      if (timestamp - lastFrameAt < FRAME_INTERVAL_MS) {
        scheduleFrame();
        return;
      }

      const currentGrid = grid ?? initializeGrid();
      const result = drawFrame(
        canvas,
        ctx,
        currentGrid,
        pointer,
        activity,
        waves,
        timestamp,
        tokenPrefix,
        transparentBackground,
      );
      activity *= 0.93;
      waves = result.waves;
      lastFrameAt = timestamp;

      if (result.active) scheduleFrame();
    };

    const start = () => {
      cancelFrame();
      removeInteractionListeners();
      pointer = null;
      activity = 0;
      waves = [];

      if (!isEnabled()) {
        clearCanvas();
        return;
      }

      initializeGrid();
      renderStill();

      if (prefersReducedMotion()) return;

      addInteractionListeners();
      triggerWave();
    };

    const themeObserver = new MutationObserver(start);
    themeObserver.observe(document.documentElement, {
      attributeFilter: ["class", "data-theme"],
      attributes: true,
    });

    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    media?.addEventListener?.("change", start);
    window.addEventListener("resize", start);

    start();

    return () => {
      cancelFrame();
      removeInteractionListeners();
      themeObserver.disconnect();
      media?.removeEventListener?.("change", start);
      window.removeEventListener("resize", start);
    };
  }, [enabled, tokenPrefix, transparentBackground]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 h-screen w-screen ${className}`}
      data-testid={testId}
    />
  );
}
