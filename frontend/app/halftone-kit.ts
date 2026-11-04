// Drawing helpers shared by the road scenes. Everything is drawn on the hero's
// CELL grid with its ordered dither, so every section speaks the map's language.

import { CELL, fbm, routeTrail, type Point } from "./halftone-map";

export { CELL, fbm };
export type { Point };

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
export const bay = (c: number, r: number) => BAYER[(c & 3) + ((r & 3) << 2)];

export const INK = {
  light: "#d4d6ab",
  dense: "#eff0c8",
  shore: "#fffde8",
  accent: "#d3ee98",
  dim: "#4b5045",
  surface: "#1b1e1c",
  raised: "#232723",
};

/** 0 empty, 1 light, 2 dense, 3 shore, 4 accent, 5 dim. */
export type Level = 0 | 1 | 2 | 3 | 4 | 5;
const LEVELS: [string, number][] = [["", 0], [INK.light, 2.4], [INK.dense, 2.6], [INK.shore, 3], [INK.accent, 3], [INK.dim, 2.4]];

export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const wrap = (v: number, size: number) => ((v % size) + size) % size;

/** Dither a density into a level: light below 0.62, dense above, empty when the threshold wins. */
export const tone = (d: number, c: number, r: number): Level => (d > bay(c, r) ? (d > 0.62 ? 2 : 1) : 0);

/** Paint one dot per cell. `fn` returns the level for the cell at (x, y). */
export function field(ctx: CanvasRenderingContext2D, w: number, h: number, fn: (x: number, y: number, c: number, r: number) => Level, x0 = 0, y0 = 0) {
  const cols = Math.ceil(w / CELL), rows = Math.ceil(h / CELL);
  const buckets: number[][] = [[], [], [], [], [], []];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const v = fn(c * CELL, r * CELL, c, r);
    if (v) buckets[v].push(c * CELL + x0, r * CELL + y0);
  }
  for (let l = 1; l < 6; l++) {
    const [color, size] = LEVELS[l], cells = buckets[l];
    if (!cells.length) continue;
    ctx.fillStyle = color;
    for (let i = 0; i < cells.length; i += 2) ctx.fillRect(cells[i], cells[i + 1], size, size);
  }
}

export function dots(ctx: CanvasRenderingContext2D, points: Point[], color = INK.accent, size = 3) {
  ctx.fillStyle = color;
  for (const [x, y] of points) ctx.fillRect(x - size / 2, y - size / 2, size, size);
}

/** Draw a route up to `progress` with its square head; returns the head. */
export function drawRoute(ctx: CanvasRenderingContext2D, route: Point[], progress: number, color = INK.accent): Point {
  const { points, head } = routeTrail(route, clamp(progress), CELL);
  dots(ctx, points, color, 3);
  ctx.fillStyle = color;
  ctx.fillRect(head[0] - 4, head[1] - 4, 8, 8);
  return head;
}

/** The hero's destination marker: a dotted square around a point. */
export function arrival(ctx: CanvasRenderingContext2D, x: number, y: number, n = 3) {
  ctx.fillStyle = INK.accent;
  for (let i = -n; i <= n; i++) for (const j of [-n, n]) {
    ctx.fillRect(x + i * CELL - 1.5, y + j * CELL - 1.5, 3, 3);
    ctx.fillRect(x + j * CELL - 1.5, y + i * CELL - 1.5, 3, 3);
  }
}

export type Rect = { x: number; y: number; w: number; h: number };

/** The destination marker stretched around an element. */
export function frameDots(ctx: CanvasRenderingContext2D, r: Rect, pad = 10) {
  ctx.fillStyle = INK.accent;
  const x0 = r.x - pad, y0 = r.y - pad, x1 = r.x + r.w + pad, y1 = r.y + r.h + pad;
  for (let x = x0; x <= x1; x += CELL) { ctx.fillRect(x - 1.5, y0 - 1.5, 3, 3); ctx.fillRect(x - 1.5, y1 - 1.5, 3, 3); }
  for (let y = y0; y <= y1; y += CELL) { ctx.fillRect(x0 - 1.5, y - 1.5, 3, 3); ctx.fillRect(x1 - 1.5, y - 1.5, 3, 3); }
}

export const blink = (t: number) => Math.floor(t * 3) % 2 === 0;

/** A drive-then-hold loop: progress 0 to 1, then `arrived` for `hold` seconds. */
export function cycle(t: number, draw: number, hold: number) {
  const period = draw + hold, m = wrap(t, period);
  return { p: clamp(m / draw), arrived: m >= draw, k: Math.floor(t / period), m };
}

/** An element's box relative to another element. */
export function rel(el: Element, to: Element): Rect {
  const a = el.getBoundingClientRect(), b = to.getBoundingClientRect();
  return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height };
}

export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Polylines
export function bezier(p0: Point, p1: Point, p2: Point, p3: Point, n = 40): Point[] {
  const out: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return out;
}

export function lengths(points: Point[]) {
  const out = [0];
  for (let i = 1; i < points.length; i++) out.push(out[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  return out;
}

/** Distance from (x, y) to the polyline, and the distance along it to the nearest point. */
export function nearest(points: Point[], lens: number[], x: number, y: number): [number, number] {
  let best = Infinity, along = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1], [bx, by] = points[i], dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
    const t = l ? clamp(((x - ax) * dx + (y - ay) * dy) / l) : 0;
    const d = Math.hypot(ax + dx * t - x, ay + dy * t - y);
    if (d < best) { best = d; along = lens[i - 1] + t * (lens[i] - lens[i - 1]); }
  }
  return [best, along];
}

export function pointAt(points: Point[], lens: number[], d: number): Point {
  d = clamp(d, 0, lens[lens.length - 1]);
  let i = 1;
  while (i < lens.length - 1 && lens[i] < d) i++;
  const span = lens[i] - lens[i - 1] || 1, t = (d - lens[i - 1]) / span;
  return [points[i - 1][0] + (points[i][0] - points[i - 1][0]) * t, points[i - 1][1] + (points[i][1] - points[i - 1][1]) * t];
}

/** Points along the first `reach` pixels of a polyline, one per cell. */
export function along(points: Point[], lens: number[], reach: number): Point[] {
  const out: Point[] = [];
  for (let d = 0; d <= Math.min(reach, lens[lens.length - 1]); d += CELL) out.push(pointAt(points, lens, d));
  return out;
}

/** An axis-aligned block of city: streets every bw by bh pixels. */
export function city(x: number, y: number, c: number, r: number, o: { bw: number; bh: number; sw: number; ox?: number; oy?: number }): Level {
  const ox = o.ox ?? 0, oy = o.oy ?? 0;
  if (wrap(x + ox, o.bw) < o.sw || wrap(y + oy, o.bh) < o.sw) return 0;
  return tone(0.18 + 0.7 * fbm((x + ox) * 0.01 + 9, (y + oy) * 0.01), c, r);
}

/** A horizontal road: an asphalt gap through dithered shoulders, with scrolling centre dashes. */
export function horizontalRoad(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, o: { mid: number; half: number; speed?: number; shoulder?: number }) {
  const { mid, half, speed = 30, shoulder = 22 } = o, dash = 17;
  field(ctx, w, h, (x, y, c, r) => {
    const d = Math.abs(y + 1.5 - mid);
    if (d < half) return d < 2 && wrap(x + t * speed, dash * 2) < dash ? 1 : 0;
    const e = 1 - (d - half) / shoulder;
    if (e <= 0) return 0;
    return tone(0.95 * Math.sqrt(e) * (0.6 + 0.6 * fbm(x * 0.02, y * 0.05)), c, r);
  });
}

/** A road along any polyline: an asphalt gap, dashes, and shoulders that thin out. */
export function roadLevel(dist: number, at: number, c: number, r: number, x: number, y: number, o: { half: number; spread: number; dashes?: boolean }): Level {
  if (dist < o.half) return o.dashes !== false && dist < 1.8 && wrap(at, 26) < 13 ? 1 : 0;
  const e = clamp(1 - (dist - o.half) / o.spread);
  if (!e) return 0;
  return tone((0.3 + 0.6 * fbm(x * 0.012 + 2, y * 0.012)) * Math.sqrt(e), c, r);
}
