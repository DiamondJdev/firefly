// Halftone street map for the hero. Land is ordered (Bayer) dither, streets
// are the gaps, the coast is traced bright. The map slides along its coast,
// so the shoreline holds still while the streets move past.

export const CELL = 5;
export const BLOCK_A = 46;
export const BLOCK_B = 38;
export const ROAD_OFFSET = 3;
export const ROUTE_DRAW = 4;
export const ROUTE_HOLD = 2.2;
const PAN_SPEED = 9;

export const LAND = { water: 0, blank: 1, light: 2, dense: 3, shore: 4 } as const;
export type Point = [number, number];

// Inland normal and coast tangent: the street grid is aligned to them.
const COAST_ANGLE = Math.atan2(1, 2);
const N: Point = [Math.cos(COAST_ANGLE), Math.sin(COAST_ANGLE)];
const T: Point = [-N[1], N[0]];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);

export function hash(x: number, y: number) {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function noise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export const fbm = (x: number, y: number) =>
  0.6 * noise(x, y) + 0.3 * noise(x * 2.1 + 5.2, y * 2.1 + 1.3) + 0.1 * noise(x * 4.3 + 9.1, y * 4.3);

export const pan = (t: number): Point => [T[0] * t * PAN_SPEED, T[1] * t * PAN_SPEED];
export const toRoadGrid = (x: number, y: number): Point => [x * T[0] + y * T[1], x * N[0] + y * N[1]];
const fromRoadGrid = (a: number, b: number): Point => [T[0] * a + N[0] * b, T[1] * a + N[1] * b];
const wrap = (v: number, size: number) => ((v % size) + size) % size;

/** One LAND code per CELL-sized cell, row-major, for a w × h view at time t. */
export function classify(w: number, h: number, t: number): Uint8Array {
  const cols = Math.ceil(w / CELL), rows = Math.ceil(h / CELL);
  const coast = N[0] * w * 0.3 + N[1] * h * 0.5;
  const [px, py] = pan(t);
  const land = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = c * CELL, y = r * CELL, wx = x + px, wy = y + py;
    const inland = x * N[0] + y * N[1];
    let isLand = inland + (fbm(wx * 0.006, wy * 0.006) - 0.5) * 170 > coast;
    if (!isLand && inland > coast - 320 && fbm(wx * 0.016 + 40, wy * 0.016) > 0.7) isLand = true;
    land[r * cols + c] = isLand ? 1 : 0;
  }
  const cells = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const k = r * cols + c;
    if (!land[k]) continue;
    const onShore = (c > 0 && !land[k - 1]) || (r > 0 && !land[k - cols]) || (c < cols - 1 && !land[k + 1]);
    if (onShore) { cells[k] = LAND.shore; continue; }
    const x = c * CELL + px, y = r * CELL + py;
    const [a, b] = toRoadGrid(x, y);
    const majorA = Math.floor(a / BLOCK_A) % 4 === 0, majorB = Math.floor(b / BLOCK_B) % 3 === 0;
    const onRoad = wrap(a, BLOCK_A) < (majorA ? 10 : 5) || wrap(b, BLOCK_B) < (majorB ? 10 : 5);
    const density = 0.2 + 0.7 * fbm(x * 0.01 + 9, y * 0.01);
    if (onRoad || density <= BAYER[(c & 3) + (r & 3) * 4]) cells[k] = LAND.blank;
    else cells[k] = density > 0.62 ? LAND.dense : LAND.light;
  }
  return cells;
}

/** A route in world coordinates: starts in the upper right of the view, then alternates streets. */
export function makeRoute(random: () => number, w: number, h: number, t: number): Point[] {
  const [px, py] = pan(t);
  let [a, b] = toRoadGrid(w * (0.62 + random() * 0.25) + px, h * (0.08 + random() * 0.2) + py);
  a = Math.round(a / BLOCK_A) * BLOCK_A + ROAD_OFFSET;
  b = Math.round(b / BLOCK_B) * BLOCK_B + ROAD_OFFSET;
  const corners: Point[] = [[a, b]];
  for (let i = 0; i < 6; i++) {
    if (i % 2 === 0) a += BLOCK_A * (1 + Math.floor(random() * 3));
    else b += BLOCK_B * (random() < 0.3 ? -1 : 1) * (1 + Math.floor(random() * 2));
    corners.push([a, b]);
  }
  return corners.map(([ca, cb]) => fromRoadGrid(ca, cb));
}

/** Points along the route up to `progress` (0 to 1), at most `step` apart, ending at the head. */
export function routeTrail(route: Point[], progress: number, step: number) {
  const lengths = route.slice(1).map((p, i) => Math.hypot(p[0] - route[i][0], p[1] - route[i][1]));
  let left = Math.min(1, Math.max(0, progress)) * lengths.reduce((sum, l) => sum + l, 0);
  const points: Point[] = [route[0]];
  let head: Point = route[0];
  for (let i = 0; i < lengths.length && left > 0; i++) {
    const [x0, y0] = route[i], [x1, y1] = route[i + 1], run = Math.min(left, lengths[i]);
    const at = (d: number): Point => [x0 + ((x1 - x0) * d) / lengths[i], y0 + ((y1 - y0) * d) / lengths[i]];
    for (let d = step; d < run; d += step) points.push(at(d));
    head = at(run);
    points.push(head);
    left -= run;
  }
  return { points, head };
}
