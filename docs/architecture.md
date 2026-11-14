# Architecture

## Overview

Phoenix Firefly is a self-hosted PaaS on 5 Raspberry Pi 5s and two desktops. It turns a Dockerfile repo into a live HTTPS app with one push. v1 hosts only Cameron's own projects. The design keeps the door open for portfolio visitors later.

**Goals**

- Deploy a personal project in under a minute from `git push`, the CLI or the dashboard
- Use every machine: Pis serve, desktops build, nothing sits idle by design
- Be a strong portfolio piece: a Rust Kubernetes operator, a TS control plane, and a NixOS-defined cluster

**v1 scope:** static sites, single-container apps and multi-container projects (compose-style, including their own database containers), auto subdomains, per-branch previews.

**Non-goals for v1:** outside users, billing, microVM isolation, managed databases, custom domains, scale-to-zero for production apps.

## Hardware roles

Each machine gets one job matched to its uptime. The rule: nothing that holds state or quorum runs on a machine that goes offline.

| Node                   | Arch  | Role                                                                               | k3s labels / taints                            | Serves apps?    |
| ---------------------- | ----- | ---------------------------------------------------------------------------------- | ---------------------------------------------- | --------------- |
| Pi #1–3 (8GB)          | arm64 | k3s servers with embedded etcd (quorum survives 1 loss) + light workers            | `role=control`, `serve=true`                   | Yes, small apps |
| Pi #4 (8GB)            | arm64 | Worker; NVMe HAT; stateful services                                                | `serve=true`, `storage=nvme`                   | Yes             |
| Pi #5 (8GB)            | arm64 | Dedicated native arm64 builder (fallback path)                                     | `role=builder`, taint `builder:NoSchedule`     | No              |
| New desktop            | amd64 | Always-on heavy worker, primary cross-compile builder, registry, stateful services | `serve=true`, `builder=true`, `storage=nvme`   | Yes             |
| Main desktop (9800X3D) | amd64 | Opportunistic builder only; joins when booted into NixOS                           | `builder=true`, taint `preemptible:NoSchedule` | Never           |

**Prereqs:** NVMe HATs on at least Pi 1–4 (SD cards fail under etcd and database writes). Use the official 27W PSU and active coolers. Wired gigabit to every node through one switch.

**Main desktop lifecycle:** a NixOS systemd unit uncordons it on boot and runs `kubectl drain` before shutdown or reboot. In-flight builds are re-queued, not lost.

## Architecture

k3s does scheduling. Cameron's code is the PaaS layer on top: a TS API, dashboard and CLI that write `App` resources, and a Rust operator that turns them into running workloads.

![[Screenshot 2026-11-02 at 2.25.34 PM.png]]

The operator is the heart of the system: every front door converges on an `App` resource, and the operator creates the Kubernetes objects, then deploys onto app pods. k3s components (Traefik, CoreDNS, local-path provisioner) are used as bundled; ServiceLB is disabled since the tunnel handles ingress.

## Build pipeline

Every deploy compiles once and produces a multi-arch image when a desktop is available. Pis only build when they must.

![[Screenshot 2026-11-02 at 2.25.13 PM.png]]

- **Detection:** the Rust build orchestrator parses the Dockerfile (`dockerfile-parser` crate) and checks that build stages use `FROM --platform=$BUILDPLATFORM`. It does not grep for the string.
- **Builders:** BuildKit runs in k3s through the buildx Kubernetes driver, with a node selector per platform. The new desktop is the primary builder; the 9800X3D adds capacity when it's booted into NixOS.
- **Cache:** `--cache-to/--cache-from type=registry` against an in-cluster Zot registry on the new desktop, so rebuilds are incremental and images never leave the LAN.
- **Deferred amd64 leg:** an arm64-only image gets `arch=arm64` placement from the operator. When a desktop returns, a queued job builds amd64 and merges both into one manifest list with `docker buildx imagetools create`. The operator then lifts the pin.
- **Template:** `pi init` writes a cross-compile Dockerfile template per stack (static, Node, Python, Rust) so the default path is the fast one.

## Apps, services and storage

A project is one `App` custom resource holding one or more services. Multi-container projects with their own database containers are supported. A project config file declares them, a subset of `docker-compose.yml`, so local dev and production match.

**How the Rust operator maps a project**

- Project → its own namespace, with a NetworkPolicy that blocks traffic from other projects; outbound internet allowed
- Stateless service → Deployment + Service
- Service with a volume (e.g. `postgres`) → StatefulSet + local-path PVC, scheduled only on `storage=nvme` nodes, never the main desktop
- Exactly one service is marked `public` → gets the subdomain route; others are reachable only inside the namespace by service name (`db:5432`)
- External databases (Neon, Supabase, etc.) always work, since outbound internet is open

**Supported compose subset (v1):** `build` (Dockerfile path), `image`, `environment`, `env_file`, `ports` (only to mark the public port), `volumes` (named volumes only), `depends_on` (start order), `healthcheck`. Anything else fails validation with a clear error rather than being silently ignored.

**Backups:** a nightly restic job snapshots every PVC to the NAS Pi (6TB drive). Databases get a pre-backup dump hook (`pg_dump`, `redis-cli SAVE`) so snapshots are consistent.

**Size tiers** (requests = limits, so the scheduler packs predictably):

| Tier | Memory | CPU | Typical use |
| --- | --- | --- | --- |
| nano | 128MB | 0.1 | Static sites, tiny APIs |
| small | 512MB | 0.5 | Node/Python apps, Redis |
| large | 2GB | 1.0 | Postgres, heavier apps |

Tiers are set per service. A project's total is the sum, which maps cleanly to pricing if the platform opens up later.

## Deploy flows and previews

Three front doors, one backend. The git push, CLI and dashboard paths all end in the TS API writing an `App` resource. The operator does the rest, so no path has special behavior.

1. **git push:** a GitHub App sends push and pull-request webhooks through the Cloudflare Tunnel to the API. The API queues a build and posts a commit status plus the preview URL back to the PR.
2. **CLI:** `pi deploy` from a project folder uploads the source tarball (no GitHub required), streams build logs, and prints the URL. It's scriptable, so coding agents can drive it.
3. **Dashboard:** the same API calls with a UI for status, logs, env vars, tiers and redeploys.

**URLs**

- Production: `<app>.diamondjdev.me` through a wildcard DNS record on the tunnel
- Previews: `<app>-pr-<n>.diamondjdev.me`, or `<app>-<branch>.diamondjdev.me` for CLI deploys
- Hostnames stay one label deep: the free Universal SSL certificate covers `*.diamondjdev.me` only
- Cloudflare terminates TLS at the edge; inside the cluster, Traefik (bundled with k3s) routes by hostname

**Preview lifecycle**

- Created on PR open or push; gets fresh copies of any database services (empty or seeded), never production data
- Sleeps after an idle window: the whole project scales to zero together, so an app never wakes without its database
- Wakes on request: a small Rust "waker" in front of sleeping hostnames holds the request, scales the project up, and forwards when it's healthy
- Deleted when the PR closes, or after a **hard 7-day time-to-live**, whichever comes first (PVCs included)

## Security, secrets and observability

The home network is never exposed directly: no open ports, and the home IP stays hidden behind Cloudflare.

**Network**

- `cloudflared` runs as a NixOS service on the one Pi and only dials out. It becomes a 2-replica Deployment once a second Pi joins
- Put the cluster on its own VLAN or subnet, firewalled from personal devices. This matters most once outside users arrive
- Admin access to nodes over Tailscale; SSH keys only, defined in the NixOS flake

**Access:** the dashboard and API sit behind Cloudflare Access (GitHub login, allow-list of 1). The webhook endpoint is the only bypass, verified by the GitHub App's webhook signature. The CLI authenticates with a Cloudflare Access service token.

**Secrets:** stored as Kubernetes Secrets with k3s `--secrets-encryption` enabled. The encryption key is provisioned by the NixOS flake (via sops-nix) so it never lives in git in plaintext. Env vars are set through the CLI and dashboard and are never baked into images.

**Observability**

- Logs: Vector on every node → VictoriaLogs; `pi logs <app> -f` and a live dashboard tail
- Metrics: VictoriaMetrics + kube-state-metrics + node-exporter; per-app CPU/RAM vs tier limit in the dashboard
- Node health: Pi SoC temperature and throttling from `vcgencmd`; desktop wattage via a smart plug or `turbostat`. Shown as a cluster power and cost panel
- VictoriaMetrics/Logs chosen over Prometheus/Loki for a much lighter footprint on Pis

## Decision log

Decided 2 Nov 2026. Revisit any row by changing it here.

| Area | Decision | Main alternative rejected | Why |
| --- | --- | --- | --- |
| Tenants | Just Cameron in v1 | Public sign-up | Avoids microVM isolation, abuse handling and billing for now |
| Workloads | Static sites + containers + multi-container projects | Managed databases | Compose-style DB containers cover the need with far less to build |
| Goal | Learning + portfolio | Off-the-shelf (Coolify) | Building the operator is the point |
| Ingress | Cloudflare Tunnel | VPS edge + WireGuard | No open ports, hidden IP, free DDoS protection |
| Orchestration | k3s + custom PaaS layer | Custom scheduler | Kubernetes skills on the resume; effort goes into the PaaS layer |
| Node OS | NixOS everywhere, one flake | Pi OS + Ansible | Reproducible; already uses flakes |
| Languages | TS for API/dashboard/CLI; Rust for operator, waker, build orchestration | Go | Plays to TS strength; Rust where speed and correctness matter |
| Images | Dockerfile required | Railpack/Nixpacks | One predictable path; agents write Dockerfiles anyway |
| Build arch | Cross-compile multi-arch; native Pi fallback; deferred amd64 leg | Emulation | One compile, both architectures, no emulation |
| Main desktop | Builds only, never serves apps | Auto-drain workers | Goes offline unpredictably |
| URLs | Auto subdomains + per-branch previews | Custom domains | Custom domains deferred past v1 |
| Previews | Sleep when idle; delete on PR close; 7-day hard TTL | Always on | Keeps Pi RAM free |
| Deploy | git push (GitHub App), CLI, dashboard | GitHub Actions | Direct webhooks are faster and post status to PRs |
| Secrets | k8s Secrets + encryption at rest | Vault/OpenBao | Too heavy for Pis |
| Access | Cloudflare Access | Custom auth | No auth code in v1 |
| Limits | Size tiers (nano/small/large) | Custom per app | Predictable packing; maps to pricing later |
| Storage | local-path PVCs on NVMe nodes + nightly restic to NAS | Longhorn | Replicated storage too heavy on Pis over gigabit |

## Roadmap and open questions

Five phases, each ending in a gate you can demo. Phase 1 is the first real payoff: your own portfolio site served from the cluster.

![[Screenshot 2026-11-02 at 2.24.43 PM.png]]

A phase isn't done until its gate passes on real hardware, including after a node reboot.

**Open questions**

- [ ] Final platform name, and a CLI name that doesn't collide with existing `pi` tools
- [x] Platform domain: `*.diamondjdev.me`
- [ ] New desktop specs: RAM and NVMe size set how many large-tier services fit
- [ ] NixOS on Pi 5: confirm the boot path (nixos-raspberrypi or a UEFI image) before Phase 0
- [ ] Seeding preview databases: empty, a seed script in the repo, or a sanitized snapshot
- [ ] Does your ISP plan allow hosting? The tunnel avoids open ports, but check the terms of service before opening to outside users
