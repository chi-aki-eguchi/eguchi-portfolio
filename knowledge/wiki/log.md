---
title: Wiki Maintenance Log
status: current
last_verified: 2026-07-05
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

### 2026-07-07 — Resolve open-issues item 2 (Turso startup-migration no-op claim)

Claude Code (autonomous night session) re-verified item 2: README.md,
DISTRIBUTION.md and migrate.ts's own header comment were already accurate;
the last stale copy was `server.ts`'s call-site comment「本番(turso)は
no-op」, corrected the same night (branch `improve/night-20260707`).
Updated `database.md` (fact + open-question rows) and `open-issues.md`
item 2 to resolved. Also removed the empty leftover
`.claude/skills/night-run/` directory (files were already deleted in
`1a62960`; only the untracked empty dir remained on disk).

### 2026-07-06 — Mark resolved open-issues rows (Fable5 reform pass)

Claude Code (Fable5 reform work, Balanced plan) re-verified open-issues
items 1, 8, 9, 11 against the current files and marked them resolved:
the settings-sync count is now consistently 4-place across AGENTS.md /
CLAUDE.md / `.claude/rules/react-components.md` / `docs/specs/
refine-and-loop-spec.md` (the last one fixed this date); `r2-upload.md`
and `perf-auditor.md` already carried the corrected WebP/cache-size facts;
the two-mac clone URL matches the real remote. The same pass fixed the
stale 256MB/96MB cache numbers that still lived in CLAUDE.md and AGENTS.md
themselves, and removed AGENTS.md's leftover "Driver may commit/push"
wording that contradicted the 2026-07-05 owner-push policy.

### 2026-07-05 — Add AI collaboration and Fable5 reform page

Codex added `pages/ai-collaboration.md` and linked it from the wiki index.
The page summarizes the new canonical Fable5 work order in
`docs/specs/ai-collaboration-reform-fable5.md`, the AGENTS.md / CLAUDE.md
entry points, the current Claude Code / Codex role split, and the caution that
the existing admin dirty tree should only be reviewed read-only unless the
owner approves implementation.

### 2026-07-03 — Local TIFF conversion tool

Driver task added `scripts/convert-tiffs.ts` and `docs/tiff-conversion.md` so
the owner can convert huge lab TIFF scans locally before upload. Updated
`pages/image-pipeline.md` to record the tool, its input/output folders,
sequential/idempotent behavior, and its parity with the upload master JPEG
settings.

### 2026-07-03 — Large TIFF upload size limit fix

Driver follow-up after TIFF support shipped but production large film scans
still failed. Updated `pages/image-pipeline.md` with the 300MB per-file image
upload ceiling, 305MB Bun request-body ceiling, 60MB serial-upload threshold,
and the verified platform limits/unknowns. Marked `pages/open-issues.md` item
41 resolved because the former 60MB app ceiling now has explicit server/client
handling and admin error text.

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
