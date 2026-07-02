---
title: Wiki Maintenance Log
status: current
last_verified: 2026-07-02
sources: []
---

> ⚠️ This wiki is an index/summary layer, NOT the source of truth. If this
> page conflicts with the source documents listed under Sources, the sources
> win. See ../WIKI_SCHEMA.md.

## Scope

This log tracks changes **to the wiki itself** (new pages, re-ingests,
corrections, contradictions found/resolved). It is **not** the project's
implementation work log — that is `../../task.md`. Do not record
feature/bugfix work here; record it in `task.md` instead, and only link to
it from here if a wiki update was triggered by it.

## Entries

### 2026-07-02 — Initial bootstrap

Bootstrapped `knowledge/` from scratch (docs-only task: "AI Development
Environment Audit & Knowledge Wiki Bootstrap"). Created:

- `knowledge/WIKI_SCHEMA.md`
- `knowledge/raw/README.md`
- `knowledge/wiki/index.md`, `knowledge/wiki/log.md` (this file)
- `knowledge/wiki/pages/project-overview.md`
- `knowledge/wiki/pages/invariants.md`
- `knowledge/wiki/pages/database.md`
- `knowledge/wiki/pages/service-page.md`
- `knowledge/wiki/pages/distribution.md`
- `knowledge/wiki/pages/admin-settings.md`
- `knowledge/wiki/pages/image-pipeline.md`
- `knowledge/wiki/pages/deployment.md`
- `knowledge/wiki/pages/night-run.md`
- `knowledge/wiki/pages/open-issues.md`

Content was compiled from a 12-agent read-only recon pass over CLAUDE.md,
AGENTS.md, task.md, DISTRIBUTION.md, all spec files, all of `.claude/`, all
of `docs/`, and the relevant parts of `packages/web/src`. Every Fact on every
page carries a file/line citation back to a canonical source; anything not
directly verified was placed under that page's Assumptions or Open
Questions instead (see `../WIKI_SCHEMA.md`'s fact/assumption/open-question
rule).

Six contradictions between canonical docs, and roughly a dozen
stale/incorrect documentation items, were found during this pass and seeded
into `pages/open-issues.md` rather than silently corrected in-place (several
of the corrections would require editing CLAUDE.md/AGENTS.md/`.claude/*`,
which was out of this bootstrap task's write scope — see the task's audit
report for the full list).

This same task also appended two sections to `AGENTS.md` ("Shared Knowledge
Wiki," "Agent Ownership: 1 task = 1 Driver") and added a short pointer block
to `CLAUDE.md`. See those files' own history for details; this log only
covers `knowledge/` itself.

**No implementation code was read for the purpose of changing it** — this
was a docs-only task. No files outside `knowledge/`, plus the two permitted
append-only edits above, were modified.
