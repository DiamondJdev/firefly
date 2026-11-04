import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../app/capacity.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { PIS, SLOTS, place, ownerAt } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

const deploy = (ps, app) => {
  const spot = place(ps);
  return spot ? [...ps, { app, ...spot }] : null;
};

test("the scheduler sends each app to the least busy Pi", () => {
  let ps = deploy([], "a");
  assert.deepEqual([ps[0].pi, ps[0].slot], [0, 0]);
  ps = deploy(ps, "b");
  assert.equal(ps[1].pi, 1);
});

test("a full cluster has no room, and no slot is used twice", () => {
  let ps = [], next, i = 0;
  while ((next = deploy(ps, `app-${i++}`))) ps = next;
  assert.equal(ps.length, PIS * SLOTS);
  const keys = new Set(ps.map(p => `${p.pi}:${p.slot}`));
  assert.equal(keys.size, ps.length);
});

test("ownerAt finds the app in a slot", () => {
  const ps = deploy(deploy([], "a"), "b");
  assert.equal(ownerAt(ps, 1, 0).app, "b");
  assert.equal(ownerAt(ps, 1, 1), undefined);
});
