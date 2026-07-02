---
title: Repository Layout & File Hygiene
status: current
last_verified: 2026-07-02
sources:
  - AGENTS.md
  - .gitignore
  - docs/specs/README.md
  - docs/archive/README.md
  - scratch/README.md
---

> ⚠️ This wiki is an index/summary layer, NOT the source of truth. If this
> page conflicts with the source documents listed under Sources, the sources
> win. See ../WIKI_SCHEMA.md.

## Current Layout

- Root Markdown is intentionally tiny: `README.md`, `AGENTS.md`,
  `CLAUDE.md`, `DISTRIBUTION.md`, and `task.md` are the only allowed
  root-level `.md` files.
- `docs/specs/` holds active specifications. Each spec has one current file,
  updated in place; git history carries older versions.
- `docs/archive/` holds finished, retired, or historical docs that should
  remain available for context.
- `scratch/` is the uncommitted workspace for prompts, drafts, and scratch
  scripts. Its contents are gitignored except `scratch/README.md`.
- `knowledge/` is the AI-maintained wiki/index layer. It is not canonical
  source of truth.
- `packages/` contains runnable app packages; currently `packages/web/` is
  the main Hono + React app.
- `.claude/` contains Claude Code rules, agents, hooks, and local Claude
  coordination surfaces that are intentionally versioned unless ignored.

## Hygiene Rules

- New root-level `.md` files outside the whitelist are rule violations.
- Active specs belong in `docs/specs/`; do not create `-v2`, `-v3`,
  `-final`, or `-draft` spec filenames.
- Finished historical docs move to `docs/archive/` with `git mv`.
- Handoffs belong in `task.md`; standalone `*.handoff.md` files are banned.
- Temporary prompts, drafts, and scratch scripts belong in `scratch/`.
- Untracked files should be resolved within a few working sessions by
  committing, gitignoring, archiving, moving to `scratch/`, or deleting with
  owner approval.
- Every Driver should check `git status` before finishing and report any
  unrelated dirty files left alone.

## Sources

- AGENTS.md (`File Hygiene`, `Agent Ownership`, and repo structure sections)
- .gitignore (`scratch/*` with `!scratch/README.md`)
- docs/specs/README.md
- docs/archive/README.md
- scratch/README.md
