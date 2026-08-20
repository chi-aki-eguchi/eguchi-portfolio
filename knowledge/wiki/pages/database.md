---
title: Database
status: current
last_verified: 2026-08-20
sources:
  - packages/web/src/api/database/index.ts
  - packages/web/src/api/database/libsql.ts
  - packages/web/src/api/database/postgres.ts
  - packages/web/src/api/database/migrate.ts
  - packages/web/src/api/database/schema.ts
  - packages/web/src/api/database/schema.postgres.ts
  - packages/web/drizzle.config.ts
  - packages/web/drizzle.postgres.config.ts
  - packages/web/drizzle/ (migrations + meta)
  - packages/web/drizzle-postgres/ (migrations + meta)
  - .claude/rules/db-migrations.md
  - DISTRIBUTION.md
  - docs/archive/task-handoffs.md
---

> ⚠️ This wiki is an index/summary layer, NOT the source of truth. If this
> page conflicts with the source documents listed under Sources, the sources
> win. See ../WIKI_SCHEMA.md.

## Facts

> **Re-verified 2026-08-20 against the current tree.** Four facts had gone
> stale, one was subtly wrong from the start, and the `task.md` line citations
> died when `task.md` was reduced to the Current State block (the history is
> now in `docs/archive/task-handoffs.md`).


- `DATABASE_PROVIDER` env var selects the backend at runtime via a **dynamic
  import** in `packages/web/src/api/database/index.ts` so the unselected
  driver/schema is never loaded: unset → **Turso/libSQL**
  (`schema.ts`) = akieguchi.com production **[akieguchi-specific]**;
  `DATABASE_PROVIDER=postgres` → **PostgreSQL** (`schema.postgres.ts`) = the
  distribution template path. This is **not** a dev-vs-prod split — it's
  "akieguchi.com prod" vs "distributed-to-other-photographers prod."
  (packages/web/src/api/database/index.ts:1-22)
- `libsql.ts` defines `withRetry(fn, maxRetries=3, delayMs=300)`. It retries
  only on `ECONNRESET` or "socket connection was closed", and it **walks the
  `err.cause` chain** to find them. **Corrected 2026-08-20:** this page used to
  list `"Failed query"` as a retry trigger. It is the opposite — drizzle-orm
  0.45+ wraps *every* failure in a generic `Failed query: …` message, so that
  string carries no transient/permanent signal and matching on it would retry
  genuine constraint violations. The cause-walk exists precisely because of
  that. (`libsql.ts:16-32` for the predicate, `34-50` for the wrapper;
  `withRetry.test.ts` pins both directions.) `postgres.ts` has its own,
  differently-tuned `withRetry` (ECONNRESET / ECONNREFUSED / ETIMEDOUT /
  message contains "connection"/"timeout"). (postgres.ts:52-78)
- `postgres.ts` prefers `DATABASE_PUBLIC_URL` over `DATABASE_URL`, and for
  Railway hosts strips `sslmode`/`sslcert`/`sslkey`/`sslrootcert` query
  params, using `ssl:{rejectUnauthorized:false}` instead (to avoid a
  `SELF_SIGNED_CERT_IN_CHAIN` conflict between a connection-string sslmode
  and an ssl config object). (packages/web/src/api/database/postgres.ts:1-50)
- `migrate.ts`'s `runStartupMigrations()`: on the **Turso path it is NOT a
  true no-op** — it awaits `ensureTursoColumns()`, which `SELECT`s each of 9
  known-added columns (`focal_length, f_number, exposure_time, iso,
thumb_key, medium_key, rotation_deg, focal_x, focal_y`) and `ALTER TABLE
ADD COLUMN`s any that are missing, on every boot. On the **Postgres path**
  it runs real drizzle migrations with up to 7 retries / increasing backoff,
  and rethrows (→ process exit) on final failure so Railway keeps the prior
  deploy. (packages/web/src/api/database/migrate.ts:68-95, 96-100)
- **The Turso startup safety net covers 16 columns** — everything migrations
  `0003`, `0004` and `0005` added to `photos`. The list is exported as
  `TURSO_SAFETY_NET_COLUMNS`; `ensureColumnsExist()` probes each with a
  `SELECT ... LIMIT 0` and only `ALTER TABLE ADD COLUMN`s the ones that fail,
  so a DB that already has them issues no writes. A failed `ALTER` is logged
  and skipped rather than aborting boot.
  **Gap found and closed 2026-08-20:** it had been stuck at the original **9**
  since July, missing the 7 source-metadata columns from `0005`. akieguchi.com
  production was never affected (measured read-only that date: 36 columns),
  but a Turso DB predating `0005` would have booted without them, and because
  drizzle's `db.select()` names every column, photo fetches would 500 rather
  than degrade. `migrate.test.ts` now pins the list against the migration SQL
  itself, so the next forgotten column fails `bun run check`.
  (`migrate.ts` `TURSO_SAFETY_NET_COLUMNS` / `ensureColumnsExist`;
  `migrate.test.ts`; `scripts/ai/check-prod-photo-columns.mjs`)
  **Resolved 2026-07-07**: DISTRIBUTION.md (§Automatic migrations),
  README.md, migrate.ts's top-of-file comment, and server.ts's call-site
  comment all now describe `ensureTursoColumns()` accurately — see
  open-issues.md item 2.
- Dual-schema sync is a real, enforced rule
  (`.claude/rules/db-migrations.md`): both `schema.ts` (sqlite-core,
  `integer('id').primaryKey({autoIncrement:true})`, `integer({mode:'boolean'})`,
  `integer({mode:'timestamp'})`) and `schema.postgres.ts` (pg-core,
  `serial()`, `boolean()`, `timestamp()`) must be updated together with
  matching column names. Queries must import `schema` from `./database` (the
  provider-switch boundary), never `schema.ts` directly. Never run
  `DROP TABLE`/`ALTER TABLE` directly against the remote Turso DB.
  (packages/web/src/api/database/schema.ts; schema.postgres.ts;
  `.claude/rules/db-migrations.md:8,12,14,16`. Line ranges into the two schema
  files were dropped on 2026-08-20 — they grow with every column and go stale
  immediately.)
- Two separate Drizzle configs: `drizzle.config.ts` (dialect `turso`, schema
  `schema.ts`, out `./drizzle`) and `drizzle.postgres.config.ts` (dialect
  `postgresql`, schema `schema.postgres.ts`, out `./drizzle-postgres`,
  invoked manually with `--config`, no dedicated npm script).
  (packages/web/drizzle.config.ts:1-9; drizzle.postgres.config.ts:1-9)
- **Migration history gap (Turso side):** `packages/web/drizzle/` has
  `0000`, `0002`, `0003`, `0004` and `0005` `.sql` files — **no `0001_*.sql`**
  exists on disk even though `_journal.json` references tag
  `0001_flawless_the_stranger` (6 journal entries, 5 files; re-counted
  2026-08-20 — `0005_mysterious_madame_masque.sql` was added on 2026-07-28
  and is not part of the gap). Git history shows that `.sql` file was
  **never committed**; only its `meta/0001_snapshot.json` survives (and it
  only adds `display_size`/`deleted_at` — nothing else). None of
  `0000`–`0004` ever creates the `series`/`pricing_plans` tables or adds
  `camera/lens/film_type/shot_at/is_published/series_id/width/height/file_hash`
  to `photos`, even though these all exist in the current `schema.ts` today —
  strongly implying that schema evolution was pushed to the live Turso DB via
  `bun run db:push` (schema-diff apply) rather than ever captured with
  `db:generate`. (packages/web/drizzle/meta/_journal.json:12-18;
  meta/0001_snapshot.json:86-178 vs schema.ts:4-117; git log --all for the
  missing filename returns nothing)
- The **Postgres side has no such gap**: `drizzle-postgres/0000_worried_sentry.sql`
  was generated fresh from the already-evolved `schema.postgres.ts` and
  already contains the full current shape (series, pricing_plans, all photo
  columns); `0001_woozy_chronomancer.sql` adds the EXIF/rotation columns and
  `0002_add_photo_source_metadata.sql` (added 2026-08-14, `c2e8f4c`) adds the
  same 7 source-metadata columns as Turso's `0005`. Unlike the Turso path,
  this side **is** covered by a gate: `bun run check:postgres-schema` compares
  schema, migration snapshot and SQL on every `bun run check`.
- **Documented production incident (Turso, [akieguchi-specific]):**
  `bun run db:push` against the live Turso DB (~474 rows) tried to
  interactively confirm a NOT NULL column addition and hung under a non-TTY
  shell. The team fell back to existence-checked manual `ALTER TABLE`
  statements — this is exactly what `ensureTursoColumns()` now implements
  as a permanent startup safety net. (`docs/archive/task-handoffs.md`, the
  db:push incident entry; cross-referenced with `migrate.ts:68-95`.
  **Citation repointed 2026-08-20:** `task.md` now holds only the Current
  State block, so the old line numbers pointed at nothing.)
- **Documented production incidents (Postgres/distribution template):** a
  chain of Railway startup-migration failures — (1) `CREATE SCHEMA drizzle`
  failing before `/api/health` was reachable → retry/backoff + diagnostic
  logging added; (2) `ERR_POSTGRES_CONNECTION_CLOSED` against
  `*.railway.internal`, attributed to the driver connecting without SSL →
  fixed with an app-side `sslmode=require` auto-append; (3) that fix didn't
  fully resolve it, so the driver was swapped entirely from
  `drizzle-orm/bun-sql` to `drizzle-orm/node-postgres` + `pg`, with explicit
  stripping of ssl-related query params; (4) even after the driver swap, the
  `*.railway.internal` path still failed in real deploys, so the policy
  changed to prefer `DATABASE_PUBLIC_URL` (Railway's public TCP proxy) by
  default. (`docs/archive/task-handoffs.md`, three dated 2026-06-20 handoff
  entries. **Citation repointed 2026-08-20** for the same reason.)

## Assumptions

- The missing `0001_flawless_the_stranger.sql` and the large set of
  undocumented column/table additions were applied to live Turso via
  `db:push` rather than a generated-and-replayed migration — inferred from
  the drizzle/ folder contents and task.md's db:push discussion, not from an
  explicit task.md note calling out this specific gap.

## Open Questions

- Was `0001_flawless_the_stranger.sql` ever generated/applied locally and
  then deleted before the initial commit, or did `db:generate` never run for
  that change at all?
- Is `bun run db:migrate` (drizzle-kit migrate) ever actually run against
  production, or is `db:push` the only real mechanism for the Turso side? If
  `db:migrate` were run today, the missing `0001` file plus untracked
  columns/tables would likely cause it to diverge from the live schema.
- **Note (2026-08-20):** the safety net covers what `0003`–`0005` added, but
  **not** the two columns from the missing `0001` (`display_size`,
  `deleted_at`). A DB old enough to lack those predates every migration on
  disk, so `db:push` is the only realistic route for it anyway — but if that
  assumption is ever wrong, those two are the remaining hole.
- Should `packages/web/drizzle/` be regenerated/squashed to accurately
  reflect `schema.ts` (mirroring how `drizzle-postgres/0000_worried_sentry.sql`
  was generated fresh), or is db:push considered the real mechanism and the
  mismatch accepted?
- ~~DISTRIBUTION.md's and `migrate.ts`'s own comment's "Turso path is a
  no-op" claim needs correcting~~ — resolved 2026-07-07 (all four places
  corrected; see open-issues.md item 2).

## Sources

- packages/web/src/api/database/index.ts
- packages/web/src/api/database/libsql.ts
- packages/web/src/api/database/postgres.ts
- packages/web/src/api/database/migrate.ts
- packages/web/src/api/database/schema.ts
- packages/web/src/api/database/schema.postgres.ts
- packages/web/src/api/database/withRetry.test.ts
- packages/web/drizzle.config.ts, drizzle.postgres.config.ts
- packages/web/drizzle/ (0000-0004.sql, meta/_journal.json, meta/0001_snapshot.json)
- packages/web/drizzle-postgres/ (0000_worried_sentry.sql, 0001_woozy_chronomancer.sql, meta/_journal.json)
- .claude/rules/db-migrations.md
- DISTRIBUTION.md (§Automatic migrations on startup, line 348)
- docs/archive/task-handoffs.md
- scripts/ai/check-prod-photo-columns.mjs
