# Photographer Portfolio

Editorial photography portfolio app built with Bun, Hono, React 19, Drizzle,
Turso/libSQL, Cloudflare R2, and Railway.

This repository currently powers `akieguchi.com`. A repository means the full
set of files needed to run the site. We are preparing it to become a reusable
portfolio template for other photographers. The distribution roadmap lives in
[DISTRIBUTION.md](./DISTRIBUTION.md).

## Status

- Production app: yes, deployed through Railway from `git push`.
- Turnkey template: not yet.
- Recommended distribution model for now: one site-file copy and one separate
  Railway/Turso/R2 setup per photographer.
- SaaS/multi-tenant mode: intentionally out of scope until the template flow is
  stable.

## Deploy on Railway (distribution template)

The distribution version runs entirely on Railway — PostgreSQL and a Storage
bucket replace Turso and R2, so a photographer only needs one Railway account.
The application code is the same; the database/storage backend is selected at
runtime with `DATABASE_PROVIDER=postgres` (unset keeps the original
Turso/libSQL + R2 setup that powers `akieguchi.com`).

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/template/<YOUR_TEMPLATE_ID>)

> **Maintainer note:** the one-click button needs a published Railway template.
> Create it once in the Railway dashboard (New Project → this repo → add a
> **PostgreSQL** plugin and a **Storage** bucket → set the variables below →
> *Save as Template*), then replace `<YOUR_TEMPLATE_ID>` above with the template
> id Railway gives you. `railway.json` already pins the build/start/healthcheck,
> so the service builds with no manual Root Directory or Start Command config.

### Template variables

| Variable | Value / source |
| --- | --- |
| `DATABASE_PROVIDER` | `postgres` (selects the PostgreSQL + Storage backend) |
| `DATABASE_URL` | reference the Railway PostgreSQL plugin's `DATABASE_URL` |
| `ADMIN_PASSWORD` | the photographer's admin login password |
| `S3_ENDPOINT` | the Railway Storage bucket endpoint |
| `S3_BUCKET` | the Railway Storage bucket name |
| `S3_ACCESS_KEY_ID` | Storage bucket access key |
| `S3_SECRET_ACCESS_KEY` | Storage bucket secret |
| `S3_FORCE_PATH_STYLE` | `true` (Railway Storage uses path-style addressing) |
| `S3_REGION` | the region Railway Storage reports (e.g. `us-east-1`) |
| `SITE_URL` | the site's public origin once the domain is attached (optional) |

### One-time database setup

The schema is not auto-applied on deploy. After the first deploy, apply the
PostgreSQL migration once (Railway service shell, or locally against the public
URL — see note below):

```sh
cd packages/web
bun --env-file=../../.env x drizzle-kit migrate --config=drizzle.postgres.config.ts
```

> **`DATABASE_URL` vs `DATABASE_PUBLIC_URL`:** inside Railway, services reach
> PostgreSQL over the private `*.railway.internal` host — correct for the running
> app. To connect *from your own machine* (running the migration, debugging),
> use the **public** URL instead: Railway PostgreSQL → Variables →
> `DATABASE_PUBLIC_URL` (a `*.proxy.rlwy.net:PORT` host). If a connection is
> refused, append `?sslmode=require`. Never hard-code either URL — keep it in a
> gitignored `.env` file.

## Stack

| Layer | Technology |
| --- | --- |
| Runtime | Bun |
| API | Hono 4 under `/api` |
| Frontend | React 19, Wouter, TanStack Query, Tailwind CSS 4 |
| Database | Drizzle ORM + Turso/libSQL |
| Storage | Cloudflare R2, S3-compatible |
| Image processing | sharp |
| Deploy | Railway, `bun src/server.ts` |

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

For the setup side, see [docs/setup-guide.md](./docs/setup-guide.md).
For the photographer receiving the site, see
[docs/photographer-guide.md](./docs/photographer-guide.md).
