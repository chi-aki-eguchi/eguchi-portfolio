---
title: Image Pipeline (R2, thumbnails, EXIF)
status: current
last_verified: 2026-07-02
sources:
  - packages/web/src/api/index.ts
  - packages/web/src/api/security.ts
  - packages/web/src/api/database/schema.ts
  - packages/web/src/api/database/schema.postgres.ts
  - packages/web/src/web/components/PhotoGallery.tsx
  - packages/web/src/web/components/Lightbox.tsx
  - packages/web/src/web/components/Picture.tsx
  - packages/web/src/web/pages/top.tsx
  - packages/web/src/shared/image-url.ts
  - packages/web/src/web/lib/picture.ts
  - .claude/rules/r2-upload.md
  - .claude/agents/exif-checker.md
---

> ⚠️ This wiki is an index/summary layer, NOT the source of truth. If this
> page conflicts with the source documents listed under Sources, the sources
> win. See ../WIKI_SCHEMA.md.

## Facts

- **Upload flow**: browser → `POST /admin/upload` (raw file) → sharp
  optimizes to **one stored master**: max 3200px long edge, mozjpeg q92,
  4:4:4 chroma, **no `.withMetadata()`** so EXIF is stripped from the stored
  master → uploaded to R2 as `photos/<ts>-<name>.jpg`. EXIF is read from the
  **original** (pre-optimization) buffer via `exif-reader` and mapped to
  discrete columns (`shotAt`, `exifCamera`, `exifLens`, `exifFocalLength`,
  `exifFNumber`, `exifExposureTime`, `exifIso`) — the binary EXIF itself is
  never stored. (packages/web/src/api/index.ts:283-284,340-372,1103-1158)
- The server **also generates two pre-generated WebP derivatives** from the
  optimized buffer: thumb (640px, q82) and medium (1920px, q85), uploaded to
  R2 as `thumbs/<name>.webp` / `medium/<name>.webp`, with keys stored as
  `thumbKey`/`mediumKey` on the photo row. (packages/web/src/api/index.ts:357-372,403-428)
- **⚠️ Documentation contradicts code**: `.claude/rules/r2-upload.md:5`
  states "WebP への変換は行わない（配信は JPEG のまま）" (no WebP
  conversion; served as JPEG). This is **stale/wrong** — the code both
  pre-generates and stores WebP thumb/medium variants at upload time *and*
  supports on-the-fly WebP/AVIF via the image proxy's Accept-header/`fmt`
  negotiation. See open-issues.md.
- Serving: gallery/hero/lightbox prefer the pre-generated `thumbUrl`/
  `mediumUrl` WebP files directly via plain `<img src>` — this doubles as
  the "LQIP" mechanism (a CSS blur-up transition from `lqip-loading` to
  `lqip-loaded`, not a base64/blurhash placeholder). When `thumbKey`/
  `mediumKey` are missing (legacy photos, or generation failed), it falls
  back to the on-the-fly proxy. (PhotoGallery.tsx:93-230,966;
  styles.css:275-291)
- **On-the-fly image proxy**: `GET/HEAD /api/images/*` validates the key
  against an allow-listed prefix set (`photos/`, `thumbs/`, `medium/`,
  `hero/`, `profile/`, `fonts/`), clamps `w`/`h` to [50,3200] and `q` to
  [10,100], negotiates format (avif > webp > jpeg via `?fmt=` or Accept
  header), and uses sharp to rotate/resize/reformat on demand. Cached in a
  byte-budgeted true-LRU map (**128MB**, `RESIZE_CACHE_BYTES`) plus a
  short-lived original-object cache (**48MB / 60s TTL**,
  `ORIG_CACHE_BYTES`/`ORIG_TTL_MS`), with in-flight de-dup and a concurrency
  limiter (`IMAGE_TRANSFORM_CONCURRENCY`, default 1, max 4).
  (packages/web/src/api/index.ts:61-107,196-240,570-729;
  packages/web/src/api/security.ts:3-27,63-76)
  **⚠️ `.claude/rules/r2-upload.md` and `.claude/agents/perf-auditor.md` both
  state wrong cache-size figures (256MB / 96MB)** — see open-issues.md.
- `Lightbox.tsx` does a 4-stage progressive reveal (grid thumb →
  on-the-fly 800px medium, skipped if a pre-gen `mediumUrl` exists → full
  image → on-the-fly 3200px q90 zoom layer only when zoomed).
  `top.tsx`'s `HeroPicture` likewise prefers the pre-generated `mediumUrl`
  and only falls back to on-the-fly `<picture>` negotiation when absent. A
  generic `<Picture>` component exists but **is not actually used anywhere**
  — `top.tsx` defines its own local `HeroPicture` instead.
  (Lightbox.tsx:948-1096; top.tsx:14-77; Picture.tsx:1-55, confirmed unused
  via grep)
- Content-hash dedup: uploads are sha256-hashed; a duplicate (matching,
  non-deleted `fileHash`) skips both the storage upload and DB insert.
  Duplicating a photo via the admin UI copies the row (including
  `url`/`thumbKey`/`mediumKey`/`fileHash`) **without** re-uploading — so
  duplicates share R2 objects. (packages/web/src/api/index.ts:1083-1098,1400-1439)
- **Orphan risk on purge**: purge/trash-retention only checks/deletes the
  photo's `url` (original) R2 object if no other row references it — **it
  never deletes the `thumbKey`/`mediumKey` WebP objects**, even on final
  purge. (packages/web/src/api/index.ts:1466-1553)
- A manual, **UI-less** backfill endpoint `POST /admin/generate-thumbnails`
  exists to retroactively generate thumb/medium WebP for older photos
  (batch limit 50); not wired into any admin UI button, referenced only in
  task.md as something to run manually. (packages/web/src/api/index.ts:2264-2356;
  task.md:2677)
- Hero and profile photo uploads run the same `optimiseImage` but **do not**
  extract EXIF or generate thumb/medium derivatives.
  (packages/web/src/api/index.ts:1183-1233)
- Both `schema.ts` and `schema.postgres.ts` define
  `thumbKey`/`mediumKey`/`fileHash`/`rotationDeg`/`focalX`/`focalY`,
  satisfying the dual-schema-sync invariant for this feature area.
  (schema.ts:47-49; schema.postgres.ts:34-39)

## Assumptions

- The r2-upload.md "no WebP conversion" line was likely accurate before
  thumb/medium WebP generation was added, and is now stale documentation
  rather than intentional current policy — inferred from the direct code
  contradiction, not from a changelog confirming when it went stale.
- None of this was verified by running the app or hitting the live R2
  bucket/DB — all conclusions are from static source reading.

## Open Questions

- Should `.claude/rules/r2-upload.md` (and CLAUDE.md's stack-table row) be
  updated to reflect that WebP thumb/medium generation now happens at
  upload time and is the *primary* serving path, with on-the-fly
  JPEG/WebP/AVIF resize as the fallback for un-backfilled photos? (Tracked
  in open-issues.md.)
- Is the orphaned-thumb/medium-on-purge behavior an accepted trade-off, or
  an unnoticed gap? No code path was found that ever calls
  `DeleteObjectCommand` on `thumbKey`/`mediumKey`.
- Is `POST /admin/generate-thumbnails` intentionally ops-only, or is wiring
  it into the admin UI a planned-but-not-done task?

## Sources

- packages/web/src/api/index.ts (upload/EXIF/thumbnail/proxy logic)
- packages/web/src/api/security.ts
- packages/web/src/api/database/schema.ts, schema.postgres.ts
- packages/web/src/web/components/PhotoGallery.tsx, Lightbox.tsx, Picture.tsx
- packages/web/src/web/pages/top.tsx
- packages/web/src/shared/image-url.ts, packages/web/src/web/lib/picture.ts
- .claude/rules/r2-upload.md
- .claude/agents/exif-checker.md
- task.md:2677
