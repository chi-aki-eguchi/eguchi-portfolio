---
title: The 13 Project Invariants
status: current
last_verified: 2026-07-02
sources:
  - CLAUDE.md
  - AGENTS.md
  - .claude/rules/api-validation.md
  - .claude/rules/db-migrations.md
  - .claude/rules/no-manual-encoding.md
  - .claude/rules/r2-upload.md
  - .claude/rules/react-components.md
  - .claude/hooks/protect-invariants.sh
  - .claude/settings.json
  - packages/web/src/api/database/libsql.ts
  - .gitignore
  - task.md
---

> ⚠️ This wiki is an index/summary layer, NOT the source of truth. If this
> page conflicts with the source documents listed under Sources, the sources
> win. See ../WIKI_SCHEMA.md.

This page tracks the 13 project invariants named in the audit brief, where
each is documented, and whether it's mechanically enforced or just written
down. See open-issues.md for the drift found between documents while
compiling this.

## Facts

| # | Invariant | Enforcement | Why it exists / what breaks |
|---|---|---|---|
| 1 | `withRetry` must wrap DB queries | **enforced-in-rule-file**: `.claude/rules/api-validation.md:5` (path-scoped to `packages/web/src/api/**`); also CLAUDE.md:68, AGENTS.md:17 | Turso/libSQL connections transiently throw `ECONNRESET`/"socket connection was closed"/"Failed query"; the actual retry wrapper (`packages/web/src/api/database/libsql.ts:12-26`) exists specifically to survive these. Not checked by the hook. |
| 2 | 4-place settings sync (`SETTINGS_PREVIEW_KEYS` / `GET /settings` defaults / `provider.tsx` DB-apply useEffect / `provider.tsx` `handlePreviewMessage`) | **enforced-in-rule-file**: `.claude/rules/react-components.md:16-20`; also CLAUDE.md:69-73, echoed in `.claude/settings.json:52`'s SessionStart reminder | A new settings key that's missing from any of the 4 places will save correctly but silently fail to live-preview or fail the ledger test (`settings-preview.test.ts`). See admin-settings.md for full mechanics — **and note AGENTS.md itself is internally inconsistent about this rule**, see open-issues.md. |
| 3 | `assertOk` on all write API responses | **enforced-in-rule-file**: `.claude/rules/api-validation.md:7`; also CLAUDE.md:74, AGENTS.md:19,192 | Silent failures on writes otherwise go unnoticed in the UI. |
| 4 | No manual `Content-Encoding` header | **enforced-in-hook**: `.claude/hooks/protect-invariants.sh:6-13` greps Edit/Write payloads for "content-encoding" (case-insensitive, skips .md/.txt/.sh) and exits 2 (blocks the tool call); wired via `.claude/settings.json:14-24` PreToolUse on Edit\|Write | Railway's proxy auto-handles compression; a manual header causes double-compression that breaks the response in-browser. |
| 5 | Dual `schema.ts` + `schema.postgres.ts` sync | **enforced-in-rule-file**: `.claude/rules/db-migrations.md:12` (path-scoped to `**/schema.ts`, `**/schema.postgres.ts`, `**/drizzle/**`, `**/*.sql`); also CLAUDE.md:76, AGENTS.md:194-200, DISTRIBUTION.md:348-372 | SQLite/libSQL and PostgreSQL column types differ (`integer({mode:"boolean"})` ↔ `boolean()`, etc). Forgetting the Postgres side only breaks the **distribution template** build, not akieguchi.com production — easy to miss. See database.md. |
| 6 | `invalidateQueries` after mutations | **enforced-in-rule-file**: `.claude/rules/react-components.md:14`; also CLAUDE.md:77, AGENTS.md:191, `.claude/skills/gallery-feature/SKILL.md:71` | Without it, TanStack Query serves stale cached data after a write. |
| 7 | Never run `git add .` | **mentioned-in-CLAUDE-or-AGENTS-only**: only inside CLAUDE.md:134's `test-*.mjs` bullet. **Absent from AGENTS.md**, whose own deploy steps (AGENTS.md:133) literally use `git add -A`. Not in any `.claude/rules/*.md` and not checked by the hook. | Intent appears to be "don't let a blanket add slurp scratch `test-*.mjs` scripts that may contain the admin password" — but `.gitignore:59-66` already ignores those files, so a plain `git add -A` wouldn't stage them anyway. See open-issues.md. |
| 8 | Never commit `.env` | **enforced-in-hook** (as a superset — blocks *editing* `.env` at all): `.claude/hooks/protect-invariants.sh:15-19` blocks any Edit/Write matching `/\.env($\|\.)/`. The literal "never commit" phrasing itself is only in `.gitignore:26` ("絶対にコミットしない"), not CLAUDE.md/AGENTS.md directly. | Prevents secrets (`DATABASE_URL`, S3 keys, `ADMIN_PASSWORD`) from reaching git history; env vars are managed via the Railway dashboard instead. |
| 9 | No scratch `test-*.mjs` committed | **mentioned-in-CLAUDE-or-AGENTS-only**: CLAUDE.md:134 only. Reinforced (not "enforced" per the given buckets) by `.gitignore:59-66`'s `/test-*.mjs` etc. patterns. | These are scratch Playwright/debug scripts, several containing hardcoded admin-password strings while being iterated on. |
| 10 | Never run `bun run deploy` | **not-found** relative to CLAUDE.md/AGENTS.md/`.claude/rules/*`/hook (none mention it). Documented only in `.claude/skills/deploy/SKILL.md:55`, and structurally enforced because `package.json` no longer defines a `deploy` script (only `deploy:runable:legacy`). | `bun run deploy` used to trigger the legacy Runable ZIP publish flow, superseded by Railway git-push deploy on 2026-06-16 — see deployment.md. |
| 11 | Comments explain WHY, not WHAT | **mentioned-in-CLAUDE-or-AGENTS-only**: CLAUDE.md:81 ("WHY のみ"), AGENTS.md:269 (narrower: only when the WHY is non-obvious). Not in any rule file or the hook. | Standard code-hygiene rule; no stated rationale beyond this in the docs. |
| 12 | Frontend never touches the DB directly | **mentioned-in-CLAUDE-or-AGENTS-only**: CLAUDE.md:83, AGENTS.md:271. `react-components.md` (the rule file scoped to frontend paths) does not restate it. | All DB access must go through `/api/*`. |
| 13 | Frontend uses the `lib/api.ts` typed client | **enforced-in-rule-file**: `.claude/rules/api-validation.md:11` ("フロントエンドから直接 fetch を呼ばない"); also CLAUDE.md:82, AGENTS.md:270 | Keeps request/response types in sync with the Hono `AppType`; a raw `fetch` call bypasses that safety net. |

- `.claude/settings.json` additionally wires a **Stop hook** (type `prompt`)
  that asks the model to confirm `bun typecheck` ran before ending the
  session — this is a 14th, structural check not in the numbered list above.
  (`.claude/settings.json:57-66`)

## Assumptions

- Invariant 1's "class of operations" is inferred to mean "DB queries inside
  API route handlers," from `api-validation.md`'s path scoping
  (`packages/web/src/api/**`) — no doc states a narrower/broader class
  explicitly.
- The WHY for invariants 7–10 (git add ., .env, test-*.mjs, bun run deploy)
  is assembled from parenthetical hints and `task.md` context rather than a
  single explicit "why" sentence in CLAUDE.md/AGENTS.md.

## Open Questions

- **Genuine drift in AGENTS.md itself** on invariant #2: its own top-level §0
  (AGENTS.md:18) calls the settings pattern "3-place," bundling
  provider.tsx's DB-apply and preview-apply into one item, while its
  admin-specific section (AGENTS.md:201-204) gives yet a *third*, different
  3-item list referencing `admin.tsx`'s `previewPayload` array instead of
  `lib/settings-preview.ts`'s `SETTINGS_PREVIEW_KEYS`. Both disagree with the
  canonical "4-place" list in CLAUDE.md and `.claude/rules/react-components.md`.
  Needs a maintainer decision on which AGENTS.md passage is stale. Logged
  also in open-issues.md.
- Is invariant #7 ("never `git add .`") meant as a general, standalone
  prohibition, or was the real intent narrower (don't let a blanket add
  slurp `test-*.mjs`/secrets) — now arguably moot since `.gitignore` already
  covers those files?
- Rule/hook content found that references invariants **not** in this list of
  13: append-only migrations + no direct remote DDL
  (`.claude/rules/db-migrations.md`), mandatory `Cache-Control: no-store` on
  HTML responses (`.claude/rules/no-manual-encoding.md`, AGENTS.md), sharp
  encoding spec + no-hardcoded-R2-credentials (`.claude/rules/r2-upload.md`),
  "don't break the Lightbox" + fixed 9-value gallery layout list
  (`.claude/rules/react-components.md`), the hook's `.env`-edit block being
  broader than just "don't commit," and the Stop hook's typecheck
  requirement. Worth asking the owner whether the "13 invariants" list
  itself should be expanded.

## Sources

- CLAUDE.md (§0 Invariants section)
- AGENTS.md (§0 section, admin implementation-rules section)
- .claude/rules/api-validation.md
- .claude/rules/db-migrations.md
- .claude/rules/no-manual-encoding.md
- .claude/rules/r2-upload.md
- .claude/rules/react-components.md
- .claude/hooks/protect-invariants.sh
- .claude/settings.json
- packages/web/src/api/database/libsql.ts
- .gitignore
- task.md (line 680, 862-868)
