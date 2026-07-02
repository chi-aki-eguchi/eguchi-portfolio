---
title: Open Issues (contradictions, stale docs, unknowns)
status: current
last_verified: 2026-07-02
sources:
  - (see per-item citations below; each restates a finding also cited on its own topic page)
---

> ⚠️ This wiki is an index/summary layer, NOT the source of truth. If this
> page conflicts with the source documents listed under Sources, the sources
> win. See ../WIKI_SCHEMA.md.

Seeded 2026-07-02 during the wiki bootstrap + AI-environment audit. This page
exists so contradictions and stale docs are tracked in one place instead of
being silently rediscovered each session. See `wiki/log.md` for the
maintenance-log entry that created this page. When an item here is resolved,
update its status/note rather than deleting the row (see WIKI_SCHEMA.md's
"Stale handling").

## Contradictions between canonical docs

1. **Settings-sync place count**: CLAUDE.md and `.claude/rules/react-components.md`
   both say "4-place" (SETTINGS_PREVIEW_KEYS / GET /settings defaults /
   provider.tsx DB-apply useEffect / provider.tsx handlePreviewMessage).
   AGENTS.md's own top-level §0 (line 18) calls it "3-place" bundling two of
   those into one item, and AGENTS.md's *admin section* (lines 201-204)
   gives a **third, different** 3-item list referencing `admin.tsx`'s
   `previewPayload` array instead of `lib/settings-preview.ts`. Three
   different counts across two files that are both supposed to be
   authoritative. See invariants.md, admin-settings.md. **Needs a
   maintainer decision + AGENTS.md edit** (out of this audit's write scope).
2. **DISTRIBUTION.md / README.md / migrate.ts's own comment all claim the
   Turso production path is a startup-migration no-op.** It is not:
   `ensureTursoColumns()` runs real `SELECT`/`ALTER TABLE ADD COLUMN` work
   on every boot. See database.md. Three places need the same correction.
3. **`README.md` is internally inconsistent**: "Status" section says
   "Turnkey template: not yet," while its own "Deploy on Railway" section
   documents an already-published deploy button
   (`https://railway.com/deploy/cool-wide`). See distribution.md.
4. **Resolved 2026-07-02 by owner-approved retirement**:
   `NIGHT-RUN-LOG.md`, `claude-code-night-run.md`, and
   `.claude/skills/night-run/` were removed. The former BUILD_ID
   contradiction is now historical only; see night-run.md.
5. **Resolved 2026-07-02 by owner-approved retirement**:
   `docs/archive/claude-code-setup-guide.md`'s embedded fixed 3:15am/3:10am
   `caffeinate` + `sleep` draft example was removed. Precise wording:
   `docs/delayed-execution-sop.md` blacklists the unreliable
   delayed-execution class (`at`/`cron`, background `sleep N && claude`,
   launchd), not the exact full draft phrase. See night-run.md.
6. **Invariant #7 ("never `git add .`")** appears only inside CLAUDE.md's
   `test-*.mjs` bullet — AGENTS.md never states it, and AGENTS.md's own
   deploy steps use `git add -A`. See invariants.md.
7. **Invariant #10 ("never `bun run deploy`")** is absent from CLAUDE.md,
   AGENTS.md, every `.claude/rules/*.md` file, and the hook — it exists
   only in `.claude/skills/deploy/SKILL.md:55`. That same skill file also
   says `bun run deploy` is "legacy-but-present," when in fact
   `package.json` no longer defines a plain `deploy` script at all (only
   `deploy:runable:legacy`) — so the skill file itself is out of date.

## Stale / incorrect documentation found

8. **`.claude/rules/r2-upload.md`**: says "no WebP conversion; served as
   JPEG" — wrong, the code generates and serves pre-generated WebP
   thumb/medium variants. Also states the resize cache is "256MB" — actual
   code constant is **128MB**. See image-pipeline.md.
9. **`.claude/agents/perf-auditor.md`**: claims cache sizes "256MB
   (thumbnail) + 96MB/60s TTL (original)" — actual code is **128MB** and
   **48MB/60s**. Git history shows `r2-upload.md` was authored *hours after*
   the code already used 128MB, so this was wrong from creation, not just
   stale.
10. **`.claude/agents/exif-checker.md`**: stale line reference
    ("admin.tsx:L5 付近参照") — `DEFAULT_CAMERA_PRESETS` is actually at
    admin.tsx:639 in an 11,058-line file.
11. **`docs/two-mac-workflow.md:22`**: git clone example uses repo name
    `eguchi-portfolio-app.git`; the actual configured remote is
    `eguchi-portfolio` (confirmed via `git remote -v` / `git ls-remote`).
12. **`docs/setup-guide.md` env var list (方法2, Turso+R2)**: omits
    `S3_REGION`, `S3_FORCE_PATH_STYLE`, and `DEFAULT_PROFILE_NAME_KATA`,
    all of which exist in `.env.template` and are actively read in code.
13. **`DISTRIBUTION.md`'s schema-sync table**: Drizzle-config column uses
    bare filenames (`drizzle.config.ts`) while Schema/Migrations-dir columns
    in the same row use full paths — actual files live under
    `packages/web/`. Also, its "regenerate both" instructions don't state a
    preceding `cd packages/web`, but the configs are cwd-relative.
14. **`.claude/chat-backups/compaction-log.txt`**: exists to log session ID
    at each pre-compaction event, but all 4 recorded entries have a blank
    "Session:" field — `$CLAUDE_SESSION_ID` appears not to populate in the
    PreCompact hook's shell environment.
15. **`.claude/scheduled_tasks.lock`**: references pid 1890, which is not
    currently running, with a timestamp (2026-06-15) ~2.5 weeks stale as of
    this audit. Possibly an orphaned lock file. Contents were not modified
    (read-only per this audit's rules).
16. **`.claude/settings.local.json`**: contains a one-off Bash permission
    allow-entry for `grep ... pages/admin.tsx` — that relative path doesn't
    exist from repo root (the real file is
    `packages/web/src/web/pages/admin.tsx`), so the entry can never match.
17. **Resolved 2026-07-02**: Codex's 2026-06-18 audit (`task.md` lines
    686, 696) recommended adding "legacy/historical" headers to
    the legacy content spec, Runable notes, and `proposals/09-modernization.md`.
    This cleanup moved the first two to `docs/archive/`;
    `proposals/09-modernization.md` remains outside this task's approved
    scope.
18. `DISTRIBUTION.md` overall is stale relative to a substantial,
    unmentioned productization push (live `/service` sales page, Stripe
    Payment Links, published Railway deploy button) that shipped after its
    last edit (2026-06-20) — see distribution.md.

## Unknowns / needs owner decision

19. Should `knowledge/` itself be excluded or genericized when this repo is
    forked as the distribution template? It currently contains akieguchi.com-
    specific facts (tagged `[akieguchi-specific]` where identified) mixed
    with template-generic architecture notes. **Not resolved by this audit
    — flagged here per the task's Phase 8 instruction.**
20. Is `packages/web/drizzle/`'s incomplete migration history (missing
    `0001_flawless_the_stranger.sql`, no migrations for `series`/
    `pricing_plans`/several `photos` columns) something to regenerate/squash,
    or accepted because `db:push` is the real mechanism in use? See
    database.md.
21. **Resolved 2026-07-02 for the improvement roadmap**: it was treated as
    superseded by `task.md`/wiki workflow and moved to `docs/archive/`.
    `proposals/*.md` remain undecided because this task did not include
    proposal cleanup.
22. **Resolved 2026-07-02**: root stray files were handled by owner-approved
    cleanup. `claude-code-luxury-feel-prompt.md` was removed after verifying
    the requested animation/style work exists in `styles.css`;
    `chatgpt-handoff.md` and `service.tsx.handoff.md` were archived with
    live issues extracted below.
23. **Resolved 2026-07-02**: `AUDIT.report/` was owner-approved for deletion.
24. **Resolved 2026-07-02**: the empty root-level `skills/` directory was
    owner-approved for deletion.

## Sources

Each item above restates a finding fully cited (with exact file:line
references) on its corresponding topic page — see invariants.md,
database.md, image-pipeline.md, distribution.md, night-run.md, and the
relevant task handoff for the full root-inventory / .claude-audit /
docs-freshness tables.
