// Halftone street map for the hero. Land is ordered (Bayer) dither, streets
// are the gaps, the coast is traced bright. The map slides along its coast,
// so the shoreline holds still while the streets move past.

export const CELL = 5;
export const BLOCK_A = 46;
export const BLOCK_B = 38;
export const ROAD_OFFSET = 3;
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
export const fromRoadGrid = (a: number, b: number): Point => [T[0] * a + N[0] * b, T[1] * a + N[1] * b];
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

/** An endless drive. Corners are in road-grid coordinates; `base` is the distance already dropped behind. */
export type Drive = { corners: Point[]; base: number };

const legLength = (p: Point, q: Point) => Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]);
const snap = (v: number, block: number) => Math.round(v / block) * block + ROAD_OFFSET;

// A point within `reach` of the goal on both street axes sits at most this far from it on screen.
const REACH_TO_SCREEN = Math.max(Math.abs(N[0]) + Math.abs(T[0]), Math.abs(N[1]) + Math.abs(T[1]));
const EDGE_MARGIN = 12;
/** The hero car: pixels per second, trail kept behind it, and streets laid ahead of it. */
export const DRIVE = { speed: 55, trail: 260, ahead: 160 };
// Streets are laid this many seconds before they leave the trail, and the map pans meanwhile,
// so they drift on screen along -T (up and to the right) by up to this much.
const DRIFT = ((DRIVE.trail + DRIVE.ahead) / DRIVE.speed) * PAN_SPEED;

/** Where the car roams on a w × h view at time t, and how far it may wander, so it never leaves the view. */
export function driveGoal(w: number, h: number, t: number): { goal: Point; reach: number } {
  const reach = Math.max(BLOCK_A / 2, Math.min(w, h) * 0.24);
  const span = reach * REACH_TO_SCREEN + EDGE_MARGIN;
  // The land side of the coast, above the fold on tall views, with room for the drift.
  const x = (Math.max(w * 0.45, span) + w - span + T[0] * DRIFT) / 2;
  const y = (span + T[1] * DRIFT + Math.min(h - span, h * 0.6)) / 2;
  const [px, py] = pan(t);
  return { goal: [x + px, y + py], reach };
}

type DriveStep = { travelled: number; ahead: number; behind: number; goal: Point; reach: number };

/**
 * Keep the drive's streets at least `ahead` past `travelled`, staying within `reach` of `goal`
 * (world coordinates) on both street axes, and drop corners more than `behind` back. Returns a new drive.
 */
export function advanceDrive(drive: Drive | null, random: () => number, { travelled, ahead, behind, goal, reach }: DriveStep): Drive {
  const [ga, gb] = toRoadGrid(goal[0], goal[1]);
  let corners = drive?.corners ?? [[snap(ga, BLOCK_A), snap(gb, BLOCK_B)] as Point];
  // A new drive starts with a full trail already behind the car.
  let base = drive?.base ?? travelled - behind;
  let length = corners.slice(1).reduce((sum, p, i) => sum + legLength(corners[i], p), 0);
  while (base + length < travelled + ahead) {
    const last = corners[corners.length - 1], prev = corners[corners.length - 2];
    // Alternate streets: after a leg along a, the next runs along b.
    const axis = prev && prev[0] !== last[0] ? 1 : 0;
    const block = axis === 0 ? BLOCK_A : BLOCK_B, from = last[axis] - (axis === 0 ? ga : gb);
    const blocks = 1 + Math.floor(random() * 2), sign = random() < 0.5 ? -1 : 1;
    // Random turn, but never past `reach`; if both ways are too far, one block back toward the goal.
    const options = [sign * blocks, -sign * blocks].filter(n => Math.abs(from + n * block) <= reach);
    const step = (options[0] ?? (from > 0 ? -1 : 1)) * block;
    const next: Point = axis === 0 ? [last[0] + step, last[1]] : [last[0], last[1] + step];
    corners = [...corners, next];
    length += Math.abs(step);
  }
  while (corners.length > 2 && base + legLength(corners[0], corners[1]) < travelled - behind) {
    base += legLength(corners[0], corners[1]);
    corners = corners.slice(1);
  }
  return { corners, base };
}

/** Points along the route between distances `from` and `to`, at most `step` apart, ending at the head. */
export function pathSlice(route: Point[], from: number, to: number, step: number) {
  const points: Point[] = [];
  let head: Point = route[0], walked = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const [x0, y0] = route[i], [x1, y1] = route[i + 1], len = Math.hypot(x1 - x0, y1 - y0);
    const start = Math.max(from, walked) - walked, end = Math.min(to, walked + len) - walked;
    walked += len;
    if (end <= start || len === 0) continue;
    const at = (d: number): Point => [x0 + ((x1 - x0) * d) / len, y0 + ((y1 - y0) * d) / len];
    for (let d = points.length && start === 0 ? step : start; d < end; d += step) points.push(at(d));
    head = at(end);
    points.push(head);
  }
  return { points: points.length ? points : [route[0]], head };
}

/** Points along the route up to `progress` (0 to 1), at most `step` apart, ending at the head. */
export function routeTrail(route: Point[], progress: number, step: number) {
  const total = route.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - route[i][0], p[1] - route[i][1]), 0);
  return pathSlice(route, 0, Math.min(1, Math.max(0, progress)) * total, step);
}
