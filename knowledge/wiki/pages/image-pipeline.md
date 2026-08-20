---
title: Image Pipeline (R2, thumbnails, EXIF)
status: current
last_verified: 2026-08-20
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
  - packages/web/src/api/photo-integrity.ts
  - packages/web/src/api/thumbnail-upload-integrity.ts
---

> ⚠️ This wiki is an index/summary layer, NOT the source of truth. If this
> page conflicts with the source documents listed under Sources, the sources
> win. See ../WIKI_SCHEMA.md.

## Facts

- **Upload flow**: browser → `POST /admin/upload` (raw file) → sharp
  optimizes to **one stored master**: max 3200px long edge, mozjpeg q92,
  4:4:4 chroma, **no `.withMetadata()`** so EXIF is stripped from the stored
  master → uploaded to R2 as `photos/<ts>-<name>.jpg`. TIFF files are accepted
  at upload validation (`image/tiff`, `image/x-tiff`, `.tif`, `.tiff`) and
  follow the same policy: decode the original, store the normalized JPEG
  master, then generate WebP derivatives. EXIF is read from the **original**
  (pre-optimization) buffer via `exif-reader` and mapped to discrete columns
  (`shotAt`, `exifCamera`, `exifLens`, `exifFocalLength`, `exifFNumber`,
  `exifExposureTime`, `exifIso`) — the binary EXIF itself is never stored.
  (packages/web/src/api/index.ts:340-372,1063-1179;
  packages/web/src/api/security.ts:3-55;
  packages/web/src/web/lib/upload-file.ts:1-44)
- **Upload size policy**: image uploads are capped at **300MB per file** via
  shared server/client constants. Files over 300MB are rejected in the admin UI
  before upload and by the API with HTTP 413 if they reach the server.
  `Bun.serve` is configured with a **305MB request-body ceiling** so a 300MB
  file has room for multipart form overhead. Files over 60MB but within the
  300MB ceiling upload serially (one at a time) so several large TIFFs do not
  overwhelm the server concurrently. As of 2026-07-03, Railway's public proxy
  docs list request duration/headers/rate limits but no fixed public
  request-body-size ceiling; R2 single-part uploads allow 5GiB, and sharp's
  default input safety limit is pixel-count based (`268402689` pixels), not
  byte-size based.
  (packages/web/src/shared/upload-limits.ts;
  packages/web/src/server.ts:20-21,372-375;
  packages/web/src/api/security.ts:1-29;
  packages/web/src/api/index.ts:1070-1073,1189-1192,1215-1218;
  packages/web/src/web/lib/upload-file.ts:1-79;
  packages/web/src/web/pages/admin.tsx:2048-2178)
- **Local TIFF conversion tool**: `scripts/convert-tiffs.ts` is a maintained
  owner-side Bun tool for converting lab-delivered TIFF scans before upload.
  It reads TIFFs from `~/tiff-inbox`, writes JPEGs to `~/tiff-converted`, never
  modifies source TIFFs, skips already-converted outputs, and processes files
  sequentially. Its JPEG settings mirror the upload master settings
  (3200px long edge, q92, mozjpeg, 4:4:4), while preserving EXIF metadata and
  disabling sharp's pixel-count input limit in the local script only.
  (scripts/convert-tiffs.ts; docs/tiff-conversion.md)
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
- Serving: gallery/hero/lightbox and admin Library thumbnails prefer the
  pre-generated `thumbUrl`/`mediumUrl` WebP files directly via plain
  `<img src>` — this doubles as the "LQIP" mechanism on public gallery
  tiles (a CSS blur-up transition from `lqip-loading` to `lqip-loaded`, not
  a base64/blurhash placeholder). When `thumbKey`/`mediumKey` are missing
  (legacy photos, or generation failed), it falls back to the on-the-fly
  proxy. (PhotoGallery.tsx:93-230,966; admin.tsx:862-873,3578,3766;
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
- **Purge deletes all three objects** (corrected 2026-08-20; the earlier
  claim on this page that thumb/medium were never deleted was written
  2026-07-03 and became wrong when `d0d2412` landed on 2026-07-21).
  `unsharedPhotoStorageKeys` returns the master key plus `thumbKey` and
  `mediumKey` when no surviving row shares the same `url`; `purgeDbThenStorage`
  then runs storage cleanup after the DB transaction commits.
  (photo-integrity.ts:19-28, 72-78; index.ts:521, 2109)
- **Residual leak, small**: `deleteStorageKeys` swallows R2 delete failures
  (`console.error` only) so that a failed delete can never roll back a
  committed DB delete. Its comment says "the orphan audit can remove it
  later", but **no orphan audit exists in this repo** — grepping `orphan`
  finds only that comment. Objects left behind by a failed delete are
  currently never reclaimed. (index.ts:527-537)
- **Partial-derivative upload is compensated**: if only one of thumb/medium
  uploads succeeds, `uploadAllOrCleanup` deletes what was written. Its
  wiring test was hardened on 2026-08-06 so that passing a no-op cleanup
  fails the test. (thumbnail-upload-integrity.ts:1; index.ts:675)
- A manual, **UI-less** backfill endpoint `POST /admin/generate-thumbnails`
  exists to retroactively generate thumb/medium WebP for older photos
  (batch limit 50); not wired into any admin UI button — run manually.
  (packages/web/src/api/index.ts:2992)
  The old citation to `task.md:2677` was dropped on 2026-08-20: `task.md`
  now holds only the Current State block and has no such line.
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
- The 2026-07-02 TIFF validation update was verified locally with sharp
  `0.34.5` / libtiff `4.7.1` decoding a generated TIFF into JPEG, plus
  targeted upload-validation tests. Production DB/R2 were queried
  read-only for the reported sample filenames (`DSCF1599`, `DSCF1607`,
  `DSCF1609`) and found no leftover DB rows or R2 objects for those names.
- The 2026-07-03 large-TIFF follow-up was verified by a local API upload
  repro: a 61MiB file returned HTTP 413 with the old "画像は60MBまでです。"
  message before the limit was raised. Production read-only checks found no
  new TIFF rows and no R2 objects created on 2026-07-03 JST, so the retried
  large-TIFF failures did not leave visible DB/R2 leftovers.

## Open Questions

- Should `.claude/rules/r2-upload.md` (and CLAUDE.md's stack-table row) be
  updated to reflect that WebP thumb/medium generation now happens at
  upload time and is the *primary* serving path, with on-the-fly
  JPEG/WebP/AVIF resize as the fallback for un-backfilled photos? (Tracked
  in open-issues.md.)
- **Answered 2026-08-20**: it was an unnoticed gap, and it was fixed in
  `d0d2412` (2026-07-21) — before this question was ever re-read. Purge now
  calls `DeleteObjectCommand` on `thumbKey`/`mediumKey`. What remains open is
  narrower: should the swallowed R2 delete failure get a real orphan-audit
  path, or is "leave it in R2" the accepted end state?
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
- packages/web/src/api/photo-integrity.ts
- packages/web/src/api/thumbnail-upload-integrity.ts
