---
title: Deployment
status: current
last_verified: 2026-07-02
sources:
  - scripts/deploy.sh
  - ecosystem.config.cjs
  - docs/post-deploy-guide.md
  - docs/cloudflare-setup.md
  - docs/railway-all-in-one-experiment.md
  - package.json
  - README.md
  - CLAUDE.md
  - task.md
  - .env.template (variable names only)
---

> ⚠️ This wiki is an index/summary layer, NOT the source of truth. If this
> page conflicts with the source documents listed under Sources, the sources
> win. See ../WIKI_SCHEMA.md.

## Facts

- **Current production deploy** (the "正本"/source of truth):
  Railway, triggered by `git push`. Railway builds the pushed commit and
  starts it with `bun src/server.ts` (akieguchi.com production,
  **[akieguchi-specific]**) or `bun packages/web/src/server.ts` (distribution
  template — there is intentionally no `railway.json` on `main`, so it
  can't override akieguchi.com's own Railway settings).
  (README.md:13,34-52,159-170; CLAUDE.md "デプロイ（Railway）" section)
- **Legacy/historical**: a ZIP-based flow for a platform called "Runable,"
  implemented in `scripts/deploy.sh`, invoked via the now-renamed npm script
  `deploy:runable:legacy` (there is **no plain `deploy` script** in
  `package.json` anymore). Per task.md's 2026-06-18/19 entries, this was
  deliberately demoted so it wouldn't be run by mistake instead of the
  Railway git-push flow. (package.json:11-24; task.md:620-633,862-868)
- `scripts/deploy.sh` **still only knows about "Runable Publish"** — its
  header, BUILD_ID sed-replacement, and final production-check block never
  mention Railway. Its `X-Build`-header check logic **no longer matches**
  current `ogp.ts`, which now derives `BUILD_ID` from
  `RAILWAY_GIT_COMMIT_SHA` at runtime, not a sed-replaced literal — task.md
  flags this mismatch explicitly. Using `deploy.sh` in the current flow
  risks a verification failure or a mismatched mental model.
  (scripts/deploy.sh:1-153; task.md:631-632,672,675)
- `ecosystem.config.cjs` is **PM2/Runable-era infrastructure**: runs
  `bun run db:push` before start (non-blocking on failure), skips a
  boot-time `vite build` if `packages/web/dist` is already shipped, logs a
  `BUILD_ID`-vs-dist-asset diagnostic (pure logging). The root `start`
  script (`pm2 start ecosystem.config.cjs`) is **explicitly NOT the Railway
  start command** per README.md. (ecosystem.config.cjs:4-81; README.md's
  maintainer note)
- `docs/post-deploy-guide.md` is the **non-engineer, photographer-facing**
  Railway "Deploy" button walkthrough: create account → set
  `ADMIN_PASSWORD` → wait for services (web/Postgres/Storage) → web
  service → Settings → Networking → "Generate Domain" → open URL →
  `/admin/login` → fill in site via the "はじめに" tab. Includes a
  troubleshooting table (missing URL, blank page, build stuck, wrong
  password, rate-limited lockout, failed deploys → check `[migrate]` log
  lines). (docs/post-deploy-guide.md:26-149)
- `docs/cloudflare-setup.md` is a **separate, optional** CDN-optimization
  guide (R2 public access + Cloudflare DNS + cache rules) — not itself a
  deploy path. (docs/cloudflare-setup.md:1-224)
- `docs/railway-all-in-one-experiment.md` (2026-06-20) is an experiment log,
  **not a shipped-as-recommended feature**: it explicitly recommended
  keeping production (Turso/R2) and distribution (Postgres/Storage) as two
  *separate* builds rather than one runtime-switchable binary — the
  implementation that actually shipped (see distribution.md/database.md)
  went the other way. As of that log, no real Postgres instance had been
  connected yet — see database.md for what happened next (real production
  incidents once it was connected). (docs/railway-all-in-one-experiment.md:1-84)
- `.env.template` variable **names** (values never read): `NODE_ENV`,
  `PORT`, `SITE_URL`, `ADMIN_PASSWORD`, `DATABASE_URL`,
  `DATABASE_AUTH_TOKEN`, `S3_ENDPOINT`, `S3_REGION`, `S3_FORCE_PATH_STYLE`,
  `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`,
  `DEFAULT_SITE_NAME`, `DEFAULT_SITE_NAME_EN`, `DEFAULT_SITE_DESCRIPTION`,
  `DEFAULT_PROFILE_NAME`, `DEFAULT_PROFILE_NAME_KATA`,
  `DEFAULT_PROFILE_NAME_EN`, `DEFAULT_PROFILE_BIO`, `ALLOWED_ORIGINS`,
  `GA_MEASUREMENT_ID`. (names only, via grep of `.env.template`; file not
  opened for values)
- Legacy ZIP artifacts exist on disk but were not extracted: root
  `eguchi-portfolio-deploy.zip` and three dated copies under `deploys/`.

## Assumptions

- The `.zip` artifacts are presumed outputs of `scripts/deploy.sh`'s legacy
  flow, consistent with naming/paths — not opened to confirm contents.
- Whether Railway's build actually injects a `BUILD_TAG` env var (flagged
  as an open risk in task.md:675) was not independently verified — no
  Railway build logs were available in this read-only pass.

## Open Questions

- Is there a `railway.json`/`railway.toml` for the **production**
  (non-template) akieguchi.com deploy anywhere, or does that configuration
  live only in the Railway dashboard (out of repo, out of scope here)?
- Does Railway's build actually set `BUILD_TAG` (consumed by
  `vite.config.ts` for cache-busting asset filenames), or does it silently
  fall back to a `-b` suffix? task.md:675 flags this as unresolved and not
  verifiable from static files alone.
- Is `ecosystem.config.cjs` actually invoked anywhere in the current Railway
  deploy path, or is it dead PM2/Runable-era code? Would need the Railway
  dashboard's actual Start Command to confirm.
- Is there a distinct internal post-deploy checklist for akieguchi.com
  production pushes (as opposed to `docs/post-deploy-guide.md`, which
  targets the distribution-template case)?

## Sources

- scripts/deploy.sh
- ecosystem.config.cjs
- docs/post-deploy-guide.md
- docs/cloudflare-setup.md
- docs/railway-all-in-one-experiment.md
- package.json (scripts block)
- README.md (Deploy/Status sections, Template variables tables)
- CLAUDE.md (デプロイ（Railway）section)
- task.md:620-633,672-696,862-868
- .env.template (names only)
