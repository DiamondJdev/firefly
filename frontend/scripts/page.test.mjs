import test from "node:test";
import assert from "node:assert/strict";

const origin = process.env.TEST_URL || "http://127.0.0.1:3000";

test("the public page has nine sections, valid internal links, and no forbidden dashes", async () => {
  const response = await fetch(origin);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.equal((html.match(/<section\b/g) || []).length, 8);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /class="hero-map"/);
  assert.doesNotMatch(html, /vortex-reference\.png/);
  assert.doesNotMatch(html, /\/images\/firefly\.png/);
  const visible = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");
  assert.doesNotMatch(visible, /[\u2013\u2014]/u);
  for (const [, anchor] of visible.matchAll(/href="#([^"]+)"/g)) {
    assert.ok(html.includes(`id="${anchor}"`), `Missing anchor: ${anchor}`);
  }
});

test("the blueprint, font, and section images are available", async () => {
  for (const path of ["/blueprint.txt", "/images/wing.png", "/images/board.png", "/fonts/geist-latin.woff2"]) {
    const response = await fetch(new URL(path, origin));
    assert.equal(response.status, 200, path);
    assert.ok((await response.arrayBuffer()).byteLength > 0, `${path} is empty`);
  }
  const text = await (await fetch(new URL("/blueprint.txt", origin))).text();
  assert.doesNotMatch(text, /[\u2013\u2014]/u);
  assert.match(text, /platform is in development/);
});
