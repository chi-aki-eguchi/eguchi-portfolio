---
title: Distribution (Railway Template)
status: needs-review
last_verified: 2026-07-02
sources:
  - DISTRIBUTION.md
  - docs/distribution-ideas.md
  - docs/railway-all-in-one-experiment.md
  - RUNABLE_AI.md
  - README.md
  - site-analysis-2026-06.md
  - package.json
  - packages/web/package.json
  - task.md
---

> ⚠️ This wiki is an index/summary layer, NOT the source of truth. If this
> page conflicts with the source documents listed under Sources, the sources
> win. See ../WIKI_SCHEMA.md.

**Status: `needs-review`** — DISTRIBUTION.md itself is stale relative to the
rest of the repo (see Open Questions); treat its "not yet" claims with
caution and check README.md/task.md for what's actually shipped.

## Facts

- `DISTRIBUTION.md` (root, last content commit 2026-06-20) is the plan for
  turning the akieguchi.com codebase into a **Railway Template** other
  photographers can self-deploy, explicitly **not** SaaS multi-tenancy for
  now. Staged model: v0 (template + setup guide), v0.5 (concierge setup), v1
  later (turnkey deploy button + wizard — framed as future work).
  (DISTRIBUTION.md:6-9, 13-59, 61-73)
- P0 "must fix before public distribution" — marked **Done**: generic
  identity defaults via `DEFAULT_*` env vars
  (`packages/web/src/api/site-defaults.ts`), OGP/JSON-LD/canonical/sitemap
  URL resolution order, generic static meta fallback, credentialed CORS
  derived from `SITE_URL`/`ALLOWED_ORIGINS`, `GA_MEASUREMENT_ID`-gated
  analytics (with an explicit **[akieguchi-specific]** compatibility
  exception: akieguchi.com keeps a legacy hardcoded GA fallback), first-run
  "はじめに" admin checklist. Still open: keep `.env.template`
  placeholder-only; verify empty-database startup end-to-end.
  (DISTRIBUTION.md:144-181)
- P1 "should fix" — **outstanding, independently verified**: renaming
  template leftovers. Root `package.json` name is still
  `"sandbox-app-template"` and `packages/web/package.json` is still
  `"@template/web"`. (DISTRIBUTION.md:184-191; package.json:2;
  packages/web/package.json:2)
- **"Railway All-in-One Template" architecture** (documented in
  DISTRIBUTION.md, shipped in README.md): one codebase, runtime-switched by
  `DATABASE_PROVIDER=postgres` (distribution: Postgres + Railway Storage) vs
  unset (production akieguchi.com: Turso + R2, **[akieguchi-specific]**
  unchanged). This is notable because `docs/railway-all-in-one-experiment.md`
  (an earlier, 2026-06-20 spike log) explicitly **recommended against** a
  single runtime-switchable binary as "schema-type-complex," recommending
  two separate builds instead — **the implementation that shipped did not
  follow that recommendation.** (DISTRIBUTION.md:320-372;
  docs/railway-all-in-one-experiment.md:17-20)
- `RUNABLE_AI.md` describes a completely separate, ZIP-bundle-based deploy
  mechanism ("Runable"), untouched since the repo's initial commit
  (2026-06-16), never cross-referenced by DISTRIBUTION.md or any
  Railway-focused doc — reads as an orphaned/legacy path. See deployment.md.
  (RUNABLE_AI.md:1-47; git log -1 confirms 2026-06-16 only)
- **DISTRIBUTION.md is stale relative to a substantial, unmentioned
  productization push**: a live `/service` sales page with two real Stripe
  Payment Links, a published Railway "Deploy" button
  (`https://railway.com/deploy/cool-wide`), and supporting docs
  (`docs/sales-page.md`, `docs/post-deploy-guide.md`,
  `docs/purchase-thankyou.md`, `docs/order-handling.md`, etc.) mostly
  last touched 2026-06-26/27, with task.md handoffs through 2026-06-30 —
  none of this is reflected in DISTRIBUTION.md, whose "v1 Later: Turnkey
  Template" section still frames turnkey deploy as future work.
  (git log timestamps; README.md "Deploy on Railway" section)
- `README.md` is internally inconsistent on this exact point: its "Status"
  section says "Turnkey template: not yet" while its own "Deploy on Railway
  (distribution template)" section documents the already-published deploy
  button. (README.md lines 13-16 vs 20-30)
- `site-analysis-2026-06.md` **[akieguchi-specific]** is a production SEO/
  marketing gap analysis (social proof, per-page meta descriptions, alt
  text, booking CTA, WebP, series discoverability) — it does not itself
  discuss the template/production boundary, but its recommendations
  (personalized copy, press logos) are exactly the kind of change
  DISTRIBUTION.md's own principle warns must not silently become a template
  default. (site-analysis-2026-06.md:1-160; DISTRIBUTION.md:127-131)
- `docs/distribution-ideas.md` (2026-06-21) is a non-committal priority menu
  of UX improvements for the distributed product (demo URL, richer
  template-variable descriptions, OGP preview image, easier custom-domain
  step, first-login wizard, password reset, backup/export) — nothing in it
  is marked done; top-3 recommended next steps: fixed demo URL, richer
  template descriptions + OGP image, easier "Generate Domain" step.
  (docs/distribution-ideas.md:1-41)

## Assumptions

- `RUNABLE_AI.md`'s "Runable" path is assumed legacy/abandoned based on it
  never being cross-referenced by any distribution doc — inferred from
  absence of references, not a fact confirmed by any doc stating it's
  deprecated.
- The Railway deploy button (`https://railway.com/deploy/cool-wide`) is
  assumed live/functional because the repo's own docs describe and link to
  it as published; this was not tested over the network.

## Open Questions

- Is the Railway deploy button currently live and does it deploy a working,
  empty-database site end-to-end today, given 129 commits touched
  `packages/web/src` since DISTRIBUTION.md's last update (some may have
  added schema changes not yet mirrored to `schema.postgres.ts`)?
- Has anyone completed `railway-all-in-one-experiment.md`'s flagged
  verification steps (real Postgres connection, sort-order SQL, timestamp
  type behavior) since 2026-06-20? No later doc recording this was found.
- Should DISTRIBUTION.md be updated to reflect that a live sales funnel
  (Stripe Payment Links, `/service`, purchase-thankyou copy) already exists,
  given the doc still frames productization as future phases?
- Does the still-outstanding P1 package-name rename
  (`sandbox-app-template`/`@template/web`) block anything for the
  already-published template, or is it cosmetic tech debt?
- Should `knowledge/` itself be excluded or genericized in the distributed
  template? (Also tracked in open-issues.md — this is the Phase 8
  distribution-boundary question for the wiki itself.)

## Sources

- DISTRIBUTION.md
- docs/distribution-ideas.md
- docs/railway-all-in-one-experiment.md
- RUNABLE_AI.md
- README.md
- site-analysis-2026-06.md
- package.json, packages/web/package.json
- task.md (git log cross-references)
