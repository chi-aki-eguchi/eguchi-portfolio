---
title: Knowledge Wiki Index
status: current
last_verified: 2026-07-02
sources: []
---

> ⚠️ This wiki is an index/summary layer, NOT the source of truth. If this
> page conflicts with the source documents listed under Sources on any page
> below, the sources win. See ../WIKI_SCHEMA.md.

Entry point for the `eguchi-portfolio-app` knowledge wiki. Start here, then
open only the page(s) relevant to your current task — this wiki is meant to
be read selectively, not in full, each session.

## Product & architecture

- [Project Overview](pages/project-overview.md) — what the site is, the
  stack, monorepo layout, key file map, the Ivy's House repo-boundary rule.
- [The 13 Project Invariants](pages/invariants.md) — each of the 13 §0
  invariants, where it's documented, and whether it's mechanically enforced
  (hook/rule file) or prose-only.
- [Database](pages/database.md) — the Turso/libSQL vs PostgreSQL dual-schema
  reality, migration history gaps, documented production incidents.
- [Repository Layout & File Hygiene](pages/repo-layout.md) — root Markdown
  whitelist, docs/specs vs docs/archive, scratch workspace, and handoff file
  rules.

## Features

- [Service / Sales Page (/service)](pages/service-page.md) — the sales
  landing page, its handoff-doc bug history, and how it connects to
  purchase/order handling.
- [Admin Settings & Live Preview](pages/admin-settings.md) — the settings
  flow, the iframe live-preview mechanism, the 4-place sync rule in
  concrete practice.
- [Image Pipeline](pages/image-pipeline.md) — R2 upload, pre-generated WebP
  thumbnails, EXIF handling, the on-the-fly resize proxy.

## Operations

- [Distribution (Railway Template)](pages/distribution.md) — the
  productization plan, template-generic vs akieguchi-specific boundary,
  DISTRIBUTION.md freshness.
- [Deployment](pages/deployment.md) — Railway git-push deploy, the legacy
  Runable ZIP path, env/config topology (names only, no secret values).
## Tracking

- [Open Issues](pages/open-issues.md) — contradictions between canonical
  docs, stale/incorrect documentation, and unknowns that need an owner
  decision. Start here if you're about to trust a specific claim and want to
  know if it's contested.
- [log.md](log.md) — wiki-maintenance log (not the implementation work
  log — that's `../../task.md`).

## Conventions

- See [`../WIKI_SCHEMA.md`](../WIKI_SCHEMA.md) for the full schema, ingest
  procedure, and contradiction-handling rules.
- Content specific to the akieguchi.com production deployment (vs. the
  generic distributable template) is tagged inline with
  **[akieguchi-specific]**.

## Retired

- [Night-Run Setup](pages/night-run.md) — retired on 2026-07-02 by owner
  decision; kept only as a historical pointer.
