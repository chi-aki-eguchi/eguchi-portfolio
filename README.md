# Photographer Portfolio

Editorial photography portfolio app built with Bun, Hono, React 19, Drizzle,
Turso/libSQL, Cloudflare R2, and Railway.

This repository currently powers `akieguchi.com`. A repository means the full
set of files needed to run the site. We are preparing it to become a reusable
portfolio template for other photographers. The distribution roadmap lives in
[DISTRIBUTION.md](./DISTRIBUTION.md).

## Status

- Production app: yes, deployed through Railway from `git push`.
- Railway template: published through the Deploy on Railway button below.
- Recommended distribution model for now: one Railway project per photographer
  (web service + PostgreSQL + Storage bucket).
- SaaS/multi-tenant mode: intentionally out of scope until the template flow is
  stable.

## Deploy on Railway (distribution template)

The distribution version runs entirely on Railway — PostgreSQL and a Storage
bucket replace Turso and R2, so a photographer only needs one Railway account.
The application code is the same; the database/storage backend is selected at
runtime with `DATABASE_PROVIDER=postgres` (unset keeps the original
Turso/libSQL + R2 setup that powers `akieguchi.com`).

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/cool-wide)

A non-engineer photographer can run this whole flow themselves — from clicking the
button to uploading the first photo. The step-by-step, jargon-free walkthrough is
[docs/post-deploy-guide.md](./docs/post-deploy-guide.md).

> **Maintainer note:** the published template lives at
> <https://railway.com/deploy/cool-wide>. There is **no `railway.json` on `main`**
> — it is omitted on purpose so it cannot override production `akieguchi.com`'s
> Railway deploy settings. Because of that, the template's web service must set
> these explicitly in its Railway service config (the repo root `start` script is
> pm2 and is **not** the Railway start command):
>
> - **Start Command:** `bun packages/web/src/server.ts`
> - **Healthcheck Path:** `/api/health`
> - **`ADMIN_PASSWORD` variable:** in the Railway **template composer → Variables**,
>   leave this with **no default value** (empty/required) so each deployer types
>   their own password on the deploy form. If the template ever shows a baked-in
>   default such as `test-pass`, remove it — a shipped default means every install
>   shares one known admin password. Do **not** use `${{ secret() }}` for it
>   either: the photographer must know the value to log in. A short description
>   like "管理画面のログインパスワード（あなたが決める）" helps the deployer.
>
> When updating the template, re-deploy it once into a throwaway project and
> confirm the build → migrate → `/api/health` flow before sharing the link.

### Template variables

| Variable | Value / source |
| --- | --- |
| `DATABASE_PROVIDER` | `postgres` (selects the PostgreSQL + Storage backend) |
| `DATABASE_PUBLIC_URL` | reference the Railway PostgreSQL plugin's `DATABASE_PUBLIC_URL` |
| `DATABASE_URL` | optional fallback; use `DATABASE_PUBLIC_URL` for the template |
| `ADMIN_PASSWORD` | **Required — no default.** The admin login password the deployer types on the deploy form (8+ chars, hard to guess). Never ship a shared default like `test-pass`; each install must set its own. Do not auto-generate it either — the photographer needs to know the value to log in. |
| `S3_ENDPOINT` | the Railway Storage bucket endpoint |
| `S3_BUCKET` | the Railway Storage bucket name |
| `S3_ACCESS_KEY_ID` | Storage bucket access key |
| `S3_SECRET_ACCESS_KEY` | Storage bucket secret |
| `S3_FORCE_PATH_STYLE` | `true` (Railway Storage uses path-style addressing) |
| `S3_REGION` | the region Railway Storage reports (e.g. `us-east-1`) |
| `SITE_URL` | the site's public origin once the domain is attached (optional) |

### Database setup — automatic

No manual migration step is needed. When `DATABASE_PROVIDER=postgres`, the
server applies the PostgreSQL migrations on startup (`runStartupMigrations()` in
`src/api/database/migrate.ts`), so a freshly deployed empty database gets its
tables on the first boot. The migrator tracks applied migrations in
`drizzle.__drizzle_migrations`, so restarts and redeploys are idempotent. If a
migration fails (e.g. the database is unreachable) the server exits instead of
serving a broken site, and Railway keeps the previous version running — check
the deploy logs for the `[migrate]` lines.

The original Turso/libSQL setup (production `akieguchi.com`, `DATABASE_PROVIDER`
unset) is untouched by the PostgreSQL migrator. On that path,
`runStartupMigrations()` only runs `ensureTursoColumns()` to add a small set of
known legacy columns if missing; it does not run Drizzle migrations.

> **PostgreSQL URL choice:** the template uses Railway PostgreSQL's
> `DATABASE_PUBLIC_URL` (`*.proxy.rlwy.net:PORT`) because it is the most reliable
> path for one-click installs and local debugging. Railway's private
> `DATABASE_URL` (`*.railway.internal`) remains supported as a fallback, but it
> can be more sensitive to runtime/library networking details. Keep either value
> in Railway variables or a gitignored `.env` file, never hard-coded.
>
> Manual apply (rarely needed — e.g. inspecting an existing DB locally):
>
> ```sh
> cd packages/web
> bun --env-file=../../.env x drizzle-kit migrate --config=drizzle.postgres.config.ts
> ```

## Stack

| Layer | Technology |
| --- | --- |
| Runtime | Bun |
| API | Hono 4 under `/api` |
| Frontend | React 19, Wouter, TanStack Query, Tailwind CSS 4 |
| Database | Drizzle ORM + Turso/libSQL (prod) or PostgreSQL (distribution template) |
| Storage | Cloudflare R2 (prod) or Railway Storage (distribution), S3-compatible |
| Image processing | sharp (upload: 3200px/mozjpeg q92, serve: on-the-fly resize with LRU cache) |
| Deploy | Railway (`git push` auto-deploy) |
| Security | CSP (report-only), HSTS, rate-limited login, MIME whitelist, path traversal guard |

## Local Setup

```sh
bun install
cp .env.template .env
```

Fill `.env` with a Turso database (where settings are stored), an R2 bucket
(where photos are stored), and an admin password. Then sync the database schema:

```sh
cd packages/web
bun run db:push
```

Run the development server from the site folder:

```sh
bun run dev
```

For working on the same project from both a MacBook and a Mac mini, use GitHub
as the source of truth for code and keep secrets local to each machine. The
recommended day-to-day workflow is documented in
[docs/two-mac-workflow.md](./docs/two-mac-workflow.md).

## Required Environment Variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Turso/libSQL database URL |
| `DATABASE_AUTH_TOKEN` | Turso auth token |
| `S3_ENDPOINT` | Cloudflare R2 S3 endpoint |
| `S3_BUCKET` | R2 bucket name |
| `S3_ACCESS_KEY_ID` | R2 access key |
| `S3_SECRET_ACCESS_KEY` | R2 secret |
| `ADMIN_PASSWORD` | Enables `/admin` login |
| `SITE_URL` | Public origin for canonical URLs, sitemap, OGP, and JSON-LD |

## Development Commands

```sh
bun run dev
cd packages/web && bun x tsc -b
cd packages/web && bun run build
cd packages/web && bun test ./src
```

## Deploy

The current production workflow is Railway:

```sh
cd packages/web && bun x tsc -b && bun run build
git push
```

Railway builds from the pushed commit and starts the app with
`bun src/server.ts`. The old Runable ZIP flow is legacy only and is kept as
`bun run deploy:runable:legacy` for recovery/reference work.

## Distribution Work

Before this can be safely handed to another photographer, the hard-coded
identity, analytics, allowed origins, setup docs, and first-run defaults need to
be generalized. See [DISTRIBUTION.md](./DISTRIBUTION.md) for the live checklist.

| Document | Audience |
| --- | --- |
| [docs/setup-guide.md](./docs/setup-guide.md) | Engineer setting up the site |
| [docs/post-deploy-guide.md](./docs/post-deploy-guide.md) | Non-engineer deploying via Railway button |
| [docs/photographer-guide.md](./docs/photographer-guide.md) | Photographer receiving the site |
| [docs/admin-guide.md](./docs/admin-guide.md) | Admin panel feature reference |
| [docs/api.md](./docs/api.md) | API endpoint reference |
| [docs/faq.md](./docs/faq.md) | Common questions and stuck points |
