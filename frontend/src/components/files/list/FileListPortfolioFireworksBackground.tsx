import { useEffect, useRef } from "react";

const MAX_CANVAS_DPR = 1.5;
const INITIAL_HUE = 120;
const HUE_STEP = 0.5;
const AUTO_LAUNCH_TICKS = 80;
const POINTER_LAUNCH_TICKS = 5;
const FIREWORK_TRAIL_POINTS = 3;
const PARTICLE_TRAIL_POINTS = 5;
const PARTICLE_COUNT = 30;

type Point = {
  x: number;
  y: number;
};

type Firework = Point & {
  acceleration: number;
  angle: number;
  brightness: number;
  coordinates: [number, number][];
  distanceToTarget: number;
  distanceTraveled: number;
  speed: number;
  sx: number;
  sy: number;
  targetRadius: number;
  tx: number;
  ty: number;
};

type Particle = Point & {
  alpha: number;
  angle: number;
  brightness: number;
  coordinates: [number, number][];
  decay: number;
  friction: number;
  gravity: number;
  hue: number;
  speed: number;
};

function isFireworksTheme() {
  const theme = document.documentElement.getAttribute("data-theme");
  return theme === "dark" || theme === "light";
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function readToken(styles: CSSStyleDeclaration, name: string, fallback: string) {
  return styles.getPropertyValue(name).trim() || fallback;
}

function random(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function distance(from: Point, to: Point) {
  const xDistance = from.x - to.x;
  const yDistance = from.y - to.y;
  return Math.sqrt(xDistance * xDistance + yDistance * yDistance);
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

function coordinateTrail(x: number, y: number, count: number) {
  const coordinates: [number, number][] = [];
  for (let index = 0; index < count; index += 1) {
    coordinates.push([x, y]);
  }
  return coordinates;
}

function createFirework(sx: number, sy: number, tx: number, ty: number): Firework {
  return {
    x: sx,
    y: sy,
    sx,
    sy,
    tx,
    ty,
    distanceToTarget: distance({ x: sx, y: sy }, { x: tx, y: ty }),
    distanceTraveled: 0,
    coordinates: coordinateTrail(sx, sy, FIREWORK_TRAIL_POINTS),
    angle: Math.atan2(ty - sy, tx - sx),
    speed: 2,
    acceleration: 1.05,
    brightness: random(50, 70),
    targetRadius: 1,
  };
}

function createParticle(x: number, y: number, hue: number): Particle {
  return {
    x,
    y,
    coordinates: coordinateTrail(x, y, PARTICLE_TRAIL_POINTS),
    angle: random(0, Math.PI * 2),
    speed: random(1, 10),
    friction: 0.95,
    gravity: 1,
    hue: random(hue - 20, hue + 20),
    brightness: random(50, 80),
    alpha: 1,
    decay: random(0.015, 0.03),
  };
}

function drawFirework(ctx: CanvasRenderingContext2D, firework: Firework, hue: number) {
  ctx.beginPath();
  ctx.moveTo(
    firework.coordinates[firework.coordinates.length - 1][0],
    firework.coordinates[firework.coordinates.length - 1][1],
  );
  ctx.lineTo(firework.x, firework.y);
  ctx.strokeStyle = `hsl(${hue}, 100%, ${firework.brightness}%)`;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(firework.tx, firework.ty, firework.targetRadius, 0, Math.PI * 2);
  ctx.stroke();
}

function updateFirework(firework: Firework) {
  firework.coordinates.pop();
  firework.coordinates.unshift([firework.x, firework.y]);
  firework.targetRadius = firework.targetRadius < 8 ? firework.targetRadius + 0.3 : 1;
  firework.speed *= firework.acceleration;

  const vx = Math.cos(firework.angle) * firework.speed;
  const vy = Math.sin(firework.angle) * firework.speed;
  firework.distanceTraveled = distance(
    { x: firework.sx, y: firework.sy },
    { x: firework.x + vx, y: firework.y + vy },
  );

  if (firework.distanceTraveled >= firework.distanceToTarget) return true;

  firework.x += vx;
  firework.y += vy;
  return false;
}

function drawParticle(ctx: CanvasRenderingContext2D, particle: Particle) {
  ctx.beginPath();
  ctx.moveTo(
    particle.coordinates[particle.coordinates.length - 1][0],
    particle.coordinates[particle.coordinates.length - 1][1],
  );
  ctx.lineTo(particle.x, particle.y);
  ctx.strokeStyle = `hsla(${particle.hue}, 100%, ${particle.brightness}%, ${particle.alpha})`;
  ctx.stroke();
}

function updateParticle(particle: Particle) {
  particle.coordinates.pop();
  particle.coordinates.unshift([particle.x, particle.y]);
  particle.speed *= particle.friction;
  particle.x += Math.cos(particle.angle) * particle.speed;
  particle.y += Math.sin(particle.angle) * particle.speed + particle.gravity;
  particle.alpha -= particle.decay;
  return particle.alpha <= particle.decay;
}

function createParticles(x: number, y: number, hue: number) {
  const particles: Particle[] = [];
  for (let index = 0; index < PARTICLE_COUNT; index += 1) {
    particles.push(createParticle(x, y, hue));
  }
  return particles;
}

export default function FileListPortfolioFireworksBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    let frameId: number | null = null;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let hue = INITIAL_HUE;
    let fireworks: Firework[] = [];
    let particles: Particle[] = [];
    let timerTick = 0;
    let limiterTick = 0;
    let pointerDown = false;
    let pointer: Point = { x: width / 2, y: height / 2 };
    let listeningForInteraction = false;

    const cancelFrame = () => {
      if (frameId == null) return;
      window.cancelAnimationFrame(frameId);
      frameId = null;
    };

    const clearCanvas = () => {
      canvas.style.background = "none";
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      fireworks = [];
      particles = [];
    };

    const readStyles = () => {
      const styles = getComputedStyle(document.documentElement);
      return {
        bg: readToken(styles, "--filelist-fireworks-bg", "rgb(0, 0, 0)"),
        trailFill: readToken(styles, "--filelist-fireworks-trail-fill", "rgba(0, 0, 0, 0.5)"),
      };
    };

    const resize = () => {
      const size = resizeCanvas(canvas, ctx);
      width = size.width;
      height = size.height;
      pointer = { x: width / 2, y: height / 2 };
    };

    const renderStill = () => {
      resize();
      const { bg } = readStyles();
      canvas.style.background = bg;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);
    };

    const scheduleFrame = () => {
      if (frameId != null || !isFireworksTheme() || prefersReducedMotion()) return;
      frameId = window.requestAnimationFrame(loop);
    };

    const launchFirework = (tx: number, ty: number) => {
      fireworks.push(createFirework(width / 2, height, tx, ty));
    };

    const onPointerMove = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
    };

    const onPointerDown = (event: PointerEvent) => {
      pointerDown = true;
      pointer = { x: event.clientX, y: event.clientY };
    };

    const onPointerUp = () => {
      pointerDown = false;
    };

    const addInteractionListeners = () => {
      if (listeningForInteraction) return;
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointerup", onPointerUp);
      listeningForInteraction = true;
    };

    const removeInteractionListeners = () => {
      if (!listeningForInteraction) return;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      listeningForInteraction = false;
    };

    const loop = () => {
      frameId = null;
      if (!isFireworksTheme()) {
        clearCanvas();
        return;
      }

      const { trailFill } = readStyles();
      scheduleFrame();
      hue += HUE_STEP;
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = trailFill;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";

      for (let index = fireworks.length - 1; index >= 0; index -= 1) {
        const firework = fireworks[index];
        drawFirework(ctx, firework, hue);
        if (updateFirework(firework)) {
          particles.push(...createParticles(firework.tx, firework.ty, hue));
          fireworks.splice(index, 1);
        }
      }

      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index];
        drawParticle(ctx, particle);
        if (updateParticle(particle)) particles.splice(index, 1);
      }

      if (timerTick >= AUTO_LAUNCH_TICKS) {
        if (!pointerDown) {
          launchFirework(random(0, width), random(0, height / 2));
          timerTick = 0;
        }
      } else {
        timerTick += 1;
      }

      if (limiterTick >= POINTER_LAUNCH_TICKS) {
        if (pointerDown) {
          launchFirework(pointer.x, pointer.y);
          limiterTick = 0;
        }
      } else {
        limiterTick += 1;
      }
    };

    const start = () => {
      cancelFrame();
      removeInteractionListeners();
      hue = INITIAL_HUE;
      fireworks = [];
      particles = [];
      timerTick = 0;
      limiterTick = 0;
      pointerDown = false;

      if (!isFireworksTheme()) {
        clearCanvas();
        return;
      }

      resize();
      const { bg } = readStyles();
      canvas.style.background = bg;

      if (prefersReducedMotion()) {
        renderStill();
        return;
      }

      addInteractionListeners();
      scheduleFrame();
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
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 h-screen w-screen opacity-[var(--filelist-fireworks-opacity)]"
      data-testid="filelist-portfolio-fireworks-background"
    />
  );
}
