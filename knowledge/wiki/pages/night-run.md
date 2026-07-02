---
title: Night-Run Setup
status: stale
last_verified: 2026-07-02
sources:
  - knowledge/wiki/log.md
  - docs/delayed-execution-sop.md
---

> ⚠️ This wiki is an index/summary layer, NOT the source of truth. If this
> page conflicts with the source documents listed under Sources, the sources
> win. See ../WIKI_SCHEMA.md.

## Retirement Note

Night-run setup was retired on 2026-07-02 by owner decision. The tracked
setup files (`.claude/skills/night-run/`, `claude-code-night-run.md`, and
`NIGHT-RUN-LOG.md`) were removed, and this page is retained only as a
historical pointer. See `knowledge/wiki/log.md` for the cleanup entry.

`docs/delayed-execution-sop.md` remains in scope for general delayed
execution guidance. It blacklists unreliable delayed-execution classes such
as macOS `at`/`cron` and background `sleep N && claude` timers; it did not
literally name the full `caffeinate` + fixed-time draft example.

## Left In Place

- `docs/specs/refine-and-loop-spec.md` still contains broader autonomous-loop language
  with credit-reset coupling. It was left untouched because that file covers
  more than the retired night-run setup.
- `docs/archive/improvement-roadmap.md` still contains old autonomous-loop wording. It was
  left untouched as historical roadmap context, not an active night-run setup.

## Sources

- knowledge/wiki/log.md
- docs/delayed-execution-sop.md
