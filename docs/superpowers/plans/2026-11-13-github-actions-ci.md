# GitHub Actions CI Plan

**Goal:** every PR and every push to `main` runs the frontend and script tests in GitHub Actions. CI only gates merges. Nothing is pushed, published or deployed.

**Scope change (2026-11-17):** `backend/` was deleted (see `docs/feedback-resolutions.md`, batch 1), so the backend job, the backend Docker build and the pnpm tasks are gone. The Docker image builds and the gitleaks scan are deferred until they have a job to gate.

## Constraints

- `permissions: contents: read`, no repository secrets, nothing reaches `firefly-pi`.
- Node 22, matching `frontend/Dockerfile`.
- `frontend/scripts/page.test.mjs` fetches `http://127.0.0.1:3000`, so the job waits for the server before `npm test`.

## Jobs (`.github/workflows/ci.yml`)

| Job | Steps |
|---|---|
| `frontend` | `npm ci`, `npm run typecheck`, `npm run build`, `npm start &`, wait for port 3000 (60 s), `npm test` |
| `scripts` | `node --test deploy/scripts.test.mjs nix/tests/build-image.test.mjs` |

- [x] Write `ci.yml`.
- [ ] Both jobs green on the PR that adds them.
- [ ] Manual, GitHub settings: mark `frontend` and `scripts` as required checks on `main`.
