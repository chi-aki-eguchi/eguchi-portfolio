---
title: Open Issues (contradictions, stale docs, unknowns)
status: current
last_verified: 2026-07-03
sources:
  - (see per-item citations below; each restates a finding also cited on its own topic page)
---

> ⚠️ This wiki is an index/summary layer, NOT the source of truth. If this
> page conflicts with the source documents listed under Sources, the sources
> win. See ../WIKI_SCHEMA.md.

Seeded 2026-07-02 during the wiki bootstrap + AI-environment audit. This page
exists so contradictions and stale docs are tracked in one place instead of
being silently rediscovered each session. See `wiki/log.md` for the
maintenance-log entry that created this page. When an item here is resolved,
update its status/note rather than deleting the row (see WIKI_SCHEMA.md's
"Stale handling").

## Contradictions between canonical docs

1. **Settings-sync place count**: CLAUDE.md and `.claude/rules/react-components.md`
   both say "4-place" (SETTINGS_PREVIEW_KEYS / GET /settings defaults /
   provider.tsx DB-apply useEffect / provider.tsx handlePreviewMessage).
   AGENTS.md's own top-level §0 (line 18) calls it "3-place" bundling two of
   those into one item, and AGENTS.md's *admin section* (lines 201-204)
   gives a **third, different** 3-item list referencing `admin.tsx`'s
   `previewPayload` array instead of `lib/settings-preview.ts`. Three
   different counts across two files that are both supposed to be
   authoritative. See invariants.md, admin-settings.md. **Needs a
   maintainer decision + AGENTS.md edit** (out of this audit's write scope).
2. **DISTRIBUTION.md / README.md / migrate.ts's own comment all claim the
   Turso production path is a startup-migration no-op.** It is not:
   `ensureTursoColumns()` runs real `SELECT`/`ALTER TABLE ADD COLUMN` work
   on every boot. See database.md. Three places need the same correction.
3. **`README.md` is internally inconsistent**: "Status" section says
   "Turnkey template: not yet," while its own "Deploy on Railway" section
   documents an already-published deploy button
   (`https://railway.com/deploy/cool-wide`). See distribution.md.
4. **Resolved 2026-07-02 by owner-approved retirement**:
   `NIGHT-RUN-LOG.md`, `claude-code-night-run.md`, and
   `.claude/skills/night-run/` were removed. The former BUILD_ID
   contradiction is now historical only; see night-run.md.
5. **Resolved 2026-07-02 by owner-approved retirement**:
   `docs/archive/claude-code-setup-guide.md`'s embedded fixed 3:15am/3:10am
   `caffeinate` + `sleep` draft example was removed. Precise wording:
   `docs/delayed-execution-sop.md` blacklists the unreliable
   delayed-execution class (`at`/`cron`, background `sleep N && claude`,
   launchd), not the exact full draft phrase. See night-run.md.
6. **Invariant #7 ("never `git add .`")** appears only inside CLAUDE.md's
   `test-*.mjs` bullet — AGENTS.md never states it, and AGENTS.md's own
   deploy steps use `git add -A`. See invariants.md.
7. **Invariant #10 ("never `bun run deploy`")** is absent from CLAUDE.md,
   AGENTS.md, every `.claude/rules/*.md` file, and the hook — it exists
   only in `.claude/skills/deploy/SKILL.md:55`. That same skill file also
   says `bun run deploy` is "legacy-but-present," when in fact
   `package.json` no longer defines a plain `deploy` script at all (only
   `deploy:runable:legacy`) — so the skill file itself is out of date.

## Stale / incorrect documentation found

8. **`.claude/rules/r2-upload.md`**: says "no WebP conversion; served as
   JPEG" — wrong, the code generates and serves pre-generated WebP
   thumb/medium variants. Also states the resize cache is "256MB" — actual
   code constant is **128MB**. See image-pipeline.md.
9. **`.claude/agents/perf-auditor.md`**: claims cache sizes "256MB
   (thumbnail) + 96MB/60s TTL (original)" — actual code is **128MB** and
   **48MB/60s**. Git history shows `r2-upload.md` was authored *hours after*
   the code already used 128MB, so this was wrong from creation, not just
   stale.
10. **`.claude/agents/exif-checker.md`**: stale line reference
    ("admin.tsx:L5 付近参照") — `DEFAULT_CAMERA_PRESETS` is actually at
    admin.tsx:639 in an 11,058-line file.
11. **`docs/two-mac-workflow.md:22`**: git clone example uses repo name
    `eguchi-portfolio-app.git`; the actual configured remote is
    `eguchi-portfolio` (confirmed via `git remote -v` / `git ls-remote`).
12. **`docs/setup-guide.md` env var list (方法2, Turso+R2)**: omits
    `S3_REGION`, `S3_FORCE_PATH_STYLE`, and `DEFAULT_PROFILE_NAME_KATA`,
    all of which exist in `.env.template` and are actively read in code.
13. **`DISTRIBUTION.md`'s schema-sync table**: Drizzle-config column uses
    bare filenames (`drizzle.config.ts`) while Schema/Migrations-dir columns
    in the same row use full paths — actual files live under
    `packages/web/`. Also, its "regenerate both" instructions don't state a
    preceding `cd packages/web`, but the configs are cwd-relative.
14. **`.claude/chat-backups/compaction-log.txt`**: exists to log session ID
    at each pre-compaction event, but all 4 recorded entries have a blank
    "Session:" field — `$CLAUDE_SESSION_ID` appears not to populate in the
    PreCompact hook's shell environment.
15. **`.claude/scheduled_tasks.lock`**: references pid 1890, which is not
    currently running, with a timestamp (2026-06-15) ~2.5 weeks stale as of
    this audit. Possibly an orphaned lock file. Contents were not modified
    (read-only per this audit's rules).
16. **`.claude/settings.local.json`**: contains a one-off Bash permission
    allow-entry for `grep ... pages/admin.tsx` — that relative path doesn't
    exist from repo root (the real file is
    `packages/web/src/web/pages/admin.tsx`), so the entry can never match.
17. **Resolved 2026-07-02**: Codex's 2026-06-18 audit (`task.md` lines
    686, 696) recommended adding "legacy/historical" headers to
    the legacy content spec, Runable notes, and `proposals/09-modernization.md`.
    This cleanup moved the first two to `docs/archive/`;
    `proposals/09-modernization.md` remains outside this task's approved
    scope.
18. `DISTRIBUTION.md` overall is stale relative to a substantial,
    unmentioned productization push (live `/service` sales page, Stripe
    Payment Links, published Railway deploy button) that shipped after its
    last edit (2026-06-20) — see distribution.md.

## Unknowns / needs owner decision

19. Should `knowledge/` itself be excluded or genericized when this repo is
    forked as the distribution template? It currently contains akieguchi.com-
    specific facts (tagged `[akieguchi-specific]` where identified) mixed
    with template-generic architecture notes. **Not resolved by this audit
    — flagged here per the task's Phase 8 instruction.**
20. Is `packages/web/drizzle/`'s incomplete migration history (missing
    `0001_flawless_the_stranger.sql`, no migrations for `series`/
    `pricing_plans`/several `photos` columns) something to regenerate/squash,
    or accepted because `db:push` is the real mechanism in use? See
    database.md.
21. **Resolved 2026-07-02 for the improvement roadmap**: it was treated as
    superseded by `task.md`/wiki workflow and moved to `docs/archive/`.
    `proposals/*.md` remain undecided because this task did not include
    proposal cleanup.
22. **Resolved 2026-07-02**: root stray files were handled by owner-approved
    cleanup. `claude-code-luxury-feel-prompt.md` was removed after verifying
    the requested animation/style work exists in `styles.css`;
    `chatgpt-handoff.md` and `service.tsx.handoff.md` were archived with
    live issues extracted below.
23. **Resolved 2026-07-02**: `AUDIT.report/` was owner-approved for deletion.
24. **Resolved 2026-07-02**: the empty root-level `skills/` directory was
    owner-approved for deletion.
25. **Extracted from `docs/archive/chatgpt-handoff.md` on 2026-07-02**:
    cleanup archived the ChatGPT prompt handoff, but several listed follow-ups
    still appear live or deliberately unverified: remove the production
    `akieguchi.com` GA fallback after Railway has `GA_MEASUREMENT_ID`; verify
    empty-database startup; decide whether to rename `sandbox-app-template` /
    `@template/web`; decide whether focal-point drag UI is needed beyond the
    current point controls; and run hands-on verification for rotation/focal
    controls. (docs/archive/chatgpt-handoff.md:130-139, 167-173)
26. **Extracted from `docs/archive/service-tsx-handoff.md` on 2026-07-02**:
    BUG-1 and BUG-3 remain unverified in this cleanup pass. BUG-1: the service
    page had a full-page `opacity:0` failure when `.page-entrance` elements did
    not receive `visible`. BUG-3: pricing-card list markers were reported as
    literal `--` instead of an em dash. (docs/archive/service-tsx-handoff.md:10-31,
    51-61)

## Full-site audit findings — 2026-07-02 (Tier 2 proposals, no code changed)

Found by a 10-dimension read-only audit (correctness/API/frontend/
compatibility/accessibility/SEO/security/performance/tests/distribution)
during a bounded debug-and-improve task, then deduplicated and adversarially
re-verified. These are code-level findings (not documentation
contradictions like the items above) — logged here per that task's
instructions so a future session doesn't have to rediscover them. Each
needs an owner decision or touches a restricted area (design ambiguity,
auth, schema, `/service`, performance rewrites), so no code was changed for
any item below.

27. **Lightbox EXIF panel `role="dialog"` misuse** — a non-modal slide-in
    info panel is tagged `role="dialog"`; this is the one standing
    `bun run lint` failure repo-wide. The mechanical fix the linter
    suggests (swap to a native `<dialog>` tag) is unsafe here; the real fix
    needs a role choice (`group`/`region`/none) plus `aria-expanded`/
    `aria-controls` wiring — a judgment call. `Lightbox.tsx:1212-1234`.
28. **Admin `:id` write routes silently return success on a nonexistent
    id** (PATCH/DELETE on photos/series/pricing) instead of 404, unlike the
    sibling `duplicate`/`purge` routes in the same file which do check.
    `api/index.ts:1324-1395` (also 1442-1463, 1988-2024, 2088-2117).
29. **Admin session cookie is compared with `===` instead of a
    timing-safe compare**, unlike the password check which deliberately
    uses `timingSafeEqual` (`security.ts`). `api/index.ts:508,780,991`.
30. **Admin session token never rotates per login and `/admin/logout`
    only clears the browser cookie** — a leaked cookie stays valid for its
    full 7-day lifetime with no server-side revocation. A code comment
    shows this was a deliberate tradeoff, not an oversight.
    `api/index.ts:265-276,773-776`.
31. **Distribution: one of three homepage hero variants hardcodes
    `"Aki Eguchi"` as its fallback name**, contradicting the template's own
    empty-state goal (DISTRIBUTION.md) — the other two variants correctly
    fall back to the generic `"Photography"`. `web/pages/top.tsx:737`. See
    also distribution.md.
32. **Resolved 2026-07-02**: Image upload validation now uses a shared
    allow-list for all 3 upload routes and accepts TIFF variants
    (`image/tiff`, `image/x-tiff`, `.tif`, `.tiff`) while still rejecting
    unsupported image-ish files such as SVG. This also closes the former gap
    where an empty browser `Content-Type` could reach `sharp()` unchecked.
    `api/index.ts:1066-1070,1185-1189,1211-1215`;
    `api/security.ts:3-55`; `web/lib/upload-file.ts:1-44`.
33. **`/api/images/*` resize proxy collapses every failure mode (timeout,
    decode crash, real missing-key) into a blanket `404 Not found`**,
    hiding genuine 5xx-class infrastructure failures. `api/index.ts:720-728`.
34. **Homepage "immersive" hero variant uses `100dvh` instead of
    `100svh`**, contradicting the codebase's own documented reason
    (`styles.css:535-541`'s comment) for avoiding `dvh` on the equivalent
    fullscreen hero elsewhere. `web/pages/top.tsx:858`.
35. **`/service` page's sticky CTA bar is missing `-webkit-backdrop-filter`**
    (Safari) **and `env(safe-area-inset-bottom)` padding**, unlike every
    other such element in the app. `web/pages/service.tsx:770-778`.
36. **Public gallery/top-page photo queries never handle fetch errors**
    (`isError` unused) — a persistent fetch failure renders the same
    empty-state as a genuinely empty gallery. Reads as a repeated
    deliberate "fail quiet" pattern across pages, not a one-off oversight.
    `web/pages/gallery.tsx:34-37,291-301`.
37. **`/service` page photo alt text bypasses the shared `photoAltText()`
    helper** that every other photo-bearing page uses, falling back to a
    generic English string instead. `web/pages/service.tsx:163-175`.
38. **`GET /photos` always runs a `gallerySortOrder` settings lookup even
    when random-order requests provably discard the result**, and has no
    caching despite this file's own precedent (`noteCache`/`origCache`) for
    exactly this kind of hot-path optimization. `api/index.ts:1004-1029`.
39. **Zero test coverage** for: admin auth/session flow (login rate-limit,
    cookie issuance, `requireAdmin` gate), the R2 upload + sharp resize
    pipeline, and whether `provider.tsx`'s two hand-written ~110-line
    settings-sync blocks (DB-apply vs. preview-apply) stay in sync with
    each other (only 2 of the 4 sync places are mechanically checked today).
40. **`withRetry.test.ts` tests a hand-duplicated copy of the retry
    algorithm, not the real exported function** — the real one can't be
    imported standalone today because `libsql.ts` connects to a database at
    module load time, so a real regression in retry behavior would not be
    caught. `api/database/withRetry.test.ts:3-25`.
41. **Resolved 2026-07-03**: large TIFF uploads were still rejected after TIFF
    support because the shared image upload ceiling was still 60MB. The limit
    is now 300MB, the admin UI rejects files above that with an explicit
    message, `Bun.serve` allows 305MB request bodies for multipart overhead,
    and files above 60MB upload one at a time. `server.ts`;
    `shared/upload-limits.ts`; `api/security.ts`; `web/lib/upload-file.ts`;
    `web/pages/admin.tsx`.
42. **Two candidates were demoted from "simple fix" to "proposal" after
    adversarial review**, because the obvious-looking fix wasn't actually
    singular: (a) non-numeric `:id` params crash to a generic 500 instead
    of 400 across ~11 routes — fixable, but 400-reject vs. a Hono route-
    level regex constraint (404) is a real design choice; (b) 5 `/reorder`
    endpoints don't guard against a non-array request body — fixable, but
    whether malformed input should 400-reject or silently 200-no-op is also
    a real design choice, and the established sibling pattern
    (`/admin/photos/batch`) does the former. `api/index.ts`, various
    `:id`/`reorder` routes.

Noted for context only, not actionable: the Lightbox iOS body-scroll-lock
technique is a known-unreliable pattern but likely mitigated by the
overlay's own `touchAction:"none"`; a few admin thumbnails set
`alt={photo.title}` directly but sit next to an already-labeled button so
no real gap exists; `/api/*` responses intentionally skip the shared
security-headers wrapper (Set-Cookie handling); the admin trash-purge loop
is a mild N+1 pattern but only runs on stale (30+ day) trashed rows; the
`DATABASE_PROVIDER=postgres` path has no automated test or CI coverage
(none exists in this repo at all), verified only by manual build checks in
task.md.

**Also confirmed still healthy, no regression found**: the June 2026 SEO
work (meta descriptions, photo alt text, homepage title fix, Person
JSON-LD) — canonical/og:url, JSON-LD, and per-page meta descriptions all
verified correct across 7 indexable pages.

### Resolved 2026-07-02 (fixed in this same pass)

43. Dead code: `web/pages/index.tsx` (an unreferenced `Redirect`-to-`/`
    page, never imported by `app.tsx`) — deleted.
44. Stale build config: `turbo.json`/`.oxlintrc.json` still referenced the
    removed `packages/mobile`/`packages/desktop` (Expo/Electron) paths —
    removed.

## Sources

Each item above restates a finding fully cited (with exact file:line
references) on its corresponding topic page — see invariants.md,
database.md, image-pipeline.md, distribution.md, night-run.md, and the
relevant task handoff for the full root-inventory / .claude-audit /
docs-freshness tables. Items 27-44 are sourced from this task's own
10-dimension code audit (file:line citations inline above).
