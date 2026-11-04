"use client";

import { useRef } from "react";
import { LAND, ROUTE_DRAW, ROUTE_HOLD, classify, makeRoute, pan, routeTrail, type Point } from "./halftone-map";
import { CELL, INK, bay, dots, field, rng, type Level } from "./halftone-kit";
import { motion, useMotionPaused, useScene } from "./use-scene";

// Night drive: the whole map sits dim, and a headlight pool travelling just
// ahead of the route lights the streets at full brightness.
const LIT: Level[] = [0, 0, 1, 2, 3];
const STILL_TIME = 6;
// A new route starts partly drawn so the first frame already shows one.
const ROUTE_HEAD_START = ROUTE_DRAW * 0.7;

export default function HeroArtwork() {
  const paused = useMotionPaused();
  const figureRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drive = useRef({ random: rng(11), route: [] as Point[], start: -Infinity });

  useScene(canvasRef, {
    animated: true,
    stillTime: STILL_TIME,
    setup() {
      if (figureRef.current) figureRef.current.dataset.rendered = "true";
      return null;
    },
    draw(ctx, { w, h, t }) {
      const d = drive.current;
      if (t - d.start > ROUTE_DRAW + ROUTE_HOLD) {
        d.route = makeRoute(d.random, w, h, t);
        d.start = t - (d.start === -Infinity ? ROUTE_HEAD_START : 0);
      }
      const [px, py] = pan(t);
      const local = d.route.map(([x, y]): Point => [x - px, y - py]);
      const { points, head } = routeTrail(local, (t - d.start) / ROUTE_DRAW, CELL);

      // The pool sits a little ahead of the car, along its heading.
      const behind = points[Math.max(0, points.length - 4)];
      const hx = head[0] - behind[0], hy = head[1] - behind[1], len = Math.hypot(hx, hy) || 1;
      const cx = head[0] + (hx / len) * 70, cy = head[1] + (hy / len) * 70, radius = Math.min(190, w * 0.32);

      const cells = classify(w, h, t), cols = Math.ceil(w / CELL);
      field(ctx, w, h, (x, y, c, r) => {
        const kind = cells[r * cols + c];
        if (kind === LAND.water || kind === LAND.blank) return 0;
        const dist = Math.hypot(x - cx, y - cy) / radius;
        if (dist < 1 - 0.45 * bay(c, r)) return LIT[kind];
        if (kind === LAND.shore) return 5;
        return bay(c, r) < 0.5 ? 5 : 0;
      });
      dots(ctx, points, INK.accent, 3);
      ctx.fillStyle = INK.accent;
      ctx.fillRect(head[0] - 4, head[1] - 4, 8, 8);
    },
  });

  return (
    <>
      <figure ref={figureRef} className="hero-map" aria-hidden="true">
        <canvas ref={canvasRef} />
      </figure>
      <button className="hero-motion-control" type="button" aria-pressed={paused} onClick={motion.toggle}>
        {paused ? "Resume animation" : "Pause animation"}
      </button>
    </>
  );
}
