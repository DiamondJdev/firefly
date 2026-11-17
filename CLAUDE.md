@AGENTS.md

## Claude-specific

- Implementation plans live in `docs/superpowers/plans/` and are written for the superpowers `executing-plans` / `subagent-driven-development` skills. Put new plans there, named `YYYY-MM-DD-<topic>.md`.
- Frontend design work follows the tasteskill rules recorded in `frontend/DESIGN-AUDIT.md`; `.taste-skill/` is local and ignored by Git.
- Follow "Keeping this file current" in AGENTS.md on every task: when your change makes AGENTS.md or this file wrong, fix them in the same change without being asked. Put cross-agent facts in AGENTS.md; only Claude-specific ones go here.
- Commands that reach `firefly-pi` or Cloudflare need the user's approval every time, even in auto mode.
