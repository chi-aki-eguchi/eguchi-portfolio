---
title: Service / Sales Page (/service)
status: current
last_verified: 2026-07-02
sources:
  - packages/web/src/web/pages/service.tsx
  - packages/web/src/web/pages/service.tsx.handoff.md
  - packages/web/src/web/hooks/usePageEntrance.ts
  - packages/web/src/web/lib/service-config.ts
  - packages/web/src/api/index.ts
  - packages/web/src/api/public-routes.ts
  - docs/sales-page.md
  - docs/purchase-thankyou.md
  - docs/order-handling.md
---

> ⚠️ This wiki is an index/summary layer, NOT the source of truth. If this
> page conflicts with the source documents listed under Sources, the sources
> win. See ../WIKI_SCHEMA.md.

## Facts

- `/service` is a single-page Japanese sales/landing page pitching the
  akieguchi.com portfolio-site **template** to other photographers, in two
  tiers: ¥10,000 self-deploy / ¥30,000 done-for-you setup, sold via **Stripe
  Payment Links**, with a `mailto:` fallback when Stripe isn't configured
  (`isStripeLive()` checks the URL host is `buy.stripe.com`).
  (packages/web/src/web/lib/service-config.ts:165-196, 456-513)
- Gated: renders `null` unless `isServiceHost()` (hostname is akieguchi.com,
  localhost, or 127.0.0.1) **[akieguchi-specific gating]**, and unless
  `config.enabled !== 'off'`. (packages/web/src/web/pages/service.tsx:808-833)
- Page order: Hero → HeroSitePreview (mini gallery mock) → PortfolioProof
  (links to real /gallery /about /contact) → AudienceAndFeatures → Pricing
  (two PlanCards) → StickyCtaBar → PurchaseDetails (collapsible) →
  AdminShowcase → FAQ → FinalCTA. (packages/web/src/web/pages/service.tsx:835-943)
- **`service.tsx.handoff.md`** documents 3 bugs from a full rewrite of
  `service.tsx` (pre-change commit `31a420a`):
  1. **BUG-1** (highest priority): whole page stuck at `opacity:0` — the
     `usePageEntrance` IntersectionObserver never added the `visible` class.
  2. **BUG-2**: sticky bottom CTA bar's price text clipped behind the left
     sidebar on desktop (fixed-position element doesn't inherit
     `.nav-pos-left > main`'s `padding-left:11rem`).
  3. **BUG-3**: a pricing-card list marker rendered literal `--` instead of
     an em dash.
  (packages/web/src/web/pages/service.tsx.handoff.md:1-61)
- **All three fixes described in the handoff appear to already be present in
  the code**: `usePageEntrance.ts` has a 500ms safety-net `setTimeout` that
  force-adds `visible` to any remaining `.page-entrance` elements
  (hooks/usePageEntrance.ts:47-56); `service.tsx:771`'s sticky bar div has
  `md:left-[11rem]`; the plan bullet marker renders `—` (em dash)
  (service.tsx:594-599). **This was verified by reading source, not by
  running the app in a browser** — see Open Questions.
- Post-purchase fulfillment is a **manual, off-app process**, not
  webhook/DB-backed in this codebase: `docs/purchase-thankyou.md` has the
  exact Stripe confirmation-page/email copy per tier;
  `docs/order-handling.md` is the internal runbook (log to a ledger, send
  the matching thank-you message, for tier B manually build/configure the
  site per setup-guide.md). No order/webhook route was found in
  `public-routes.ts` or the parts of `api/index.ts` reviewed.
  (docs/purchase-thankyou.md:15-64; docs/order-handling.md:8-52)
- `GET /settings` returns `servicePageConfig` and `contactEmail` from
  `site_settings`; `public-routes.ts` lists `/service` among
  `SPA_STATIC_PATHS` (server returns the SSR/OGP HTML shell with HTTP 200).
  (packages/web/src/api/index.ts:860,972; public-routes.ts:1-11,40-47)

## Assumptions

- The presence of the safety-net setTimeout / `md:left-[11rem]` / em-dash in
  current source strongly suggests BUG-1/2/3 are fixed, but this is inferred
  from comparing source to the handoff's proposed remedies — not from
  running the app and visually confirming in a browser.
- `git log` shows later commits touching `service.tsx` (e.g. "Fix service
  starting price CTA," "feat(service): make /service page fully editable
  from admin panel") consistent with the bug-fix work having landed, but no
  diff against commit `31a420a` specifically was done to prove which commit
  closed the handoff's checklist.

## Open Questions

- Has the handoff's post-fix checklist (build passes; fade-ins fire; sticky
  bar full text; markers are `—`; FAQ/Details accordions open/close; mobile
  hero 2-across) actually been run and confirmed? The handoff file has no
  checkboxes marked.
- Given the fixes appear to already be in place, should
  `service.tsx.handoff.md` be deleted? (Also flagged in the Phase 5 root
  inventory — see open-issues.md; this file is currently untracked and
  repeatedly noted as "out of scope" across 15+ task.md handoff entries.)
- Is there any Stripe webhook route elsewhere in the codebase that records
  purchases in the DB, or is `docs/order-handling.md`'s manual/dashboard-only
  process the entire order pipeline? Only `public-routes.ts` and part of
  `api/index.ts` were grepped for this audit.

## Sources

- packages/web/src/web/pages/service.tsx
- packages/web/src/web/pages/service.tsx.handoff.md
- packages/web/src/web/hooks/usePageEntrance.ts
- packages/web/src/web/lib/service-config.ts
- packages/web/src/api/index.ts (lines 860, 972)
- packages/web/src/api/public-routes.ts
- docs/sales-page.md
- docs/purchase-thankyou.md
- docs/order-handling.md
