# Photographer Portfolio

Editorial photography portfolio app built with Bun, Hono, React 19, Drizzle,
Turso/libSQL, Cloudflare R2, and Railway.

This repository currently powers `akieguchi.com`. We are preparing it to become
a reusable portfolio template for other photographers. The distribution roadmap
lives in [DISTRIBUTION.md](./DISTRIBUTION.md).

## Status

- Production app: yes, deployed through Railway from `git push`.
- Turnkey template: not yet.
- Recommended distribution model for now: one repository fork and one separate
  Railway/Turso/R2 environment per photographer.
- SaaS/multi-tenant mode: intentionally out of scope until the template flow is
  stable.

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

Fill `.env` with a Turso database, an R2 bucket, and an admin password. Then
sync the database schema:

```sh
cd packages/web
bun run db:push
```

Run the development server from the repository root:

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

For the practical handoff flow, see [docs/recipient-setup.md](./docs/recipient-setup.md).
