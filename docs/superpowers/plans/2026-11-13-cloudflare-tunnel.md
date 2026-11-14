# Cloudflare Tunnel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `https://landing.diamondjdev.me` serves the landing app from the Pi to any device, with no open ports and no paid services.

**Architecture:** One locally-managed Cloudflare Tunnel, run by the NixOS `services.cloudflared` module on the Pi. One proxied wildcard DNS record `*.diamondjdev.me` points at it. The tunnel forwards every hostname to Traefik on `localhost:80`, and Traefik routes by the `host` in each app's Ingress. Adding an app adds an Ingress rule and nothing on the Cloudflare side.

**Tech Stack:** Cloudflare free plan (DNS, Universal SSL, Tunnel), pinned nixpkgs `cloudflared` 2026.5.2, sops-nix, k3s-bundled Traefik.

**Spec:** The requirements in this conversation: free only, HTTPS from any device, use `diamondjdev.me`, stay under the 1,000-tunnel cap, sized for one user and fewer than 10 projects.

## Global Constraints

- $0. No Advanced Certificate Manager, no paid Access seats, no Argo, no paid Workers.
- One tunnel total. App count never changes the number of tunnels or DNS records.
- App hostnames are **one label deep**: `<app>.diamondjdev.me`, previews `<app>-pr-<n>.diamondjdev.me`. Free Universal SSL covers `*.diamondjdev.me` only; `app.pf.diamondjdev.me` would need a paid certificate.
- The portfolio at `diamondjdev.me` (Vercel, `76.76.21.21` today) keeps working throughout. Explicit DNS records override the wildcard.
- Tunnel credentials get their own sops file encrypted for `admin` and `firefly-pi` only. The `wifi-image` recipient must never decrypt it.
- No inbound firewall change. `cloudflared` only dials out.

## Review Focus

1. **Existing services break during the nameserver move.** Expect the portfolio, `emailer.diamondjdev.me`, Google verification and email forwarding to work before and after the move. Task 1 copies each record by hand, keeps them DNS only, moves forwarding to Cloudflare Email Routing and checks each one.
2. **Tunnel secret leaking to the reusable image.** Expect the `wifi-image` key to fail to decrypt it. Task 2 adds a test that reads the file's sops recipients.
3. **Unknown subdomain.** Expect `https://nope.diamondjdev.me` to return 404 over valid HTTPS and no other app. Traefik's default 404 covers it; Task 3 checks it.
4. **Plain HTTP.** Expect `http://landing.diamondjdev.me` to redirect to HTTPS. Task 1 enables Always Use HTTPS; Task 3 checks it.
5. **Pi reboot.** Expect the site back without manual steps. `cloudflared` is a systemd unit; Task 3 checks `systemctl is-enabled`.

---

### Task 1: Move the DNS zone to Cloudflare (manual, dashboard)

The domain uses Namecheap DNS today (`dns1.registrar-servers.com`). Everything below is free.

**Files:** none

**Records to keep (baseline taken 2026-11-13).** Every row goes into Cloudflare as **DNS only** (grey cloud). Vercel and Render issue their own certificates, and proxying them can break renewal. Explicit records win over the `*` wildcard, so `emailer` never reaches the tunnel.

| Type | Name | Value | Owner |
|---|---|---|---|
| A | `@` | `76.76.21.21` | Vercel portfolio |
| CNAME | `emailer` | `automaticemailer-itvs.onrender.com` | Render app |
| CNAME | `_a47fe9d4d5cd…` (full name in Namecheap) | `3C8EA657…` (full value in Namecheap) | Certificate validation. Cloudflare's import scan can't guess this name, so add it by hand |
| TXT | `@` | `google-site-verification=tLwd9iuREaswdSHNioaEjN5TY8J9y4xQTPQobtOugMo` | Google Search Console |
| MX + TXT | `@` | `eforward1-5.registrar-servers.com`, `v=spf1 include:spf.efwd.registrar-servers.com ~all` | Namecheap email forwarding (set under Mail Settings, not Host Records) |

There's no `www` record today.

**Email forwarding:** Namecheap's forwarding only works while Namecheap hosts the DNS. Replace it with Cloudflare Email Routing (free), which writes its own MX and SPF records.

- [ ] **Step 1:** In Namecheap, copy the full name and value of the `_a47fe…` CNAME, and list every forward under Domain → Redirect Email (alias → destination).
- [ ] **Step 2:** In Cloudflare, Add a site → `diamondjdev.me` → Free plan. Make the imported records match the table: add the `_a47fe…` CNAME, set every row to DNS only, and delete the imported `eforward*` MX and `spf.efwd` TXT records.
- [ ] **Step 3:** In Cloudflare, Email → Email Routing: enable it, add each forward from Step 1, and confirm each destination address from its verification email.
- [ ] **Step 4:** In Namecheap, set custom nameservers to the two Cloudflare gives you. Wait until `dig NS diamondjdev.me +short` shows them (usually under an hour, up to 24h).
- [ ] **Step 5:** In Cloudflare, SSL/TLS → Edge Certificates: turn on **Always Use HTTPS**. Leave Universal SSL on.
- [ ] **Step 6: Verify every record survived:**
  - `dig diamondjdev.me A +short` → `76.76.21.21`
  - `dig emailer.diamondjdev.me CNAME +short` → `automaticemailer-itvs.onrender.com.`
  - `curl -sI https://emailer.diamondjdev.me | head -1` → `HTTP/2 200` (same as the baseline)
  - `dig diamondjdev.me TXT +short` → contains the `google-site-verification` value
  - `dig diamondjdev.me MX +short` → Cloudflare's `route*.mx.cloudflare.net`. Send a test mail to one alias and confirm it arrives.
  - Open `https://diamondjdev.me` in a browser and confirm the portfolio loads. curl gets `429` from Vercel even today, so curl can't check it.

### Task 2: Create the tunnel and encrypt its credentials

**Files:**
- Create: `nix/tunnel-credentials.json` (sops-encrypted, binary format)
- Modify: `nix/.sops.yaml` (new creation rule)
- Test: `nix/tests/test_config.py`

**Interfaces:**
- Produces: tunnel UUID `<uuid>` (used verbatim in Task 3) and the encrypted file `nix/tunnel-credentials.json`.

- [ ] **Step 1:** On the Mac: `cloudflared tunnel login` (browser, pick `diamondjdev.me`), then `cloudflared tunnel create firefly`. Note the UUID it prints. Credentials land in `~/.cloudflared/<uuid>.json`.
- [ ] **Step 2:** `cloudflared tunnel route dns firefly '*.diamondjdev.me'`. Confirm in the dashboard: one proxied `CNAME * → <uuid>.cfargotunnel.com`.
- [ ] **Step 3: Write the failing test** in `nix/tests/test_config.py`, as a new `TunnelSecretTests(unittest.TestCase)` class so it runs without the `nix eval` in `BootstrapConfigTests.setUpClass`. Add `import re`.

```python
def test_tunnel_credentials_exclude_wifi_image_recipient(self):
    repository = Path(__file__).resolve().parents[2]
    sops_config = (repository / "nix/.sops.yaml").read_text()
    wifi_image = re.search(r"&wifi-image (age1\w+)", sops_config).group(1)
    admin = re.search(r"&admin (age1\w+)", sops_config).group(1)
    pi = re.search(r"&firefly-pi (age1\w+)", sops_config).group(1)
    metadata = json.loads((repository / "nix/tunnel-credentials.json").read_text())["sops"]
    recipients = {entry["recipient"] for entry in metadata["age"]}
    self.assertEqual(recipients, {admin, pi})
    self.assertNotIn(wifi_image, recipients)
```

- [ ] **Step 4:** Run `python3 -m unittest discover -s nix/tests -k TunnelSecretTests` from the repo root. Expected: FAIL (`FileNotFoundError`).
- [ ] **Step 5:** Add a second `creation_rules` entry in `nix/.sops.yaml` with `path_regex: ^tunnel-credentials\.json$` and age recipients `*admin` and `*firefly-pi` only.
- [ ] **Step 6:** Encrypt from inside `nix/`: `sops --config .sops.yaml encrypt --input-type binary --output-type json --filename-override tunnel-credentials.json ~/.cloudflared/<uuid>.json > tunnel-credentials.json`. Then delete `~/.cloudflared/<uuid>.json`. Keep `~/.cloudflared/cert.pem`: it is only needed to manage tunnels and never goes to the Pi.
- [ ] **Step 7:** Re-run the test. Expected: PASS. `test_bootstrap_policy_cannot_encrypt_application_secret_files` must still pass.
- [ ] **Step 8:** `git add nix/.sops.yaml nix/tunnel-credentials.json nix/tests/test_config.py` and commit `feat: add encrypted Cloudflare tunnel credentials`.

### Task 3: Run the tunnel on the Pi and publish landing

**Files:**
- Modify: `nix/pi.nix` (sops secret + `services.cloudflared`)
- Modify: `deploy/landing.yaml` (Ingress host)
- Test: `nix/tests/test_config.py`

**Interfaces:**
- Consumes: `<uuid>` and `nix/tunnel-credentials.json` from Task 2.

- [ ] **Step 1: Write the failing test.** Add to the `--apply` attrset in `setUpClass`:
  `tunnel = config.services.cloudflared.tunnels."<uuid>";` with fields `ingress`, `default`, `credentialsFile`, and `tunnelSecretPath = config.sops.secrets.cloudflared-tunnel.path;`. Then:

```python
def test_one_wildcard_tunnel_routes_to_traefik(self):
    tunnel = self.configuration["tunnel"]
    self.assertEqual(tunnel["ingress"], {"*.diamondjdev.me": "http://localhost:80"})
    self.assertEqual(tunnel["default"], "http_status:404")
    self.assertEqual(tunnel["credentialsFile"], self.configuration["tunnelSecretPath"])
```

- [ ] **Step 2:** Run in the builder (README command, `-k tunnel`). Expected: FAIL (attribute missing).
- [ ] **Step 3:** In `nix/pi.nix`, add `sops.secrets.cloudflared-tunnel = { sopsFile = ./tunnel-credentials.json; format = "binary"; };` (root-owned 0400 is fine: the module reads it via systemd `LoadCredential`). Add `services.cloudflared = { enable = true; tunnels."<uuid>" = { credentialsFile = config.sops.secrets.cloudflared-tunnel.path; ingress."*.diamondjdev.me" = "http://localhost:80"; default = "http_status:404"; }; };`. Add the comment `# ponytail: one host service, one tunnel; move to a k8s Deployment with replicas once a second Pi joins.`
- [ ] **Step 4:** Re-run the builder tests. Expected: all PASS.
- [ ] **Step 5:** In `deploy/landing.yaml`, change the Ingress host to `landing.diamondjdev.me`.
- [ ] **Step 6:** `bash nix/deploy.sh`, then `deploy/ship.sh landing frontend deploy/landing.yaml`.
- [ ] **Step 7: Verify from the Mac with Tailscale off (or from a phone on cellular):**
  - `curl -sI https://landing.diamondjdev.me | head -1` → `HTTP/2 200`
  - `curl -sI http://landing.diamondjdev.me | head -1` → `301` or `308` to `https://`
  - `curl -sI https://nope.diamondjdev.me | head -1` → `HTTP/2 404`
  - `curl -sI https://emailer.diamondjdev.me | head -1` → still `HTTP/2 200`, served by Render rather than the tunnel
  - `ssh firefly-pi systemctl is-enabled cloudflared-tunnel-<uuid>` → `enabled`
- [ ] **Step 8:** Commit `feat: expose apps through one wildcard Cloudflare tunnel`.

### Task 4: Docs

**Files:**
- Modify: `README.md` (Landing image section; remove the "do not configure Cloudflare or HTTPS" line and the nip.io URL)
- Modify: `docs/architecture.md:89,106` (one-label hostnames; `cloudflared` is a host service for now)
- Modify: `docs/architecture.md:156` (tick the platform-domain question: `*.diamondjdev.me`)

- [ ] **Step 1:** Run `humanizer:humanizer` on the README edits. Document: new app = Ingress with `host: <app>.diamondjdev.me`, nothing else; hostnames stay one label deep or HTTPS breaks; tunnel credentials rotate with `cloudflared tunnel delete` + Task 2.
- [ ] **Step 2:** `node --test deploy/scripts.test.mjs nix/tests/build-image.test.mjs` → all pass.
- [ ] **Step 3:** Commit `docs: describe the Cloudflare tunnel setup`.

---

**Skipped, and when to add it:**
- Cloudflare Access on a dashboard/API: free up to 50 users. Add when the dashboard exists.
- `cloudflared` as a 2-replica k8s Deployment: add when a second Pi joins the cluster.
- Per-app DNS records or per-app tunnels: never. The wildcard covers them.
