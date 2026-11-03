"use client";

import { useEffect, useRef, useState } from "react";
import { CELL, LAND, ROUTE_DRAW, ROUTE_HOLD, classify, makeRoute, pan, routeTrail, type Point } from "./halftone-map";

// Halftone shades from the glyph ramp; brighter means denser.
const INK: [number, string, number][] = [
  [LAND.light, "#d4d6ab", 2.4],
  [LAND.dense, "#eff0c8", 2.6],
  [LAND.shore, "#fffde8", 3],
];
const FRAME_MS = 1000 / 30;
const STILL_TIME = 3;
// A new route starts partly drawn so the first frame already shows one.
const ROUTE_HEAD_START = ROUTE_DRAW * 0.6;

export default function HeroArtwork() {
  const [paused, setPaused] = useState(false);
  const figureRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const elapsed = useRef(STILL_TIME);
  const pausedRef = useRef(paused);
  const syncRef = useRef<() => void>(() => {});

  useEffect(() => {
    pausedRef.current = paused;
    syncRef.current();
  }, [paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const figure = figureRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !figure || !context) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#d3ee98";
    let frame = 0;
    let visible = true;
    let previous = performance.now();
    let lastDraw = 0;
    let route: Point[] = [];
    let routeStart = -Infinity;

    function drawRoute(ctx: CanvasRenderingContext2D, t: number) {
      const [px, py] = pan(t);
      const { points, head } = routeTrail(route, (t - routeStart) / ROUTE_DRAW, CELL);
      ctx.fillStyle = accent;
      for (const [x, y] of points) ctx.fillRect(x - px - 1.5, y - py - 1.5, 3, 3);
      ctx.fillRect(head[0] - px - 4, head[1] - py - 4, 8, 8);
      // Arrived: a blinking square marks home.
      if (t - routeStart < ROUTE_DRAW || Math.floor(t * 3) % 2 !== 0) return;
      for (let i = -3; i <= 3; i++) for (const j of [-3, 3]) {
        ctx.fillRect(head[0] - px + i * CELL - 1.5, head[1] - py + j * CELL - 1.5, 3, 3);
        ctx.fillRect(head[0] - px + j * CELL - 1.5, head[1] - py + i * CELL - 1.5, 3, 3);
      }
    }

    function draw() {
      if (!canvas || !context) return;
      const t = elapsed.current, w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      if (t - routeStart > ROUTE_DRAW + ROUTE_HOLD) {
        route = makeRoute(Math.random, w, h, t);
        routeStart = t - (routeStart === -Infinity ? ROUTE_HEAD_START : 0);
      }
      context.clearRect(0, 0, w, h);
      const cells = classify(w, h, t), cols = Math.ceil(w / CELL);
      for (const [kind, color, size] of INK) {
        context.fillStyle = color;
        for (let k = 0; k < cells.length; k++) {
          if (cells[k] === kind) context.fillRect((k % cols) * CELL, Math.floor(k / cols) * CELL, size, size);
        }
      }
      drawRoute(context, t);
      if (figure) figure.dataset.rendered = "true";
    }

    function tick(now: number) {
      elapsed.current += Math.min(now - previous, 64) / 1000;
      previous = now;
      if (now - lastDraw >= FRAME_MS) {
        draw();
        lastDraw = now;
      }
      frame = requestAnimationFrame(tick);
    }

    function sync() {
      cancelAnimationFrame(frame);
      if (!motion.matches && !pausedRef.current && visible && !document.hidden) {
        previous = performance.now();
        frame = requestAnimationFrame(tick);
      }
    }

    const resize = new ResizeObserver(() => {
      const density = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * density);
      canvas.height = Math.round(canvas.clientHeight * density);
      context.setTransform(density, 0, 0, density, 0, 0);
      draw();
      sync();
    });
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    resize.observe(canvas);
    intersection.observe(figure);
    motion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    syncRef.current = sync;

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      intersection.disconnect();
      motion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      syncRef.current = () => {};
    };
  }, []);

  return (
    <>
      <figure ref={figureRef} className="hero-map" aria-hidden="true">
        <canvas ref={canvasRef} />
      </figure>
      <button className="hero-motion-control" type="button" aria-pressed={paused} onClick={() => setPaused(!paused)}>
        {paused ? "Resume animation" : "Pause animation"}
      </button>
    </>
  );
}
