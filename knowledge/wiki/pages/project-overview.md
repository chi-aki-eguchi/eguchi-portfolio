---
title: Project Overview
status: current
last_verified: 2026-07-02
sources:
  - package.json
  - packages/web/package.json
  - README.md
  - turbo.json
  - tsconfig.json
  - CLAUDE.md
  - AGENTS.md
  - task.md
  - packages/web/src (directory structure)
---

> ⚠️ This wiki is an index/summary layer, NOT the source of truth. If this
> page conflicts with the source documents listed under Sources, the sources
> win. See ../WIKI_SCHEMA.md.

## Facts

- This repo is a photographer's portfolio + sales website. It currently
  powers the production site **akieguchi.com** **[akieguchi-specific]**, and
  is being incrementally generalized into a reusable template other
  photographers can deploy (not yet fully turnkey). (README.md:1-18)
- Bun-based monorepo (Bun workspaces + Turborepo), one active package:
  `packages/web` (root `package.json`: workspaces `["packages/*"]`;
  `packages/web/package.json` name `@template/web`). AGENTS.md notes
  `packages/mobile/` and `packages/desktop/` template leftovers were deleted
  in 2026-06 — only `web` remains. (package.json:1-10; AGENTS.md:282)
- Root `package.json` name is still **`sandbox-app-template`** — a known,
  not-yet-renamed template leftover (see distribution.md). (package.json:2)
- Stack: Bun runtime, Hono 4 API (under `/api`), React 19 SPA frontend
  (Wouter routing, TanStack Query, Tailwind CSS 4), Drizzle ORM over
  Turso/libSQL (production) or PostgreSQL (distribution template), Cloudflare
  R2 (production) or Railway Storage (distribution) for object storage,
  sharp for image processing, deployed to Railway via `git push`.
  (README.md:98-109)
- **Repository boundary — absolute:** this repo must never be mixed with a
  separate repository called **"Ivy's House" (ivys-house)**, a different,
  Astro-based site. AGENTS.md states this as an explicit, repeated
  prohibition — no file copying, imports, or code references between the two
  repos. (AGENTS.md:3, AGENTS.md "リポジトリ境界（絶対禁止）" section)
  **[akieguchi-specific — this rule exists because both are personal sites by
  the same owner, built on different stacks.]**
- Key file map (`packages/web/src/`):
  - `api/index.ts` — Hono routes, `AppType` export
  - `api/database/index.ts` — DB driver switch (Turso vs Postgres) + `schema.ts`
  - `server.ts` — Bun.serve entry, OGP injection
  - `web/app.tsx` — Wouter routing
  - `web/pages/` — top, gallery, series, profile, contact, service, admin,
    admin-login
  - `web/components/` — Layout, Lightbox, PhotoGallery, SeriesGrid, provider,
    Picture, ErrorBoundary
  - `web/lib/api.ts` — typed Hono API client (the only sanctioned way the
    frontend talks to the backend — see invariants.md)
  - `shared/` — `site-title.ts`, `image-url.ts` (cross-cutting helpers used
    by both api/ and web/)
  (AGENTS.md:56-78; directory listings of packages/web/src, src/api, src/web)
- Routing: `/` (top, hero + latest works), `/gallery` (category filter +
  masonry grid), `/about`/`/profile`, `/contact`, `/service` (sales page —
  see service-page.md), `/admin/login`, `/admin`, `/api/*` (Hono API),
  `/api/images/:key?w=&q=` (R2 image proxy with on-the-fly resize).
  (AGENTS.md:157-168)
- DB schema (high level): `photos`, `categories`, `hero_photos`,
  `site_settings` (key-value), plus `series` and `pricing_plans` — see
  database.md for the full dual-schema story. (AGENTS.md:88-93)
- `task.md` contains the actively maintained Current State block; historical
  work logs and Handoffs are kept in `docs/archive/task-handoffs.md`. Recent
  entries (2026-06-29 through
  2026-07-01) are authored by "Codex" per the dual-agent (Claude Code +
  Codex) workflow documented in CLAUDE.md/AGENTS.md, and cover SNS
  card/content-type fixes, `/service` pricing CTA fixes, and admin
  Library/Inspector improvements. (historical Handoffs in
  `docs/archive/task-handoffs.md`)
- docs/ folder audience split per README.md: `docs/setup-guide.md`
  (engineer setup), `docs/post-deploy-guide.md` (non-engineer Railway-button
  deploy), `docs/photographer-guide.md`, `docs/admin-guide.md`,
  `docs/api.md`, `docs/faq.md`; `DISTRIBUTION.md` is the live
  template-generalization checklist. (README.md:172-186)

## Assumptions

- The separate "ivys-house" repository itself was not opened during this
  audit (it's a different local/remote repo, out of scope); its Astro-based
  nature is known only from AGENTS.md's description.
- `task.md`'s attribution of recent entries to "Codex" reflects the
  documented dual-AI (Claude Code + Codex) agmsg workflow, not independently
  verified beyond reading the handoff text itself.

## Open Questions

- Are there any akieguchi.com-specific hard-coded values still in
  `packages/web/src/api/site-defaults.ts` or `web/lib/site-fallbacks.ts` that
  would need to be swapped out for another photographer's template
  deployment? (See distribution.md P0 checklist.)
- Is there a separate `ivys-house` repo checked out anywhere on this machine
  that should also be cross-referenced (read-only, never merged) for future
  wiki work, or is it fully external?

## Sources

- package.json
- packages/web/package.json
- README.md
- turbo.json
- tsconfig.json
- CLAUDE.md
- AGENTS.md
- task.md (tail, ~lines 3633-3821)
- packages/web/src, packages/web/src/api, packages/web/src/web, packages/web/src/shared (directory listings)
