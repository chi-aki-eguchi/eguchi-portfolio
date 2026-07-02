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

### 2026-07-02 — TIFF upload validation fix

Driver task for production admin upload bugs. Updated `pages/image-pipeline.md`
to record that TIFF uploads are accepted (`image/tiff`, `image/x-tiff`,
`.tif`, `.tiff`) and normalized into the standard JPEG master + WebP
derivatives. Marked `pages/open-issues.md` item 32 resolved because upload
validation now uses a shared allow-list even when the browser provides an
empty or generic MIME type.

### 2026-07-02 — Full-site debug & safe improvement pass

Bounded Driver task: read-only 10-dimension audit (correctness/API/
frontend/compatibility/accessibility/SEO/security/performance/tests/
distribution) via a multi-agent workflow, deduplicated and adversarially
re-verified. Result: 2 confirmed zero-risk (Tier 1) fixes applied directly
(dead `web/pages/index.tsx` removed; stale Expo/Electron references removed
from `turbo.json`/`.oxlintrc.json`) and 19 Tier 2 proposals logged for
owner decision (no code changed for those — see `pages/open-issues.md`
items 27-43). Also appended a "owner is not a programmer" communication
rule to AGENTS.md (own append-only commit). Pre-existing uncommitted
working-tree changes from a prior session (`server.ts`, `task.md`, and the
static-file-serving Content-Type work) were read and reported on per the
task's rules, but not touched, staged, or committed.

### 2026-07-02 — Add repo layout and file hygiene page

Owner-approved repository cleanup added the permanent File Hygiene rules to
AGENTS.md and `.claude/rules/file-hygiene.md`, created
`pages/repo-layout.md`, and linked it from the wiki index. The page records
the new root Markdown whitelist, `docs/specs/`, `docs/archive/`, `scratch/`,
handoff, and untracked-file rules.

### 2026-07-02 — Retire night-run setup

Owner-approved cleanup retired the night-run setup. The wiki page
`pages/night-run.md` is now marked `stale` and kept only as a historical
pointer. The index link moved to a Retired subsection, and `pages/open-issues.md`
now records the former NIGHT-RUN / fixed-time contradictions as resolved by
retirement. General delayed-execution guidance remains in
`docs/delayed-execution-sop.md`.

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
