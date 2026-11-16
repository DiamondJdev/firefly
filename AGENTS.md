# AGENTS.md

Phoenix Firefly is a self-hosted platform-as-a-service: push a Dockerfile, get a live HTTPS app at `<app>.diamondjdev.me`. The target is a k3s cluster of five Raspberry Pi 5s and two desktops, defined in one NixOS flake, with a Rust operator and a TypeScript API, dashboard and CLI. v1 hosts only the owner's projects.

The project is in its design phase. What runs today:

- One Pi 5 (`firefly-pi`) running NixOS, single-node k3s, Tailscale, and a Cloudflare Tunnel that sends every `*.diamondjdev.me` request to Traefik.
- The landing page (`frontend/`), shipped to that Pi as an arm64 image.
- A NestJS backend template (`backend/`), not deployed. It is the seed for the platform's REST API and GitHub webhooks.

Everything else in the README and `docs/architecture.md` (operator, waker, builder, registry, previews, dashboard, CLI) is planned, not built.

## Documentation map

Read the doc for the area you touch before changing it. When two docs conflict, the higher row wins.

| Doc | What it covers | Trust |
|---|---|---|
| `README.md`, section "Single-Pi workflow" | Secrets, Wi-Fi image, deploys, tunnel, public URLs, test commands | Current. The source of truth for what runs. |
| `docs/architecture.md` | Target design, hardware roles, build pipeline, decision log, open questions | Target. Wins over every doc below. |
| Rest of `README.md` | Public pitch of the target design | Target |
| `docs/CLI.md` | CLI command surface | Older draft. Only the command list is current; its student/school model, domains and Loki/Prometheus stack are superseded by architecture.md. |
| `docs/superpowers/plans/*.md` | Step-by-step implementation plans | History and intent. A plan is not proof the work landed; check the code. |
| `backend/README.md`, `backend/LOGGING.md` | Backend template features, API, logging service | Template-era. It says SQLite and port 8080; the code uses Postgres and `PORT` (default 5200). |
| `frontend/README.md`, `frontend/DESIGN-AUDIT.md` | Landing page commands and design rules | Current for `frontend/` |

Naming: the CLI is `firefly`, with a `pf` alias. `pi` in architecture.md is stale.

## Where things live

| Path | What | Commands (run from that directory) |
|---|---|---|
| `nix/flake.nix` | Flake. `firefly-pi` is the live config (with tunnel); `firefly-pi-image` is the flashable image (no tunnel). `image-tools` is the test toolbox. | |
| `nix/pi.nix` | Node config: Wi-Fi via sops, SSH, Avahi, Tailscale, k3s | |
| `nix/tunnel.nix` | `cloudflared` wildcard tunnel, live Pi only | |
| `nix/.sops.yaml`, `nix/secrets.yaml`, `nix/tunnel-credentials.json` | sops recipients and encrypted secrets | |
| `nix/deploy.sh` | Copies tracked `nix/` files to the Pi and runs `nixos-rebuild switch` | |
| `nix/build-image.sh`, `nix/prepare-image.py` | Build the private reusable Wi-Fi SD image into `.private/` | |
| `nix/tests/` | Python unittest (runs in the `firefly-nix` builder container) and Node script tests | See README "Reusable Wi-Fi image" |
| `deploy/ship.sh`, `deploy/landing.yaml` | Build an arm64 image, import it into the Pi's containerd, apply the manifest | `node --test deploy/scripts.test.mjs nix/tests/build-image.test.mjs` (repo root) |
| `frontend/app/` | Next.js 16 landing page, one route (`page.tsx`), npm | `npm run typecheck`, `npm test`, `npm run build` |
| `backend/src/modules/` | NestJS 11: `auth`, `users`, `roles`, `jwt`, `cache` (Upstash), `db` (TypeORM services), `core` (entities, guards, logging, health) | `pnpm test`; `pnpm test:e2e` needs Postgres from `docker compose up postgres` |
| `CLI/` | Empty placeholder for the `firefly` CLI | |

The planned `operator/`, `waker/`, `builder/`, `api/`, `dashboard/` and `templates/` directories do not exist yet.

Test notes:

- `frontend/scripts/page.test.mjs` fetches a running server at `http://127.0.0.1:3000` (override with `TEST_URL`). Start `npm run dev` or `npm start` first.
- `backend/Dockerfile` copies `package-lock.json`, but the backend only has `pnpm-lock.yaml`, so the image build currently fails. `docs/superpowers/plans/2026-11-13-github-actions-ci.md` plans the fix.
- Run Nix evaluation and image tests inside the `firefly-nix` builder container, as the README shows. The Mac host has no Linux Nix.

## What not to do

Live infrastructure:

- Ask first before running anything that reaches `firefly-pi` or Cloudflare: `nix/deploy.sh`, `deploy/ship.sh`, `ssh firefly-pi`, `cloudflared tunnel ...`, `sops updatekeys`. Approval covers one run.
- Never flash `firefly-pi`. Only `bash nix/build-image.sh` makes a flashable image, from `firefly-pi-image`. A fresh card can't decrypt the tunnel secret, and sops-nix then installs no secrets, Wi-Fi included.
- Deploy `firefly-pi` to one Pi only. A second Pi on the same tunnel takes a share of public traffic on a separate cluster.
- Before deploying to a reflashed card, rewrap both secret files for its new host key (README, "Before the first deploy to a reflashed card").

Secrets:

- Never read, print, or `git add -f` anything in `.private/`, `*.agekey`, `*.img`, `*.img.zst`, or `.env`.
- Put no new secrets in `nix/secrets.yaml`. Every holder of the reusable image can decrypt it. New secrets get their own file and a `creation_rules` entry without the `wifi-image` recipient.
- Never commit plaintext credentials or decrypted sops output. Edit secrets with `sops`, as the README shows.

Nix:

- Keep `nix/flake.lock`'s `nixos-raspberrypi/nixpkgs` pin. Other inputs must `follows` it, or the binary cache misses and the Pi kernel compiles locally.
- `git add` new Nix files before deploying. `deploy.sh` copies tracked files only.

Apps and URLs:

- Keep public hostnames one label deep (`app.diamondjdev.me`, `app-pr-3.diamondjdev.me`). The free certificate does not cover `a.b.diamondjdev.me`.
- Ship arm64 images only. `ship.sh` refuses anything else, and there is no registry yet.

Code:

- `pnpm lint` in `backend/` runs `eslint --fix` and rewrites files. Expect the diff, or call `eslint` without `--fix` to check only.
- Keep the authored frontend free of em and en dashes; `page.test.mjs` fails on them.
- Don't treat architecture.md features as existing. Check the tree first.

## Keeping this file current

Update AGENTS.md (and CLAUDE.md for Claude-only rules) in the same change as the work that makes it wrong. Don't wait to be asked. Update it when you:

- add, move, rename or delete a top-level directory, script, config file or doc listed above
- change a build, test, lint or deploy command, or a package manager
- build something the intro calls planned, or fix a gap listed under "Test notes"
- learn a new "don't" the hard way: a failed deploy, a broken secret, a reverted change
- find a line here that no longer matches the code

Keep entries short and link to the doc that holds the detail. Delete lines that stop being true; don't mark them stale. Before finishing a task, reread the sections your change touches and confirm every path and command still exists. Mention the AGENTS.md edit in your summary to the user.
