import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");

test("private Wi-Fi identities and images are ignored by Git", () => {
  for (const path of [".private/wifi-image.agekey", ".private/firefly-wifi.img.zst", "nix/test.img", "nix/test.agekey"]) {
    const result = spawnSync("git", ["check-ignore", "--no-index", "--quiet", path], { cwd: root });
    assert.equal(result.status, 0, `${path} must be ignored`);
  }
});

function runScript(script, args = [], environment = {}) {
  const directory = mkdtempSync(join(tmpdir(), "firefly-deploy-"));
  const log = join(directory, "commands");
  const remoteHome = join(directory, "remote");
  mkdirSync(join(remoteHome, "nix"), { recursive: true });
  writeFileSync(join(remoteHome, "nix", "wifi.nix"), "old credential fixture");
  mkdirSync(join(directory, "bin"));
  for (const command of ["docker", "ssh", "git", "sleep", "tar"]) {
    writeFileSync(join(directory, "bin", command), `#!/usr/bin/env bash
printf '%s %s\\n' '${command}' "$*" >> "$COMMAND_LOG"
case '${command}' in
  tar) exec /usr/bin/tar "$@" ;;
  git)
    case "$1" in
      rev-parse) echo abc1234 ;;
      status) printf '%s' "\${DIRTY:-}" ;;
      ls-files) printf 'nix/flake.nix\\0nix/pi.nix\\0' ;;
    esac ;;
  docker)
    case "$1" in
      image) echo "\${ARCH:-arm64}" ;;
      save) printf 'image bytes' ;;
    esac ;;
  ssh)
    if [[ "\${REMOTE_COPY:-0}" == 1 && "$*" == *tar*-x* ]]; then
      HOME="$REMOTE_HOME" /bin/bash -c "\${@: -1}"
      exit $?
    fi
    if [[ "$*" == *kubectl*apply* ]]; then cat >> "$COMMAND_LOG"; else cat >/dev/null; fi
    if [[ "$*" == *systemd-run* ]]; then exit "\${START_STATUS:-0}"; fi
    if [[ "$*" == *systemctl*show* ]]; then
      if [[ "\${POLL_FAILURE:-0}" == 1 && ! -f "$COMMAND_LOG.poll" ]]; then touch "$COMMAND_LOG.poll"; exit 255; fi
      printf '%s\\n' "\${SWITCH_STATUS:-0}"
    fi
    if [[ "$*" == *images*import* ]]; then exit "\${IMPORT_STATUS:-0}"; fi ;;
esac
`, { mode: 0o755 });
  }
  try {
    const result = spawnSync("bash", [join(root, script), ...args], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, ...environment, PATH: `${directory}/bin:${process.env.PATH}`, COMMAND_LOG: log, REMOTE_HOME: remoteHome },
      timeout: 10000,
    });
    const backups = readdirSync(remoteHome).filter(name => name.startsWith("nix.previous-"));
    return { ...result, remoteFiles: readdirSync(join(remoteHome, "nix")), backups, backupContent: backups.length ? readFileSync(join(remoteHome, backups[0], "wifi.nix"), "utf8") : null, log: (() => { try { return readFileSync(log, "utf8"); } catch { return ""; } })() };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("ship requires three arguments before running commands", () => {
  const result = runScript("deploy/ship.sh");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage:/);
  assert.equal(result.log, "");
});

test("ship builds arm64, imports, substitutes the image and forces a fresh rollout", () => {
  const result = runScript("deploy/ship.sh", ["landing", "frontend", "deploy/landing.yaml"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.log, /docker build --platform linux\/arm64 -t firefly\/landing:abc1234 frontend/);
  assert.match(result.log, /images import -/);
  assert.match(result.log, /kubectl apply -f -/);
  assert.match(result.log, /image: firefly\/landing:abc1234/);
  assert.doesNotMatch(result.log, /image: IMAGE/);
  assert.match(result.log, /rollout restart deploy\/landing/);
  assert.match(result.log, /rollout status deploy\/landing --timeout=120s/);
});

test("ship refuses a wrong architecture before SSH", () => {
  const result = runScript("deploy/ship.sh", ["landing", "frontend", "deploy/landing.yaml"], { ARCH: "amd64" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /expected arm64/);
  assert.doesNotMatch(result.log, /ssh /);
});

test("ship tags a dirty build and stops if import fails", () => {
  const result = runScript("deploy/ship.sh", ["landing", "frontend", "deploy/landing.yaml"], { DIRTY: " M frontend/app/page.tsx", IMPORT_STATUS: "1" });
  assert.notEqual(result.status, 0);
  assert.match(result.log, /firefly\/landing:abc1234-dirty-\d+/);
  assert.doesNotMatch(result.log, /kubectl apply/);
});

test("Nix deployment survives a lost SSH launch response and checks the service result", () => {
  const result = runScript("nix/deploy.sh", [], { START_STATUS: "255", POLL_FAILURE: "1" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.log, /git ls-files/);
  assert.match(result.log, /systemd-run/);
  assert.match(result.log, /--setenv=PATH=\/run\/current-system\/sw\/bin/);
  assert.match(result.log, /systemctl show/);
  assert.equal((result.log.match(/ssh .*systemctl show/g) || []).length, 2);
  assert.doesNotMatch(result.log, /--pipe|rm -rf/);
});

test("Nix deployment returns a failed switch's exit code", () => {
  const result = runScript("nix/deploy.sh", [], { SWITCH_STATUS: "1" });
  assert.equal(result.status, 1, result.stderr);
});

test("Nix deployment keeps stale plaintext out of the flake and preserves the old directory", () => {
  const result = runScript("nix/deploy.sh", [], { REMOTE_COPY: "1" });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.remoteFiles.sort(), ["flake.nix", "pi.nix"]);
  assert.equal(result.backups.length, 1);
  assert.equal(result.backupContent, "old credential fixture");
  assert.match(result.log, /tar --no-xattrs -c/);
});
