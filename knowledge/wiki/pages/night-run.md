---
title: Night-Run Setup
status: needs-review
last_verified: 2026-07-02
sources:
  - claude-code-night-run.md
  - NIGHT-RUN-LOG.md
  - .claude/skills/night-run/SKILL.md
  - refine-and-loop-spec.md
  - docs/delayed-execution-sop.md
  - claude-code-setup-guide.md
  - .claude-delayed-runs/ (directory listing only)
  - packages/web/src/api/ogp.ts
  - packages/web/vite.config.ts
  - task.md
---

> ⚠️ This wiki is an index/summary layer, NOT the source of truth. If this
> page conflicts with the source documents listed under Sources, the sources
> win. See ../WIKI_SCHEMA.md.

**Status: `needs-review`** — several night-run docs disagree with each other
(see below); treat the "3:15am / 3:10am" mechanism description with caution.

## Facts

- The **live, authoritative** mechanism (per `.claude/skills/night-run/SKILL.md`,
  which names `refine-and-loop-spec.md`'s "T0" section as its own source of
  truth) is **credit-reset-driven and dynamic — NOT a fixed clock time**.
  `refine-and-loop-spec.md` T0 states explicitly: "fixed clock time / fixed
  interval cron is NOT used (event-driven)." The 1-cycle flow: think →
  implement 1 thing → report → build check (`tsc -b && bun run build`) →
  `git push` → read the usage-limit message's "resets HH:MM (Asia/Tokyo)" →
  schedule the next start 2-3 minutes after that.
  (.claude/skills/night-run/SKILL.md:11,13-36; refine-and-loop-spec.md:90-98)
- SKILL.md prohibited actions (absolute): DB schema/Drizzle migrations,
  direct R2 bucket manipulation, adding/changing env vars, new features,
  direct `.env` edits. §0 post-implementation checklist: `withRetry`
  wrapping, `assertOk`, settings 4-place sync (only if adding new settings
  keys), no manual Content-Encoding, `tsc -b && bun run build` passing.
  (.claude/skills/night-run/SKILL.md:21-27,94-100)
- `docs/delayed-execution-sop.md` (2026-06-22) **explicitly blacklists**
  macOS `at`/`atrun`, direct `crontab -e` calls, background
  `sleep N && claude` timers, and `launchd` plists as unreliable —
  recommending Claude Code's own in-session scheduled task instead.
  (docs/delayed-execution-sop.md:7-8,63-70)
- **The specific "3:15am start after 3:10am credit reset,
  `caffeinate -d &` + `sleep` + `claude`" pattern DOES exist verbatim on
  disk** — but only inside `claude-code-setup-guide.md:151-161`, a broader
  "environment setup guide" containing an **embedded draft/example** of
  what a night-run SKILL.md "should" look like. That example's description
  and content diverge from the real, currently-live
  `.claude/skills/night-run/SKILL.md` (different frontmatter description,
  no reference to `refine-and-loop-spec.md`/T0, fixed time vs dynamic
  reset). This reads as **stale planning-doc content never reconciled with
  the real skill file**, and is directly contradicted by the more recent
  `delayed-execution-sop.md`'s "do not do this" list.
- `claude-code-night-run.md`'s Phase-1 "BUILD_ID stale problem" section
  (lines 21-24) describes a bug + fix (inject via `vite.config.ts` define)
  that is **already resolved via a different approach**:
  `packages/web/src/api/ogp.ts:46-48` reads
  `process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0,8) ?? "dev"` at runtime;
  `vite.config.ts` has no `__BUILD_ID__` define (only an unrelated
  `BUILD_TAG` for asset-filename cache-busting). `task.md:676` itself flags
  this doc's BUILD_ID instructions as outdated ("古い").
- **NIGHT-RUN-LOG.md self-contradicts**: its most-recent (top) entry
  ("2026-06-18 night run") lists BUILD_ID as still stale in its "next
  steps" — but an *earlier* entry in the same file ("2026-06-17 夜間自走ラン
  Phase 1") says the fix was already made, and the current source code
  confirms the fix **is** in place. (NIGHT-RUN-LOG.md:1-3,88-92,282-291)
- `NIGHT-RUN-LOG.md`'s mtime is Jun 17 23:13, with **no entries after
  2026-06-18**, while `git log` shows active commits through 2026-07-01 —
  roughly a two-week gap despite ongoing development. `task.md` separately
  references "refine-and-loop-spec.md T1"-driven loop entries, suggesting
  night-run logging may have moved there instead.
- `.claude-delayed-runs/` currently contains exactly 2 files, both named
  `stripe-template-20260622-*.log` — **unrelated to night-run**, no
  night-run delayed-execution artifacts present.
- `claude-code-night-run.md`, `.claude/skills/night-run/SKILL.md`,
  `docs/delayed-execution-sop.md`, `claude-code-setup-guide.md`, plus
  `.claude/rules/`, `.claude/agents/`, `.claude/hooks/`,
  `.claude/settings.json`, `.claude/skills/` all share an identical mtime
  ("Jun 26 13:03:24 2026"), consistent with (not proof of) a single batch
  write/checkout event. `refine-and-loop-spec.md` (Jun 16) and
  `NIGHT-RUN-LOG.md` (Jun 17) predate that batch.

## Assumptions

- The identical "Jun 26 13:03:24" mtimes are assumed to indicate a single
  batch write/checkout/restore event rather than coincidental independent
  edits — inferred from timestamp equality only, not git blame for those
  specific paths.
- `claude-code-setup-guide.md`'s embedded night-run example is assumed to
  be an early draft later superseded by the real SKILL.md, rather than the
  reverse.

## Open Questions

- Was the fixed "3:15am after 3:10am reset" mechanism ever actually the
  live/running approach at some point, or only ever a draft embedded in
  `claude-code-setup-guide.md` that was never operationalized?
- Why has `NIGHT-RUN-LOG.md` had no new entries since 2026-06-18 despite
  active commits through 2026-07-01 — did night-run execution pause, or did
  reporting move to `task.md`'s T0/T1 handoffs?
- Is `.claude/scheduled_tasks.lock` still relevant to the current
  credit-reset-driven scheduling (see open-issues.md — it references a pid
  that isn't running and is ~2.5 weeks stale)?
- Does the current night-run flow use `.claude-delayed-runs/` at all, given
  the only files there are unrelated (stripe-template logs)?

## Sources

- claude-code-night-run.md
- NIGHT-RUN-LOG.md
- .claude/skills/night-run/SKILL.md
- refine-and-loop-spec.md (T0, T2 sections)
- docs/delayed-execution-sop.md
- claude-code-setup-guide.md (lines 142-161)
- .claude-delayed-runs/ (directory listing)
- packages/web/src/api/ogp.ts, packages/web/vite.config.ts
- task.md:470,676
