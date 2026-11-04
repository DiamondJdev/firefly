import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../app/halftone-map.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const map = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const { CELL, DRIVE, BLOCK_A, BLOCK_B, ROAD_OFFSET, LAND, advanceDrive, classify, driveGoal, fromRoadGrid, pan, pathSlice, routeTrail } = map;

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

const onGrid = ([a, b]) => {
  const offA = ((a - ROAD_OFFSET) % BLOCK_A + BLOCK_A) % BLOCK_A, offB = ((b - ROAD_OFFSET) % BLOCK_B + BLOCK_B) % BLOCK_B;
  return Math.min(offA, BLOCK_A - offA) < 1e-6 && Math.min(offB, BLOCK_B - offB) < 1e-6;
};

test("the drive keeps going on the street grid and stays near its goal", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const random = seeded(seed), goal = [W * 0.66, H * 0.5];
    let drive = null;
    for (let travelled = 0; travelled < 20000; travelled += 3) {
      drive = advanceDrive(drive, random, { travelled, ahead: 240, behind: 380, goal, reach: 120 });
      const { corners, base } = drive;
      const length = corners.slice(1).reduce((s, p, i) => s + Math.abs(p[0] - corners[i][0]) + Math.abs(p[1] - corners[i][1]), 0);
      assert.ok(base + length >= travelled + 240, "streets ahead of the car");
      assert.ok(corners.length < 40, "old corners are dropped");
      const at = travelled - base;
      assert.ok(at >= 380 - 1e-6, "a full trail sits behind the car");
      const head = pathSlice(corners.map(([a, b]) => fromRoadGrid(a, b)), at - 380, at, CELL).head;
      assert.ok(Math.hypot(head[0] - goal[0], head[1] - goal[1]) < 300, `car wandered off at ${travelled}`);
    }
    const { corners } = drive;
    corners.forEach((p, i) => {
      assert.ok(onGrid(p), `corner ${i} off grid`);
      if (i) assert.ok((p[0] !== corners[i - 1][0]) !== (p[1] !== corners[i - 1][1]), `leg ${i} must follow one street`);
    });
  }
});

test("on any screen size the car and its trail stay in view", () => {
  for (const [w, h] of [[320, 280], [375, 320], [573, 850], [900, 700]]) {
    for (const seed of [1, 2, 3]) {
      const random = seeded(seed);
      let drive = null;
      for (let t = 0; t < 300; t += 1 / 30) {
        const { goal, reach } = driveGoal(w, h, t);
        const travelled = t * DRIVE.speed;
        drive = advanceDrive(drive, random, { travelled, ahead: DRIVE.ahead, behind: DRIVE.trail, goal, reach });
        const [px, py] = pan(t), at = travelled - drive.base;
        const local = drive.corners.map(([a, b]) => { const [x, y] = fromRoadGrid(a, b); return [x - px, y - py]; });
        for (const [x, y] of pathSlice(local, at - DRIVE.trail, at, CELL).points) {
          assert.ok(x >= 0 && x <= w && y >= 0 && y <= h, `${w}x${h} seed ${seed}: off screen at t=${t.toFixed(1)} (${x.toFixed(0)}, ${y.toFixed(0)})`);
        }
      }
    }
  }
});

test("a trail grows from the first corner to the last", () => {
  const route = [[0, 0], [100, 0], [100, 60], [30, 60]];
  const empty = routeTrail(route, 0, CELL), full = routeTrail(route, 1, CELL), half = routeTrail(route, 0.5, CELL);
  assert.deepEqual(empty.head, route[0]);
  const last = route[route.length - 1];
  assert.ok(Math.hypot(full.head[0] - last[0], full.head[1] - last[1]) < 1e-6);
  assert.ok(half.points.length > empty.points.length && half.points.length < full.points.length);
  for (let i = 1; i < full.points.length; i++) {
    const [x0, y0] = full.points[i - 1], [x1, y1] = full.points[i];
    assert.ok(Math.hypot(x1 - x0, y1 - y0) <= CELL + 1e-6);
  }
  const window = pathSlice(route, 50, 150, CELL);
  assert.deepEqual(window.points[0], [50, 0]);
  assert.deepEqual(window.head, [100, 50]);
});
