import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../app/halftone-map.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const map = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const { CELL, BLOCK_A, BLOCK_B, ROAD_OFFSET, LAND, classify, makeRoute, routeTrail, toRoadGrid } = map;

function seeded(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

const W = 700, H = 640;
const count = (cells, kind) => cells.reduce((n, c) => n + (c === kind ? 1 : 0), 0);

test("the map holds water, halftone land, and a traced shore", () => {
  const cells = classify(W, H, 0);
  assert.equal(cells.length, Math.ceil(W / CELL) * Math.ceil(H / CELL));
  for (const c of cells) assert.ok(Object.values(LAND).includes(c));
  assert.ok(count(cells, LAND.water) > cells.length * 0.15, "needs open water");
  assert.ok(count(cells, LAND.shore) > 50, "needs a coastline");
  assert.ok(count(cells, LAND.light) + count(cells, LAND.dense) > cells.length * 0.2, "needs dithered land");
});

test("panning moves the streets but keeps the coast in frame", () => {
  const start = classify(W, H, 0), later = classify(W, H, 60);
  const landShare = cells => 1 - count(cells, LAND.water) / cells.length;
  assert.ok(Math.abs(landShare(start) - landShare(later)) < 0.12);
  let changed = 0;
  for (let i = 0; i < start.length; i++) if (start[i] !== later[i]) changed++;
  assert.ok(changed > start.length * 0.1, "map should move");
});

test("routes start in view and follow the street grid", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const route = makeRoute(seeded(seed), W, H, 12);
    assert.ok(route.length >= 4);
    const [first] = routeTrail(route, 0, CELL).points;
    const [px, py] = map.pan(12);
    assert.ok(first[0] - px >= 0 && first[0] - px <= W && first[1] - py >= 0 && first[1] - py <= H);
    for (let i = 0; i < route.length; i++) {
      const [a, b] = toRoadGrid(route[i][0], route[i][1]);
      const offA = ((a - ROAD_OFFSET) % BLOCK_A + BLOCK_A) % BLOCK_A, offB = ((b - ROAD_OFFSET) % BLOCK_B + BLOCK_B) % BLOCK_B;
      assert.ok(Math.min(offA, BLOCK_A - offA) < 1e-6 && Math.min(offB, BLOCK_B - offB) < 1e-6, `corner ${i} off grid`);
      if (i === 0) continue;
      const [pa, pb] = toRoadGrid(route[i - 1][0], route[i - 1][1]);
      const movedA = Math.abs(a - pa) > 1e-6, movedB = Math.abs(b - pb) > 1e-6;
      assert.ok(movedA !== movedB, `leg ${i} must follow one street`);
    }
  }
});

test("a trail grows from the first corner to the last", () => {
  const route = makeRoute(seeded(9), W, H, 0);
  const empty = routeTrail(route, 0, CELL), full = routeTrail(route, 1, CELL), half = routeTrail(route, 0.5, CELL);
  assert.deepEqual(empty.head, route[0]);
  const last = route[route.length - 1];
  assert.ok(Math.hypot(full.head[0] - last[0], full.head[1] - last[1]) < 1e-6);
  assert.ok(half.points.length > empty.points.length && half.points.length < full.points.length);
  for (let i = 1; i < full.points.length; i++) {
    const [x0, y0] = full.points[i - 1], [x1, y1] = full.points[i];
    assert.ok(Math.hypot(x1 - x0, y1 - y0) <= CELL + 1e-6);
  }
});
