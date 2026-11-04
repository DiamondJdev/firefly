"use client";

import { useRef } from "react";
import { DRIVE, LAND, advanceDrive, classify, driveGoal, fromRoadGrid, pan, pathSlice, type Drive, type Point } from "./halftone-map";
import { CELL, INK, bay, dots, field, rng, type Level } from "./halftone-kit";
import { motion, useMotionPaused, useScene } from "./use-scene";

// Night drive: the whole map sits dim, and a headlight pool travelling just
// ahead of the route lights the streets at full brightness.
const LIT: Level[] = [0, 0, 1, 2, 3];
const STILL_TIME = 6;

export default function HeroArtwork() {
  const paused = useMotionPaused();
  const figureRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drive = useRef({ random: rng(11), state: null as Drive | null });

  useScene(canvasRef, {
    animated: true,
    stillTime: STILL_TIME,
    setup() {
      if (figureRef.current) figureRef.current.dataset.rendered = "true";
      return null;
    },
    draw(ctx, { w, h, t }) {
      const d = drive.current, travelled = t * DRIVE.speed;
      const [px, py] = pan(t);
      // The car roams near a spot that slowly wanders over the land side of the view.
      const { goal, reach } = driveGoal(w, h, t);
      d.state = advanceDrive(d.state, d.random, { travelled, ahead: DRIVE.ahead, behind: DRIVE.trail, goal, reach });
      const local = d.state.corners.map(([a, b]): Point => {
        const [x, y] = fromRoadGrid(a, b);
        return [x - px, y - py];
      });
      const at = travelled - d.state.base;
      const { points, head } = pathSlice(local, at - DRIVE.trail, at, CELL);

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
