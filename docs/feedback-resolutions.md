# Feedback resolutions

Fixes for each concern in the Firefly review (`docs/feedback.md`), most urgent first.

**Start here:** delete `backend/`. That one PR fixes 10 of the review's concerns (A1 to A5 and F1 to F5). PRs #4 and #5 are already merged on `main`, so you can skip the review's "next action" line.

The fixes are grouped into 6 batches, most urgent first. Time estimates assume you are doing the work.

## Batch 1: Clean the repo (about 1 hour)

1. **A1 to A5, F1 to F5:** `git rm -r backend/`. This removes the broken install, tests, compile, lint, Dockerfile and all 5 auth bugs. `api/` gets started later, in batch 5.
2. **AGENTS.md:** remove the `backend/` rows, the NestJS intro line and the Dockerfile test note. Your AGENTS.md rules require this in the same PR.
3. **CI:** there is no `.github/` folder yet. Shrink `docs/superpowers/plans/2026-11-13-github-actions-ci.md` to frontend plus script tests only: `npm run typecheck`, `npm test`, `npm run build`, `node --test deploy/scripts.test.mjs nix/tests/build-image.test.mjs`. All of these pass today.
4. **"main lacks live tunnel config":** check this with `git diff main -- nix/`. PR #4 may already have fixed it.

## Batch 2: Live Pi security (about 1 hour; every step needs your approval because it reaches `firefly-pi`)

1. **G1 (public repo):** change the Wi-Fi password on the router, then re-encrypt `nix/secrets.yaml` with `sops`. The public ciphertext then protects nothing of value. Making the repo private now would not undo the exposure.
2. **G2:** `ssh firefly-pi 'rm -rf ~/nix.previous-*'`. Those directories hold the plaintext of the old password.
3. **G4:** in [pi.nix:52](../nix/pi.nix), change `--write-kubeconfig-mode=0644` to `0600` and add `"--secrets-encryption"`. Then run `nix/deploy.sh`.
4. **G5:** add `zramSwap.enable = true;`, `nix.gc = { automatic = true; options = "--delete-older-than 14d"; };` and `nix.settings.auto-optimise-store = true;`. Skip auto-upgrade: you deploy from the Mac, so it would fight the flake.
5. **G3 (ServiceLB):** make no code change. Edit `architecture.md` to say ServiceLB stays on, because the tunnel targets `localhost:80` ([tunnel.nix](../nix/tunnel.nix)).

## Batch 3: Small code and doc fixes (about 45 minutes)

1. **ship.sh rolls twice:** delete the `kubectl rollout restart` line in [ship.sh](../deploy/ship.sh). The tag changes on every commit, so `apply` already rolls the pods.
2. **landing.yaml and the CPU nit:** set requests to `memory: 128Mi`, `cpu: 50m`, keep a memory limit of `256Mi`, and remove the CPU limit.
3. **H, naming:** run `grep -rn '\bpi \|`pi`' README.md docs/ frontend/ blueprint.txt` and replace `pi` with `firefly`.
4. **H, files:** delete `firefly.png`. Fix the "nine sections" comment in `page.test.mjs` to say 8. Convert the Obsidian `![[...]]` embeds to `![](path)`.
5. **H, CLI.md:** delete `docs/CLI.md`. Move its command list into `architecture.md`, which already wins over it.

## Batch 4: Rewrite the design to match your hardware (about 2 hours of writing in `architecture.md`)

1. **B table:** replace the hardware section with section C's topology. The desktop gets the cable and is the only k3s server (SQLite, no etcd), plus the registry, volumes and `cloudflared`. The Pis become stateless Wi-Fi agents. Pi #5 is the builder, with HDD 2. HDD 1 is the backup target.
2. **Tenancy decision:** AGENTS.md says v1 is owner-only, and the review says you want strangers. Pick one and write it in the decision log. My suggestion: v1 stays owner-only, and strangers become v1.5, gated by batch 6.
3. **16K pages:** check whether the nixos-raspberrypi cache has a 4K-page kernel. If it doesn't, record "arm64 images must tolerate 16K pages" as a known limit, and test `redis` once on the Pi.
4. **Memory and databases:** record the budget: Postgres only on the desktop, about 5 "large" databases at most.
5. **Defer multi-arch builds:** add a dated decision-log entry.

## Batch 5: Rebuild and build the platform (in the review's E order, a weekend for step 1)

1. Per-host flake configs with a unique `networking.hostName` each, which also fixes the "same hostname" nit. Put the k3s join token in its own sops file, without the `wifi-image` recipient.
2. Zot registry on the desktop, and point `ship.sh` at it.
3. `App` CRD plus the Rust operator: image and host in; Deployment, Service and Ingress out.
4. Build job from a git URL, then a GitHub App webhook into a new `api/`. The API verifies webhook signatures and the Access JWT.

## Batch 6: Before the first stranger (section D, about 1 to 2 days)

1. **D1:** set `hostUsers: false`, Pod Security `baseline`, `automountServiceAccountToken: false` and a ResourceQuota per tenant namespace.
2. **D2:** add a NetworkPolicy that denies the private ranges listed in the review. Also remove `cni0` from `trustedInterfaces` in [pi.nix](../nix/pi.nix). That line currently lets pods reach the host.
3. **D3:** add registry auth, and make the API verify the Cloudflare Access JWT on every request.
4. **D4:** reserve names (`www`, `api`, `landing`, `emailer`), add an owner suffix to tenant hostnames, and use `__Host-` cookies on your own apps.
5. **D5:** read your ISP's terms on hosting and outbound traffic and record the answer in `architecture.md`. Keep `pf deploy` uploads under Cloudflare's 100MB limit.
