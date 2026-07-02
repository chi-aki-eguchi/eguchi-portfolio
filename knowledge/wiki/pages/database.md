---
title: Database
status: current
last_verified: 2026-07-02
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
  - task.md
---

> ⚠️ This wiki is an index/summary layer, NOT the source of truth. If this
> page conflicts with the source documents listed under Sources, the sources
> win. See ../WIKI_SCHEMA.md.

## Facts

- `DATABASE_PROVIDER` env var selects the backend at runtime via a **dynamic
  import** in `packages/web/src/api/database/index.ts` so the unselected
  driver/schema is never loaded: unset → **Turso/libSQL**
  (`schema.ts`) = akieguchi.com production **[akieguchi-specific]**;
  `DATABASE_PROVIDER=postgres` → **PostgreSQL** (`schema.postgres.ts`) = the
  distribution template path. This is **not** a dev-vs-prod split — it's
  "akieguchi.com prod" vs "distributed-to-other-photographers prod."
  (packages/web/src/api/database/index.ts:1-23)
- `libsql.ts` defines `withRetry(fn, maxRetries=3, delayMs=300)`, retrying on
  `ECONNRESET` / "socket connection was closed" / "Failed query."
  `postgres.ts` has its own, differently-tuned `withRetry` (ECONNRESET /
  ECONNREFUSED / ETIMEDOUT / message contains "connection"/"timeout").
  (packages/web/src/api/database/libsql.ts:1-35; postgres.ts:52-78)
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
  deploy. (packages/web/src/api/database/migrate.ts:1-162, 67-99)
  **DISTRIBUTION.md's "Production (turso) path: returns immediately —
  no-op" claim, and migrate.ts's own top-of-file comment, are both stale
  relative to this code** — see open-issues.md.
- Dual-schema sync is a real, enforced rule
  (`.claude/rules/db-migrations.md`): both `schema.ts` (sqlite-core,
  `integer('id').primaryKey({autoIncrement:true})`, `integer({mode:'boolean'})`,
  `integer({mode:'timestamp'})`) and `schema.postgres.ts` (pg-core,
  `serial()`, `boolean()`, `timestamp()`) must be updated together with
  matching column names. Queries must import `schema` from `./database` (the
  provider-switch boundary), never `schema.ts` directly. Never run
  `DROP TABLE`/`ALTER TABLE` directly against the remote Turso DB.
  (packages/web/src/api/database/schema.ts:4-117; schema.postgres.ts:1-92;
  .claude/rules/db-migrations.md:1-17)
- Two separate Drizzle configs: `drizzle.config.ts` (dialect `turso`, schema
  `schema.ts`, out `./drizzle`) and `drizzle.postgres.config.ts` (dialect
  `postgresql`, schema `schema.postgres.ts`, out `./drizzle-postgres`,
  invoked manually with `--config`, no dedicated npm script).
  (packages/web/drizzle.config.ts:1-9; drizzle.postgres.config.ts:1-9)
- **Migration history gap (Turso side):** `packages/web/drizzle/` only has
  `0000`, `0002`, `0003`, `0004` `.sql` files — **no `0001_*.sql`** exists on
  disk even though `_journal.json` references tag
  `0001_flawless_the_stranger`. Git history shows that `.sql` file was
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
  columns); `0001_woozy_chronomancer.sql` adds the EXIF/rotation columns.
  (packages/web/drizzle-postgres/0000_worried_sentry.sql:1-69;
  0001_woozy_chronomancer.sql:1-9)
- **Documented production incident (Turso, [akieguchi-specific]):**
  `bun run db:push` against the live Turso DB (~474 rows) tried to
  interactively confirm a NOT NULL column addition and hung under a non-TTY
  shell. The team fell back to existence-checked manual `ALTER TABLE`
  statements — this is exactly what `ensureTursoColumns()` now implements
  as a permanent startup safety net. (task.md:2053-2061, cross-referenced
  with migrate.ts:67-94)
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
  default. (task.md:1575-1719, three dated 2026-06-20 handoff entries)

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
- Should `packages/web/drizzle/` be regenerated/squashed to accurately
  reflect `schema.ts` (mirroring how `drizzle-postgres/0000_worried_sentry.sql`
  was generated fresh), or is db:push considered the real mechanism and the
  mismatch accepted?
- DISTRIBUTION.md's and `migrate.ts`'s own comment's "Turso path is a no-op"
  claim needs correcting — see open-issues.md.

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
- DISTRIBUTION.md:320-372
- task.md:1575-1719, 2053-2061
