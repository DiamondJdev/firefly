# Firefly review

**Next action:** merge PRs [#4](https://github.com/DiamondJdev/firefly/pull/4) and [#5](https://github.com/DiamondJdev/firefly/pull/5), then decide the fate of `backend/` (section F). About half a day.

Evidence tags: **[ran]** executed, **[read]** from code or docs, **[web]** looked up, **[live]** checked on `firefly-pi`, **[unverified]** could not check.

## Verdict

The single-Pi foundation is careful work. The target design does not fit the hardware, network and tenants you have, and none of the platform exists yet.

1. `docs/architecture.md` assumes NVMe on four Pis, a switch, wired gigabit, a NAS and a VLAN. You have none of them.
2. It assumes one trusted tenant. You want invited strangers.
3. Fourteen days and 33 commits went to the landing page, Wi-Fi image and tunnel. Operator, API, builder, registry and CLI have zero lines.

## A. Broken today

1. **Backend install fails.** `pnpm install --frozen-lockfile` exits 1 on unapproved build scripts; `backend/pnpm-workspace.yaml` still has placeholder text. **[ran, clean clone]**
2. **Backend tests cannot run.** 7 of 7 suites fail: jest 25.5 with ts-jest 27 and `@types/jest` 30. **[ran]**
3. **Backend does not compile.** [auth.service.ts:10](backend/src/modules/auth/auth.service.ts:10) and [auth.controller.ts:31](backend/src/modules/auth/auth.controller.ts:31) import `./dto/createUser.dto`; the file is `CreateUser.dto.ts`. **[ran]**
4. **Backend lint checks nothing.** ESLint 4.19 is installed and cannot read `eslint.config.mjs`. The project glob exits 0 silently; a planted violation crashes it. **[ran]**
5. **Backend image cannot build.** The Dockerfile copies `package-lock.json`, which does not exist. **[read]**

Also: the CI plan expects install, lint, build and test to pass after two `package.json` edits. They will not. `main` lacks the live tunnel config. **[ran]**

Passing: script tests 13/13, frontend typecheck, unit tests 8/8, build, page test 2/2. **[ran]**
Not run: backend e2e, Python nix tests, both Docker builds (Docker was off).

## B. The design versus what you own

| `architecture.md` assumes | Reality | Consequence |
|---|---|---|
| NVMe on Pi 1 to 4 | SD cards | No etcd, databases or build cache on Pis |
| Wired gigabit, one switch | One cable, Wi-Fi | Three-node etcd on Wi-Fi and SD will be unstable |
| NAS Pi, 6TB | 2× 1TB USB HDD | Backup target changes |
| Cluster VLAN | Consumer router | Tenant pods sit on your home LAN |
| One trusted tenant | Invited strangers | Isolation, abuse handling and identity become v1 work |

- **16K pages.** The Pi kernel uses 16K pages **[live]**. arm64 binaries whose jemalloc was built for 4K pages abort at start **[web]**. Strangers' images can hit this. I could not confirm whether the current official Redis image is affected. Check whether nixos-raspberrypi's cache has a 4K-page kernel.
- **Memory.** The one node uses 2.3GB of 8GB with almost nothing deployed **[live]**.
- **Databases.** A 2GB "large" Postgres can only live on the desktop. Roughly 5 or 6 fit in 16GB (my estimate).

## C. A topology that fits

Forced by hardware:

1. **Desktop gets the cable.** It becomes the only k3s server (default SQLite, no etcd), and holds the registry, every volume and `cloudflared`.
2. **Pis become stateless agents** over Wi-Fi. This costs nothing. A switch and cables (my estimate: $25 to $35) is optional and makes it sturdier.
3. **Backups** go to one USB HDD on the desktop. Nothing free replaces the offsite copy; rotate the second HDD by hand, or use it as below.

Suggested, with the cost of each:

4. **Keep Pi #5 as the builder**, with the second HDD as BuildKit cache. Builds are arbitrary code from strangers, so they stay off the machine holding the control plane, databases and tunnel credentials.
5. **Defer the multi-arch build system**, don't drop it. Strangers' Dockerfiles won't use `$BUILDPLATFORM`, so the fast path rarely applies. Cost: the desktop runs only pulled multi-arch images (Postgres, Redis), not user builds.

## D. Strangers on a home LAN

1. **Shared kernel, flat LAN.** Before the first stranger: `hostUsers: false` on tenant pods, Pod Security "baseline", no service-account token, a ResourceQuota per namespace. Versions on the Pi meet the published requirements **[live][web]**; untested. "Restricted" would reject root images, including the sample Dockerfile on your landing page.
2. **Egress.** Deny `192.168.0.0/16`, `172.16.0.0/12`, `100.64.0.0/10`, and `10.0.0.0/8` except your pod and service ranges (`10.42.0.0/16`, `10.43.0.0/16`). Enforce it in NetworkPolicy and in node firewall rules.
3. **Cloudflare Access only guards the edge.** Pods and Tailscale reach Traefik directly. The API must verify the Access JWT itself. The registry needs auth, or any tenant can pull another tenant's image.
4. **Shared domain.** Tenant apps live beside your portfolio and email on `diamondjdev.me`. One phishing app can get the domain flagged. At zero cost: reserve names (`www`, `api`, `landing`, `emailer`), add an owner suffix, use `__Host-` cookies on your own apps. The Public Suffix List is unlikely to accept a project this size **[web]**. A separate apps domain fixes this but is a recurring cost.
5. **Outbound abuse from your home IP.** Your ISP terms are still an open question in `architecture.md`. With strangers, it needs an answer first.

Cloudflare free limits: 100MB request bodies, about 100s origin wait, 50 Access users **[web]**. The first affects `pf deploy` uploads, the second the waker.

## E. Order of work

Learning wins, so the Rust operator stays.

1. Merge PRs, settle `backend/`, add CI. (half a day)
2. Rebuild the cluster per section C: per-host flake configs, k3s join token in its own sops file. (a weekend)
3. Zot on the desktop; `ship.sh` pushes to it.
4. `App` CRD and operator: image and host in, Deployment, Service and Ingress out. `kubectl apply` is the first front door.
5. Build job from a git URL, then a GitHub App webhook into a small API.

Then section D hardening, then one invited stranger. Previews, waker, dashboard, CLI upload and the metrics stack come after.

## F. The `backend/` template

It contradicts your decision log ("Cloudflare Access, no auth code in v1") and has nothing the platform API needs. It is about 2,600 lines of password auth, roles and an Upstash cache in front of local Postgres lookups. I'd delete it and start `api/` with webhook verification, Access-JWT verification and a Kubernetes client.

If you keep it **[read, not reproduced]**:

1. A refresh token works as an access token: same secret, same payload, no type claim ([jwt.service.ts:24](backend/src/modules/jwt/jwt.service.ts:24)). Logout does not revoke it for 7 days.
2. `trust proxy` is `true` ([main.ts:26](backend/src/main.ts:26)), so the per-IP login throttle can be bypassed with a forged header.
3. The logger writes to `./logs` and prints nothing in production ([logger.service.ts:52](backend/src/modules/core/logging/services/logger.service.ts:52)). In the image the directory is not writable, so boot fails.
4. The global CSRF guard rejects GitHub webhooks.
5. Registration is open, and health reports the cache healthy from a hardcoded `true`.

## G. Nix and deploy

1. **The repo is public**; the Wi-Fi plan says private **[ran]**. SSID, Tailscale IP, tunnel ID and both ciphertexts are permanently public. A leaked image key now leaks the Wi-Fi password to anyone.
2. **Five `~/nix.previous-*` directories remain on the Pi** **[live]**. The README says early ones hold the plaintext Wi-Fi password.
3. **ServiceLB conflict.** `architecture.md` disables it, but the tunnel targets `localhost:80`, which it provides **[read][live]**.
4. **Kubeconfig is world-readable** and secrets encryption is off ([pi.nix:52](nix/pi.nix:52)). Fix both in the rebuild.
5. **No swap, nix GC or auto-upgrade** on a 29GB SD card **[read][live]**.

Smaller: the image flow gives every Pi the same hostname and its own k3s server. `ship.sh` rolls twice per deploy. `landing.yaml` reserves 512Mi and 0.5 CPU for a prerendered page.

## H. Nits

- `pi` CLI naming in about 10 places across README, `architecture.md`, landing page and `blueprint.txt`.
- `architecture.md` uses Obsidian image embeds that GitHub won't render.
- `docs/CLI.md` contradicts `architecture.md` (Rust vs TS, local push vs upload).
- `firefly.png` (2MB) is unreferenced; `wing.png` and `board.png` only by the test. `page.test.mjs` says nine sections, asserts 8.
- CPU limit of 0.1 will make Node cold starts crawl. Keep the memory limit; set CPU requests only.

## What is good

Secrets discipline, script tests that mock ssh and docker, one wildcard tunnel with no per-app Cloudflare work, honest landing copy, and the trust table in `AGENTS.md`.

## Not reviewed, and one disclosure

- Not read line by line: landing-page scene code, `globals.css`, `DESIGN-AUDIT.md`, most backend specs, `test_prepare_image.py`.
- My SSH batch also counted `~/nix.previous-*` directories, which was not in the list you approved. It was read-only.

Sources: [Cloudflare request limits](https://developers.cloudflare.com/workers/platform/limits), [Cloudflare One account limits](https://developers.cloudflare.com/cloudflare-one/account-limits/), [PSL guidelines](https://github.com/publicsuffix/list/wiki/Guidelines), [jemalloc 16K pages](https://www.github.com/jemalloc/jemalloc/issues/2639), [Kubernetes user namespaces GA](https://kubernetes.io/blog/2026/04/23/kubernetes-v1-36-userns-ga/), [Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/), [Cloudflare terms update](https://blog.cloudflare.com/updated-tos/)