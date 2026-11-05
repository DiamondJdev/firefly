import test from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repository = resolve(import.meta.dirname, "../..");

function runBuild({ args = [], missingKey = false, existingOutput = false, trackedKey = false, ignored = true, dockerStatus = 0 } = {}) {
  const root = mkdtempSync(join(tmpdir(), "firefly-image-build-"));
  try {
    for (const directory of ["nix", "bin", ".private"]) mkdirSync(join(root, directory));
    copyFileSync(join(repository, "nix/build-image.sh"), join(root, "nix/build-image.sh"));
    writeFileSync(join(root, ".gitignore"), ignored ? readFileSync(join(repository, ".gitignore")) : "");
    if (!missingKey) writeFileSync(join(root, ".private/wifi-image.agekey"), "private identity fixture", { mode: 0o600 });
    if (existingOutput) writeFileSync(join(root, ".private/firefly-wifi.img.zst"), "keep this image");
    assert.equal(spawnSync("git", ["init", "--quiet"], { cwd: root }).status, 0);
    if (trackedKey) assert.equal(spawnSync("git", ["add", "--force", ".private/wifi-image.agekey"], { cwd: root }).status, 0);
    const log = join(root, "commands");
    writeFileSync(join(root, "bin/docker"), "#!/bin/bash\nprintf '%s\\n' \"$*\" >> \"$COMMAND_LOG\"\ncat >> \"$COMMAND_LOG\"\nexit \"$DOCKER_STATUS\"\n", { mode: 0o755 });
    const result = spawnSync("bash", ["nix/build-image.sh", ...args], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, PATH: `${root}/bin:${process.env.PATH}`, COMMAND_LOG: log, DOCKER_STATUS: String(dockerStatus) },
      timeout: 10000,
    });
    return { ...result, log: existsSync(log) ? readFileSync(log, "utf8") : "", output: existingOutput ? readFileSync(join(root, ".private/firefly-wifi.img.zst"), "utf8") : null };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("image build refuses unexpected arguments", () => {
  const result = runBuild({ args: ["unexpected"] });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage:/);
  assert.equal(result.log, "");
});

test("image build rejects missing or tracked keys and unignored artifacts before Docker", () => {
  for (const options of [{ missingKey: true }, { trackedKey: true }, { ignored: false }]) {
    const result = runBuild(options);
    assert.notEqual(result.status, 0);
    assert.equal(result.log, "");
  }
});

test("image build preserves an existing private output", () => {
  const result = runBuild({ existingOutput: true });
  assert.notEqual(result.status, 0);
  assert.equal(result.output, "keep this image");
  assert.equal(result.log, "");
});

test("image build uses pinned tools and keeps private contents out of the command stream", () => {
  const result = runBuild();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.log, /exec -i firefly-nix sh -se/);
  assert.match(result.log, /nix build --no-link --print-out-paths .\/nix#image-tools/);
  assert.match(result.log, /config.system.build.sdImage/);
  assert.match(result.log, /python3 nix\/prepare-image.py/);
  assert.doesNotMatch(result.log, /private identity fixture/);
});

test("image build reports Docker failure instead of claiming success", () => {
  const result = runBuild({ dockerStatus: 17 });
  assert.equal(result.status, 17);
  assert.doesNotMatch(result.stdout, /Flash/);
});
