# Reusable Wi-Fi Image Implementation Plan

> Execute inline with `superpowers:executing-plans`. Do not use subagents or commit/push without a request.

**Goal:** Flash the same private image onto a fresh Pi 5 and join the configured Wi-Fi network without Ethernet.

**Architecture:** Keep sops-nix and the existing Pi host-key recipient. Add a dedicated Wi-Fi-only age recipient and configure a runtime key path. Build a credential-free Nix image, then inject the bootstrap identity into its root filesystem outside the Nix store. The finished image is a private credential-bearing artifact.

**Tech stack:** Existing pinned NixOS/sops-nix, Docker Nix builder, Bash, Python standard library, e2fsprogs, util-linux, zstd, age and sops.

**Spec:** The approved design in this conversation: one unchanged reusable image; no Ethernet setup; no admin or shared SSH host key in the image; password and private keys stay out of tracking.

## Constraints

- Preserve the dirty worktree and the existing Pi's host-key decryption path. Do not switch or reboot the live Pi.
- Keep the bootstrap identity and final images under ignored `.private/`, with restrictive permissions. Never put their contents in Nix expressions, command arguments, logs or Git.
- Keep `nix/secrets.yaml` Wi-Fi-only. An image holder can decrypt that file; future application secrets must use separate recipients/files.
- Do not update existing flake pins, add cluster enrollment, or clone host keys, Tailscale state or k3s state.
- Retain the earlier deployment fixes and pending reboot/legacy-cleanup work.

## Review Focus

1. A missing, wrong or overbroad bootstrap key fails before publishing an image.
2. A tracked key/output or existing output fails closed; failed preparation leaves no finished artifact.
3. The base image stays unchanged; only the root partition receives the dedicated key, owned by root with mode 0600 in a 0700 directory.
4. Disk layout or filesystem/tool failures cannot silently produce a successful artifact.
5. Runtime Wi-Fi secret permissions remain 0400 for wpa_supplicant; old Pi host-key access remains configured.

## Task 1: Bootstrap configuration and tracking boundaries

- [x] Add failing checks for the runtime key path and ignored key/image artifacts.
- [x] Add `.private/`, raw/compressed image and bootstrap-key ignore rules.
- [x] Generate the dedicated identity locally, add its public recipient and rewrap only the encrypted Wi-Fi file.
- [x] Configure the runtime key path while retaining SSH-key decryption and secret permissions.
- [x] Evaluate the pinned Nix configuration and verify the bootstrap key decrypts only the Wi-Fi document.

## Task 2: Prepare the reusable private image

- [x] Add Linux integration regressions using small real partitioned ext4 images, including failure paths.
- [x] Add pinned image tools and a host build command using the existing Docker builder.
- [x] Add an unprivileged finalizer: decompress privately, locate the root partition, inject and verify the key, reassemble, compress and publish atomically without overwriting.
- [x] Prove source-image immutability, key ownership/mode/content, invalid-input rejection and cleanup on failure.

## Task 3: Verify and document

- [x] Build the current credential-free SD image and prepare the private artifact if local resources allow.
- [x] Inspect the artifact, confirm the key works without the admin/host identity, and scan tracked files/new Nix output for credential material without printing it.
- [x] Run existing deployment regressions, Nix configuration assertions and diff checks.
- [x] Document one-time key setup, build/flash usage, image sensitivity, recipient separation and rotation.
- [x] Report first-boot-on-hardware as unverified until a spare Pi or approved reboot window is available.
