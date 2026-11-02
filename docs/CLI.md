# Firefly CLI Plan

## Goals

- Provide a Firebase/Vercel-like DX for students to deploy apps to the Firefly k3s cluster.
- Commands: `firefly login`, `firefly init`, `firefly upload`, `firefly deploy`, `firefly preview`, `firefly logs`, `firefly analytics`, `firefly env`, `firefly projects`.
- Works on macOS/Linux (ARM/AMD64), GitHub Actions friendly, minimal dependencies.

## Command Surface

- `firefly login` — Browser/OIDC device flow; saves token.
- `firefly init` — Create `.firefly.json`; detect framework (Next/React); set project; backend assigns namespace automatically; registers webhook optionally.
- `firefly projects list/create` — Manage projects; backend maps projects to the caller's assigned namespace automatically.
- `firefly upload` — Build (optional) and upload static assets or bundle; for static export cases; pushes to object storage or registry artifact.
- `firefly deploy` — Build image (docker/podman/buildx), tag, push to registry, notify backend to deploy prod.
- `firefly preview` — Same as deploy but marks preview (branch/PR) and gets preview URL.
- `firefly logs` — Stream app logs via backend (Loki tail) filtered by project/release/preview.
- `firefly analytics` — Fetch metrics (Prometheus/Grafana proxy) for requests, latency, errors per host; show sparkline summary.
- `firefly env` — `list/set/unset` env vars (writes to backend → k8s Secret); supports scopes prod/preview.
- `firefly status` — Show last deployment state, URL, image tag, HPA status.
- `firefly whoami` — Show logged-in user/namespace.
- `firefly doctor` — Check docker/buildx, registry reachability, backend health.

## Project Config (.firefly.json example)

```json
{
  "projectId": "portfolio",
  "student": "alice",
  "framework": "next",
  "build": "npm run build",
  "output": ".next",
  "registry": "registry.local/alice/portfolio",
  "domains": {
    "prod": "portfolio-alice.apps.school.dev",
    "preview": "{project}-{branch}-alice.apps.school.dev"
  }
}
```

## Deploy Flow (prod/preview)

1) `firefly deploy` / `firefly preview`:
   - Load config; detect git branch/commit.
   - Build app (optional `--no-build`).
   - Build image with buildx `linux/arm64`; tag `<registry>:<sha>`; push.
   - Call backend `POST /deployments` with image tag, git ref, preview flag.
   - Stream rollout status until ready; print URL.
2) CI usage: set `FIREFLY_TOKEN`; run same command; no interactive login.

## Upload Flow (static export)

- `firefly upload --static`:
  - Run `next export` or provided build.
  - Tar/gzip output and upload to backend object storage endpoint.
  - Backend updates CDN/ingress to serve static files (or uses nginx sidecar deployment).

## Preview Handling

- CLI sends branch/PR metadata; backend allocates host like `{project}-{branch}-student.apps.domain`.
- TTL/cleanup: backend auto-expires previews; CLI can `firefly preview --cleanup <branch>` to request deletion.

## Analytics Flow

- `firefly analytics --range 24h`:
  - Backend proxies Prometheus/Grafana prepared queries.
  - CLI renders table: requests, p50/p95/p99 latency, 4xx/5xx rates, bandwidth.
  - Optional `--json` for CI export.

## Logs Flow

- `firefly logs --follow --preview --branch feature-x --since 10m`:
  - Backend streams Loki tail filtered by project/preview branch.
  - Supports `--json` for machine parsing.

## Env Var Flow

- `firefly env set DATABASE_URL=... --scope prod`:
  - CLI sends value over HTTPS to backend; backend writes k8s Secret; returns version.
- `firefly env list --scope preview`:
  - Backend returns names and version metadata only (no values after write).
- Auto-load `.env` in project root when running `firefly env set/import` to prefill values locally; never uploads `.env` files themselves.
- `firefly upload` / `firefly deploy` must ignore `.env` files (add to `.dockerignore`/packager ignore) to prevent accidental secret leakage; only values sent via `firefly env` reach the backend.

## Error Handling & UX

- Clear exit codes; retries on transient network; suggest `firefly doctor`.
- Warn if not on `linux/arm64` buildx; allow `--platform` override.
- Detect missing docker/buildx and suggest install steps.
- Mask secrets in logs; redaction in error output.

## Packaging & Distribution

- Build with Rust `--release`; target `aarch64-unknown-linux-gnu`, `x86_64-unknown-linux-gnu`, `aarch64-apple-darwin`, `x86_64-apple-darwin`; prefer MUSL for Linux if libc variance is an issue.
- Publish GitHub Releases with static binaries + SHA256 checksums and optional detached signatures.
- Homebrew tap (Darwin + Linuxbrew) for easy install; add shell completions (bash/zsh/fish) on install.
- Optional `cargo install firefly-cli` or `cargo-binstall firefly-cli` for developers; students download release binaries.
- Auto-update check (optional) with opt-out env `FIREFLY_NO_UPDATE_CHECK`.

## Security Considerations

- Tokens stored with 0600 perms; support env token override for CI.
- No k8s creds stored locally; all operations via backend with scoped SA.
- Validate registry host against allowlist from backend.
- Enforce HTTPS; verify TLS.

## Telemetry (optional)

- Enabled by default to improve reliability; users can opt out via `firefly telemetry off` or env `FIREFLY_TELEMETRY=0`.
- Collected (anonymized): command name, exit code, duration bucket, platform/arch, CLI version, backend region, whether running in CI, error category (no payload data or flags/args content), and a coarse project type (next/react/static) inferred locally.
- Not collected: source code, env var names/values, file paths, git remotes/branches/commits, image tags, hostnames, or URLs.
- Transport: batched over HTTPS to telemetry endpoint with retry + backoff; drop on failure (no blocking deploys).
- Transparency: `firefly telemetry status` to show current opt state; `firefly telemetry sample` to print the exact payload before sending.
