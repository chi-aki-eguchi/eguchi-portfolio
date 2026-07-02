---
title: Admin Settings & Live Preview
status: current
last_verified: 2026-07-02
sources:
  - packages/web/src/web/lib/settings-preview.ts
  - packages/web/src/web/lib/settings-preview.test.ts
  - packages/web/src/api/index.ts
  - packages/web/src/api/site-defaults.ts
  - packages/web/src/web/components/provider.tsx
  - packages/web/src/web/pages/admin.tsx
  - docs/admin-guide.md
  - docs/specs/admin-enhancement-spec.md
  - docs/archive/admin-enhancement-spec.md
  - docs/archive/admin-enhancement-spec-v2.md
---

> ⚠️ This wiki is an index/summary layer, NOT the source of truth. If this
> page conflicts with the source documents listed under Sources, the sources
> win. See ../WIKI_SCHEMA.md.

## Facts

- One canonical value store: the `site_settings` key-value table, served by
  `GET /api/settings`. Two ways React state stays in sync with it: (a) a
  normal `useQuery(['settings'])` that `provider.tsx` applies to CSS
  vars/DOM via **three** `useEffect`s (theme colors; typography; fonts), and
  (b) a **live-preview channel** — the admin Settings tab iframe-postMessages
  a draft payload into the embedded site, and `provider.tsx`'s
  `handlePreviewMessage` applies it without waiting for a save.
  (packages/web/src/web/components/provider.tsx:125-457)
- **The 4-place sync rule in concrete practice** (see invariants.md #2):
  1. `SETTINGS_PREVIEW_KEYS` — a ~140-entry ledger array in
     `lib/settings-preview.ts:1-142`. `JS_PREVIEW_KEYS` is an alias used so
     the iframe's own React-Query cache gets every key mirrored too.
  2. `GET /settings` defaults — `packages/web/src/api/index.ts:784-975`,
     one big literal where every field is `settings.key ?? <default>` (a
     few defaults come from `site-defaults.ts` helpers instead of literals).
  3. `provider.tsx`'s DB-apply `useEffect`s — 3 effects (colors:172;
     typography:172-242; fonts:244-283) that read `data?.xxx` from the
     `['settings']` query and push into CSS vars/DOM.
  4. `provider.tsx`'s `handlePreviewMessage` — a `message` listener
     (285-457) that same-origin-checks, pins the query cache
     (`staleTime: Infinity` so a background refetch can't clobber the
     preview), merges the payload into query data, and separately
     re-applies the same CSS vars keyed off the postMessage payload.
- Only the ledger↔API-default↔admin-editable-key relationship is
  **mechanically tested** (`settings-preview.test.ts:32-102`, which scrapes
  `api/index.ts` and `admin.tsx` source between marker comments). **The two
  `provider.tsx` apply-sites are not test-covered against the ledger** —
  they rely on manual discipline / the CLAUDE.md rule.
- `admin.tsx`'s `SettingsTab` builds `previewPayload` from saved settings +
  in-progress draft (`usePersistentState('admin:settingsDraft', {})`), posts
  it to the iframe on change/load, and replies to the iframe's
  `preview-ready` ping via a ref (dodges stale closures). The save mutation
  POSTs only the diff, `assertOk`s, optimistically merges into the cache,
  then calls `qc.invalidateQueries({queryKey:['settings']})`.
  (packages/web/src/web/pages/admin.tsx:8201-8341, 8278-8295)
- **Spec history**: `docs/archive/admin-enhancement-spec.md` (v1) and
  `docs/archive/admin-enhancement-spec-v2.md` ("確定版"/confirmed) both state the rule as
  **3 places** (no separate ledger file — it lived ad hoc in `admin.tsx` at
  that time). By `docs/specs/admin-enhancement-spec.md`, the ledger already
  existed and the rule is correctly stated as 4 places.
  (docs/archive/admin-enhancement-spec.md:15-19;
  docs/archive/admin-enhancement-spec-v2.md:1,13;
  docs/specs/admin-enhancement-spec.md:16)
- `docs/specs/admin-enhancement-spec.md` is about an **unrelated** feature
  (photo rotation/orientation). It was promoted from the former v3 draft
  during the 2026-07-02 file cleanup after the review had already happened
  and was recorded in the same file (dated 2026-06-25). The reviewed feature
  (`rotationDeg`) is **already present** in `schema.ts` and referenced
  across 8+ source files.
  (docs/specs/admin-enhancement-spec.md:1,5,458,462-494;
  packages/web/src/api/database/schema.ts:42)
- `docs/admin-guide.md` documents the live-preview UX at a user level:
  settings changes preview live in an iframe before saving; lists the tab
  set (写真/カテゴリ/シリーズ/ヒーロー/料金プラン/サイト設定/ゴミ箱).
  (docs/admin-guide.md:54-73)

## Assumptions

- The `rotationDeg` feature being present in `schema.ts`/multiple files
  means it was implemented after the 2026-06-25 review, but not every
  individual P0/P1 gap from that review (e.g. the image-proxy cache-key `rot`
  gap) was independently re-verified as fixed in this pass.

## Open Questions

- Has the `rotationDeg` image-proxy cache-key gap
  (`docs/specs/admin-enhancement-spec.md:475-477`, P0) actually been closed?
  Out of scope for this settings/preview-focused read.
- Is there any automated test that would catch a `provider.tsx`
  DB-apply-`useEffect`- or `handlePreviewMessage`-omission for a new
  settings key (the two sync points `settings-preview.test.ts` does not
  cover), or is that purely code-review-enforced today?
- The former root admin v3 draft has been renamed to
  `docs/specs/admin-enhancement-spec.md`; v1/v2 remain in `docs/archive/`.
- The former AGENTS.md "3-place vs 4-place" contradiction was reconciled on
  2026-07-02; this page describes the current, correct (4-place) mechanics.

## Sources

- packages/web/src/web/lib/settings-preview.ts, settings-preview.test.ts
- packages/web/src/api/index.ts (Site Settings block, ~lines 783-1061)
- packages/web/src/api/site-defaults.ts, site-defaults.test.ts
- packages/web/src/web/components/provider.tsx
- packages/web/src/web/pages/admin.tsx (SettingsTab, ~lines 8201-8341)
- docs/admin-guide.md
- docs/specs/admin-enhancement-spec.md
- docs/archive/admin-enhancement-spec.md, docs/archive/admin-enhancement-spec-v2.md
