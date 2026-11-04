"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  CELL, INK, along, arrival, bay, bezier, blink, city, clamp, cycle, dots, drawRoute, field, frameDots,
  horizontalRoad, lengths, nearest, pointAt, rel, roadLevel, tone, fbm, type Point, type Rect,
} from "./halftone-kit";
import { enterProgress, makeLayer, useScene } from "./use-scene";

type Lot = { x0: number; x1: number; y0: number; y1: number };
const inLot = (x: number, y: number, l: Lot) => x >= l.x0 && x < l.x1 && y >= l.y0 && y < l.y1;

/** The pipeline band with a road along its top edge. A car drives Source to Serve and lights each stage. */
export function Pipeline({ stages }: { stages: [string, string][] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const items = useRef<(HTMLLIElement | null)[]>([]);
  useScene(ref, {
    animated: true,
    setup: () => null,
    draw(ctx, { w, h, t, still }) {
      const mid = Math.round(h / 2 / CELL) * CELL, speed = 120;
      horizontalRoad(ctx, w, h, 0, { mid, half: 10, shoulder: 18 });
      const period = (w + 160) / speed;
      const x = still ? w * 0.62 : ((t % period) / period) * (w + 160) - 80;
      const trail: Point[] = [];
      for (let i = 1; i < 10; i++) trail.push([x - i * CELL, mid + 6]);
      dots(ctx, trail);
      ctx.fillStyle = INK.accent;
      ctx.fillRect(x - 4, mid + 2, 8, 8);
      const left = ref.current!.getBoundingClientRect().left;
      for (const li of items.current) {
        if (!li) continue;
        const r = li.getBoundingClientRect(), a = r.left - left;
        li.classList.toggle("is-passing", x >= a && x < a + r.width);
      }
    },
  });
  return (
    <div className="pipeline-band">
      <canvas ref={ref} className="pipeline-road" aria-hidden="true" />
      <ol className="pipeline" aria-label="Planned deployment pipeline">
        {stages.map(([name, text], i) => (
          <li key={name} ref={el => { items.current[i] = el; }}><strong>{name}</strong><p>{text}</p></li>
        ))}
      </ol>
    </div>
  );
}

/** The useful parts: one road comes in from the left and splits, one branch into each paragraph. */
export function CapabilityJunction({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useScene(ref, {
    animated: true,
    setup(canvas, frame) {
      const { w, h } = frame, copy = canvas.parentElement!.querySelector(".capability-copy")!;
      const paragraphs = copy.querySelectorAll("p");
      const stacked = canvas.getBoundingClientRect().bottom <= copy.getBoundingClientRect().top + 1;
      let ends: [number, number];
      if (stacked || paragraphs.length < 2) ends = [30, h - 30];
      else {
        const a = rel(paragraphs[0], canvas), b = rel(paragraphs[1], canvas);
        ends = [a.y + Math.min(a.h / 2, 40), b.y + Math.min(b.h / 2, 40)];
      }
      const start = (ends[0] + ends[1]) / 2;
      const paths = ends.map(y => bezier([-10, start], [w * 0.45, start], [w * 0.62, y], [w + 10, y], 50));
      const lens = paths.map(lengths);
      const base = makeLayer(frame, ctx => field(ctx, w, h, (x, y, c, r) => {
        let best = Infinity;
        for (let i = 0; i < 2; i++) best = Math.min(best, nearest(paths[i], lens[i], x + 1.5, y + 1.5)[0]);
        return roadLevel(best, 0, c, r, x, y, { half: 13, spread: 64, dashes: false });
      }));
      return { base, paths, lens };
    },
    draw(ctx, { w, h, t, still }, s) {
      ctx.drawImage(s.base, 0, 0, w, h);
      ctx.fillStyle = INK.accent;
      s.paths.forEach((path, i) => {
        const total = s.lens[i][s.lens[i].length - 1];
        for (let k = 0; k < 3; k++) {
          const d = still ? total * (0.25 + k * 0.25) : (t * 90 + (k * total) / 3 + i * 80) % total;
          const [x, y] = pointAt(path, s.lens[i], d), [bx, by] = pointAt(path, s.lens[i], d - 6);
          const nx = -(y - by), ny = x - bx, nl = Math.hypot(nx, ny) || 1;
          ctx.fillRect(x + (nx / nl) * 5 - 3, y + (ny / nl) * 5 - 3, 6, 6);
        }
      });
    },
  });
  return (
    <div className="junction">
      <canvas ref={ref} aria-hidden="true" />
      {children}
    </div>
  );
}

/** A strip of neighbourhood under the photo. A route enters from the edge and drives to the house. */
export function HardwareMap() {
  const ref = useRef<HTMLCanvasElement>(null);
  useScene(ref, {
    animated: true,
    setup(_, frame) {
      const grid = { bw: 64, bh: 44, sw: 8, ox: 20, oy: 8 };
      const bx = Math.floor((frame.w * 0.72 + grid.ox) / grid.bw), by = 2;
      const lot: Lot = { x0: bx * grid.bw - grid.ox + grid.sw, x1: (bx + 1) * grid.bw - grid.ox, y0: by * grid.bh - grid.oy + grid.sw, y1: (by + 1) * grid.bh - grid.oy };
      const base = makeLayer(frame, ctx => field(ctx, frame.w, frame.h, (x, y, c, r) => {
        if (inLot(x, y, lot)) return bay(c, r) < 0.7 ? 4 : 0;
        return city(x, y, c, r, grid) ? (bay(c, r) < 0.6 ? 5 : 1) : 0;
      }));
      const street = (row: number) => row * grid.bh - grid.oy + 4, avenue = (col: number) => col * grid.bw - grid.ox + 4;
      const turn = Math.floor((frame.w * 0.4 + grid.ox) / grid.bw), door = (lot.x0 + lot.x1) / 2;
      const route: Point[] = [[0, street(1)], [avenue(turn), street(1)], [avenue(turn), street(by)], [door, street(by)], [door, lot.y0 + 4]];
      return { base, lot, route };
    },
    draw(ctx, { w, h, t, still }, s) {
      ctx.drawImage(s.base, 0, 0, w, h);
      const { p, arrived, m } = cycle(t, 4, 2.4);
      drawRoute(ctx, s.route, still ? 1 : p);
      if (still || (arrived && blink(m))) arrival(ctx, s.route[4][0], (s.lot.y0 + s.lot.y1) / 2, 4);
    },
  });
  return <canvas ref={ref} className="address-strip" aria-hidden="true" />;
}

/** Nothing hidden under the hood: rows start assembled and pull apart into an exploded view on scroll. */
export function ExplodedStack({ layers }: { layers: [string, string, string][] }) {
  const ref = useRef<HTMLDListElement>(null);
  useEffect(() => {
    const list = ref.current;
    if (!list) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    function update() {
      raf = 0;
      const p = reduce.matches ? 1 : enterProgress(list!, 1.1), e = p * p * (3 - 2 * p);
      const wide = window.innerWidth > 680, step = wide ? 44 : 10;
      list!.style.gap = `${(2 + 16 * e).toFixed(1)}px`;
      Array.from(list!.children).forEach((row, i) => {
        (row as HTMLElement).style.marginLeft = `${(i * step * e).toFixed(1)}px`;
        (row as HTMLElement).style.marginRight = wide ? "0px" : `${((layers.length - 1 - i) * step * e).toFixed(1)}px`;
      });
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reduce.addEventListener("change", schedule);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reduce.removeEventListener("change", schedule);
    };
  }, [layers.length]);
  return (
    <dl ref={ref} className="stack-list exploded">
      {layers.map(([name, job, role]) => <div key={name}><dt>{name}</dt><dd>{job}</dd><span>{role}</span></div>)}
    </dl>
  );
}

/** Built for the learning part: a winding road with a stop beside each paragraph, drawn as you read. */
export function AboutRoute() {
  const ref = useRef<HTMLCanvasElement>(null);
  useScene(ref, {
    animated: true,
    scroll: true,
    span: 1.1,
    scrollTarget: canvas => canvas.closest(".about-panel"),
    setup(canvas, frame) {
      const { w, h } = frame, panel = canvas.closest(".about-panel")!;
      const stacked = panel.clientWidth <= w + 2;
      let points: Point[] = [], stops: Point[];
      if (stacked) {
        const fy = (x: number) => h * 0.5 + Math.sin(x * 0.012) * h * 0.28;
        for (let x = -10; x <= w + 10; x += 6) points.push([x, fy(x)]);
        stops = [0.2, 0.5, 0.8].map(f => [w * f, fy(w * f)]);
      } else {
        const fx = (y: number) => w * 0.5 + Math.sin(y * 0.011 + 0.6) * w * 0.26;
        for (let y = -10; y <= h + 10; y += 6) points.push([fx(y), y]);
        stops = Array.from(panel.querySelectorAll(".about-letter p")).map(p => {
          const r = rel(p, canvas), y = r.y + Math.min(r.h / 2, 18);
          return [fx(y), y];
        });
      }
      const lens = lengths(points);
      const stopAt = stops.map(([x, y]) => nearest(points, lens, x, y)[1]);
      const base = makeLayer(frame, ctx => field(ctx, w, h, (x, y, c, r) => {
        const [d, at] = nearest(points, lens, x + 1.5, y + 1.5), half = 12;
        if (d < half) return d < 1.8 && at % 26 < 13 ? 1 : 0;
        if (d < half + CELL) return 3;
        const v = tone((0.15 + 0.65 * fbm(x * 0.012 + 2, y * 0.012)) * clamp((d - half) / 60), c, r);
        return v ? (bay(c, r) < 0.5 ? 1 : 5) : 0;
      }));
      return { base, points, lens, stops, stopAt };
    },
    draw(ctx, { w, h, t, enter, still }, s) {
      ctx.drawImage(s.base, 0, 0, w, h);
      const total = s.lens[s.lens.length - 1], reach = still ? total : enter * total;
      const lit = along(s.points, s.lens, reach);
      dots(ctx, lit);
      if (lit.length > 1) { const [x, y] = lit[lit.length - 1]; ctx.fillStyle = INK.accent; ctx.fillRect(x - 4, y - 4, 8, 8); }
      s.stops.forEach(([x, y], i) => {
        if (reach >= s.stopAt[i]) { if (still || blink(t)) arrival(ctx, x, y, 3); }
        else { ctx.fillStyle = INK.shore; ctx.fillRect(x - 3, y - 3, 6, 6); }
      });
    },
  });
  return <div className="about-art"><canvas ref={ref} aria-hidden="true" /></div>;
}

/** Fair questions: a road down the left with an exit ramp into every question. */
export function RampedQuestions({ questions }: { questions: string[][] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const open = useRef(new Map<number, number>());
  const scene = useScene(ref, {
    animated: true,
    setup(canvas, frame) {
      const { w, h } = frame, roadX = Math.round((w * 0.22) / CELL) * CELL + 2;
      const ramps = Array.from(canvas.parentElement!.querySelectorAll("summary")).map(summary => {
        const r = rel(summary, canvas), y = r.y + r.h / 2;
        return bezier([roadX + 9, y - 56], [roadX + 9, y - 14], [roadX + 22, y], [w + 2, y], 28);
      });
      const lens = ramps.map(lengths);
      const base = makeLayer(frame, ctx => {
        field(ctx, w, h, (x, y, c, r) => {
          const d = Math.abs(x + 1.5 - roadX);
          if (d < 6) return d < 1.6 && y % 24 < 12 ? 1 : 0;
          if (d < 6 + CELL) return 3;
          if (x + 1.5 < roadX && d < 23) return bay(c, r) < 0.4 * (1 - (d - 11) / 12) ? 5 : 0;
          return 0;
        });
        ramps.forEach((ramp, i) => dots(ctx, along(ramp, lens[i], Infinity).filter(([x]) => x > roadX + 9), INK.dim, 3));
      });
      return { base, roadX, ramps, lens };
    },
    draw(ctx, { w, h, t, still }, s) {
      ctx.drawImage(s.base, 0, 0, w, h);
      if (!still) { const y = (t * 70) % (h + 40) - 20; ctx.fillStyle = INK.shore; ctx.fillRect(s.roadX - 3, y - 3, 6, 6); }
      for (const [i, since] of open.current) {
        const ramp = s.ramps[i];
        if (!ramp) continue;
        const total = s.lens[i][s.lens[i].length - 1], p = still ? 1 : clamp((t - since) / 0.9);
        const lit = along(ramp, s.lens[i], total * p);
        dots(ctx, lit);
        const [x, y] = lit[lit.length - 1] ?? ramp[0];
        ctx.fillStyle = INK.accent;
        ctx.fillRect(x - 4, y - 4, 8, 8);
      }
    },
  });

  function toggled(i: number, isOpen: boolean) {
    if (isOpen) open.current.set(i, scene.current.time());
    else open.current.delete(i);
    // Answers change the row positions, so the ramps are re-laid.
    requestAnimationFrame(() => scene.current.resetup());
  }

  return (
    <div className="faq-list ramped">
      <canvas ref={ref} aria-hidden="true" />
      {questions.map(([question, answer], i) => (
        <details key={question} onToggle={e => toggled(i, e.currentTarget.open)}>
          <summary>{question}<span className="disclosure-symbol" aria-hidden="true">+</span></summary>
          <p>{answer}</p>
        </details>
      ))}
    </div>
  );
}

/** Come see how it is built: a road from the left edge curves up to the button, and the route arrives. */
export function InvitationRoute() {
  const ref = useRef<HTMLCanvasElement>(null);
  useScene(ref, {
    animated: true,
    setup(canvas, frame) {
      const { w, h } = frame, section = canvas.closest("section")!;
      const cta: Rect = rel(section.querySelector("[data-destination]")!, canvas);
      const heading = rel(section.querySelector("h2")!, canvas);
      const narrow = w < 680, cy = cta.y + cta.h / 2;
      const points = narrow
        ? bezier([-10, h - 50], [w * 0.5, h - 50], [cta.x + 40, h - 50], [cta.x + 40, cta.y + cta.h + 16], 50)
        : bezier([-10, Math.max(heading.y + heading.h, cta.y + cta.h) + 70], [cta.x - 280, Math.max(heading.y + heading.h, cta.y + cta.h) + 70], [cta.x - 88, cy], [cta.x - 18, cy], 60);
      const lens = lengths(points);
      const base = makeLayer(frame, ctx => field(ctx, w, h, (x, y, c, r) => {
        const [d] = nearest(points, lens, x + 1.5, y + 1.5), half = 12;
        if (d < half) return 0;
        if (d < half + CELL) return 3;
        const v = tone((0.25 + 0.6 * fbm(x * 0.02, y * 0.02)) * clamp(1 - (d - half) / 46), c, r);
        return v ? (bay(c, r) < 0.5 ? 1 : 5) : 0;
      }));
      return { base, points, cta };
    },
    draw(ctx, { w, h, t, still }, s) {
      ctx.drawImage(s.base, 0, 0, w, h);
      const { p, arrived, m } = cycle(t, 3.6, 3);
      drawRoute(ctx, s.points, still ? 1 : p);
      if (still || (arrived && blink(m))) frameDots(ctx, s.cta, 10);
    },
  });
  return <figure className="invitation-road" aria-hidden="true"><canvas ref={ref} /></figure>;
}

/** The footer wordmark parked at the kerb, lane dashes drifting underneath. */
export function KerbRoad() {
  const ref = useRef<HTMLCanvasElement>(null);
  useScene(ref, {
    animated: true,
    setup: () => null,
    draw(ctx, { w, h, t }) { horizontalRoad(ctx, w, h, t, { mid: CELL * 3 + 18, half: 18, speed: 40, shoulder: 26 }); },
  });
  return <canvas ref={ref} className="kerb-road" aria-hidden="true" />;
}
