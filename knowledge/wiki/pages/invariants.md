---
title: The 13 Project Invariants
status: current
last_verified: 2026-08-20
sources:
  - CLAUDE.md
  - AGENTS.md
  - .claude/rules/api-validation.md
  - .claude/rules/db-migrations.md
  - .claude/rules/no-manual-encoding.md
  - .claude/rules/r2-upload.md
  - .claude/rules/react-components.md
  - .claude/hooks/protect-invariants.sh
  - .claude/rules/api-client.md
  - .claude/settings.json
  - packages/web/src/api/database/libsql.ts
  - .gitignore
---

> ⚠️ This wiki is an index/summary layer, NOT the source of truth. If this
> page conflicts with the source documents listed under Sources, the sources
> win. See ../WIKI_SCHEMA.md.

This page tracks the 13 project invariants named in the audit brief, where
each is documented, and whether it's mechanically enforced or just written
down. See open-issues.md for drift found between documents.

> **Re-verified 2026-08-20 against the current tree.** Eleven rows were wrong.
> `CLAUDE.md` and `AGENTS.md` have since been rewritten and shortened
> (`AGENTS.md` 110 lines, `CLAUDE.md` 55), so **every line citation into them
> was pointing at a file three times their old size**, and `task.md` now holds
> only the Current State block. Two rows cited the wrong rule file outright.
>
> Citations into `CLAUDE.md` / `AGENTS.md` / `task.md` are therefore given by
> **section name, not line number** — those files are edited too often for
> line numbers to survive. Code and `.claude/` rule files keep line numbers.

## Facts

| # | Invariant | Enforcement | Why it exists / what breaks |
|---|---|---|---|
| 1 | `withRetry` must wrap DB queries | **enforced-in-rule-file**: `.claude/rules/api-validation.md:5` (path-scoped to `packages/web/src/api/**`); also `AGENTS.md`「製品コードの不変条件」. Named in the post-compaction reminder (`.claude/settings.json:99`). Not checked by the hook. | Turso/libSQL connections transiently throw `ECONNRESET` / "socket connection was closed"; the wrapper (`packages/web/src/api/database/libsql.ts:34-50`) exists to survive these. |
| 2 | 4-place settings sync (`SETTINGS_PREVIEW_KEYS` / `GET /settings` defaults / `provider.tsx` DB-apply useEffect / `provider.tsx` `handlePreviewMessage`) | **enforced-in-rule-file**: `.claude/rules/react-components.md:17-22`; also `AGENTS.md`「製品コードの不変条件」and `.claude/settings.json:99`. | A key missing from any of the 4 saves correctly but silently fails to live-preview. See admin-settings.md. **Corrected 2026-08-20:** the old note that "AGENTS.md is internally inconsistent (3-place vs 4-place)" is no longer true — AGENTS.md now states 4 places once, with the canonical list. |
| 3 | `assertOk` / `jsonOrThrow` on write API responses | **enforced-in-rule-file**: `.claude/rules/api-client.md:7-14` (path-scoped to `packages/web/src/web/**`); also `AGENTS.md`「製品コードの不変条件」. **Corrected 2026-08-20:** previously cited to `api-validation.md:7`, which is actually the `{ error: string }` rule — wrong file. | Silent write failures otherwise go unnoticed. Two further parts are easy to miss: settings writes must go through `postAdminSettings()` (plain `assertOk` cannot see `ignoredKeys`), and response checking alone throws without ever reaching the screen, so an `onError` / try-catch path is also required. |
| 4 | No manual `Content-Encoding` header | **enforced-in-hook**: `.claude/hooks/protect-invariants.sh:8-13` greps Edit/Write payloads for "content-encoding" (case-insensitive, skips `.md`/`.txt`/`.sh`) and exits 2, blocking the call; wired at `.claude/settings.json:59-68` as PreToolUse on Edit\|Write. | Railway's proxy handles compression; a manual header double-compresses and breaks the response in-browser. |
| 5 | Dual `schema.ts` + `schema.postgres.ts` sync | **enforced-in-rule-file**: `.claude/rules/db-migrations.md:12` (path-scoped); also `AGENTS.md`「製品コードの不変条件」, `DISTRIBUTION.md`. Additionally **enforced-in-CI-gate** since `bun run check:postgres-schema` compares schema, migration snapshot and SQL on every `bun run check`. | SQLite/libSQL and PostgreSQL types differ (`integer({mode:"boolean"})` ↔ `boolean()`). Forgetting the Postgres side breaks only the **distribution template**, not akieguchi.com — easy to miss. See database.md. |
| 6 | `invalidateQueries` after mutations | **enforced-in-rule-file**: `.claude/rules/react-components.md:15`; also `AGENTS.md`「製品コードの不変条件」(as「データ更新後は該当queryを再取得」), `.claude/skills/gallery-feature/SKILL.md:76`. | Without it TanStack Query serves stale cached data after a write. |
| 7 | Never run `git add .` / `git add -A` | **enforced-in-settings** (upgraded since 2026-07-02): `.claude/settings.json:22` denies `Bash(git add -A)` outright, so the call is refused rather than merely discouraged. `AGENTS.md`「絶対に越えない境界」states the intent（未追跡ファイルを内容を確認せず一括追加しない）. **Corrected 2026-08-20:** the old claim that AGENTS.md's own deploy steps use `git add -A` is false — AGENTS.md contains no `git add` at all. | Stops a blanket add from staging untracked scratch files. `.gitignore:75-76` covers the `test-*.mjs` case specifically. |
| 8 | Never commit `.env` | **enforced-in-hook** (as a superset — blocks *editing* `.env` at all): `.claude/hooks/protect-invariants.sh:16-19` blocks any Edit/Write whose path matches `/\.env($\|\.)/`. Ignored via `.gitignore:26`. `AGENTS.md`「絶対に越えない境界」forbids showing, recording or committing `.env` values. | Keeps `DATABASE_URL`, S3 keys and `ADMIN_PASSWORD` out of git history; env vars live in the Railway dashboard. |
| 9 | No scratch `test-*.mjs` committed | **enforced-in-gitignore**: `.gitignore:75-76` (`/test-*.mjs`, `/packages/web/test-*.mjs`). **Corrected 2026-08-20:** the prose rule that used to live in CLAUDE.md is gone, and the cited `.gitignore:59-66` range was wrong. Re-measured this date: **no such file exists on disk and none was ever committed.** | These were scratch Playwright scripts, several with hardcoded admin-password strings. One such password string does survive in `docs/archive/task-handoffs.md` — see open-issues.md. |
| 10 | Never run `bun run deploy` | **structurally enforced**: `package.json` defines no `deploy` script (only `deploy:runable:legacy`), so the command cannot run. Documented at `.claude/skills/deploy/SKILL.md:52`. Additionally `.claude/settings.json:26` denies `Bash(bun run deploy*)`. | It used to trigger the legacy Runable ZIP publish, superseded by Railway git-push deploy on 2026-06-16 — see deployment.md. |
| 11 | Comments explain WHY, not WHAT | **not-found (changed 2026-08-20)**: no longer stated in `CLAUDE.md`, `AGENTS.md`, any `.claude/rules/*.md`, or the hook. It survives only as de-facto practice in the codebase. | Previously cited to CLAUDE.md/AGENTS.md line numbers that no longer exist. Whether to restore it is an owner decision — see Open Questions. |
| 12 | Frontend never touches the DB directly | **enforced-in-rule-file (indirectly)**: `.claude/rules/api-client.md:5` requires the typed client and forbids raw `fetch` from the frontend, which closes the same path. **Corrected 2026-08-20:** the direct statement that used to be in CLAUDE.md/AGENTS.md is gone. | All DB access must go through `/api/*`. |
| 13 | Frontend uses the `lib/api.ts` typed client | **enforced-in-rule-file**: `.claude/rules/api-client.md:5` (path-scoped to `packages/web/src/web/**`). **Corrected 2026-08-20:** previously cited to `api-validation.md:11`, which is actually the `POST /admin/settings` allowlist rule — wrong file. | Keeps request/response types in sync with the Hono `AppType`; a raw `fetch` bypasses that. Note `AppType` inference is already at TypeScript's instantiation limit for the admin subtree (`lib/api.ts:31-39`). |

**Removed 2026-08-20 — the "14th, structural check" that used to be listed
here does not exist.** The old note claimed `.claude/settings.json` wired a
Stop hook of type `prompt` asking the model to confirm `bun typecheck` ran.
The Stop hook is `credit-status.mjs` and there is no `prompt`-type hook
anywhere in the file. What does exist is the **post-compaction reminder**
(`.claude/settings.json:99`), a `SessionStart` hook with matcher `compact`
that re-states invariants 1, 2, 3, 4 and 5 and reminds the model to run
`tsc -b`.

## Assumptions

- Invariant 1's "class of operations" is inferred to mean "DB queries inside
  API route handlers," from `api-validation.md`'s path scoping
  (`packages/web/src/api/**`) — no doc states a narrower/broader class
  explicitly.
- The WHY for invariants 7–10 (git add ., .env, test-*.mjs, bun run deploy)
  is assembled from parenthetical hints and the deny entries in
  `.claude/settings.json`, not from an explicit "why" sentence. The old
  version of this bullet cited `task.md`, which no longer carries that
  history (it holds only the Current State block; the history moved to
  `docs/archive/task-handoffs.md`).

## Open Questions

- **Invariants 11 and 12 lost their written home.** Both used to be stated in
  `CLAUDE.md`/`AGENTS.md`; neither is any more. #12 is still closed in
  practice by `api-client.md`'s no-raw-`fetch` rule, but #11 (comments explain
  WHY) is now written down nowhere. Should it be restored to a rule file, or
  dropped from the list of 13?
- Is invariant #7 still meant as a general prohibition now that
  `.claude/settings.json` denies `git add -A` mechanically and `.gitignore`
  covers the `test-*.mjs` case? The deny entry makes the prose redundant.
- Rule/hook content references invariants **not** in this list of 13:
  append-only migrations and no direct remote DDL
  (`.claude/rules/db-migrations.md:8,16`), mandatory `Cache-Control: no-store`
  on HTML (`AGENTS.md`), the sharp encoding spec
  (`.claude/rules/r2-upload.md`), "don't break the Lightbox" and the fixed
  12-value gallery layout list (`.claude/rules/react-components.md:11,13`),
  the hook's `.env`-edit block being broader than "don't commit", and the
  visible-error-path requirement (`api-client.md:14`). Should the list of 13
  be expanded?
- The gallery layout list is now **12 values**, not the 9 this page's original
  audit brief assumed (`react-components.md:13`, expanded 2026-07-09 and
  2026-07-12/13).

## Sources

- CLAUDE.md (§0 Invariants section)
- AGENTS.md (§0 section, admin implementation-rules section)
- .claude/rules/api-client.md
- .claude/rules/api-validation.md
- .claude/rules/db-migrations.md
- .claude/rules/no-manual-encoding.md
- .claude/rules/r2-upload.md
- .claude/rules/react-components.md
- .claude/hooks/protect-invariants.sh
- .claude/settings.json
- packages/web/src/api/database/libsql.ts
- .gitignore
- package.json (scripts)
