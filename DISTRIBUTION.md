# Distribution Plan

目的: この写真家ポートフォリオを、完成度を落とさず、他の人にも
わかりやすく使える形で配布できるようにする。

結論として、最初は SaaS ではなく **写真家ごとに1つの専用環境を作る
テンプレート配布** を目指す。現サイトの品質を守りながら広げるには、
「誰でも何でも自由に変えられる」より、「写真が主役になる良い初期値と
少数の安全な選択肢を渡す」ほうが向いている。

## 配布モデル

### v0: Railway Template + Setup Guide (shipped)

配布の最初の形。公開済みの Railway Deploy button から、その人専用の
Railway project を作る。配布版は `DATABASE_PROVIDER=postgres` で
PostgreSQL + Railway Storage に切り替わり、`akieguchi.com` 本番だけが
従来どおり Turso + Cloudflare R2 を使う。

- 1 Railway template deploy
- 1 Railway web service
- 1 Railway PostgreSQL database
- 1 Railway Storage bucket
- 1 admin password
- optional custom domain

これは現在の単一サイト構成と相性がよい。tenant 分離、課金、共有容量、
サポート管理をまだ背負わないので、品質を守りやすい。

用語メモ:

- Railway template deploy: Deploy button から、その写真家用の Railway
  project を作ること。
- Railway: サイトをインターネットで動かす場所。
- PostgreSQL: 配布版でサイト名、プロフィール、写真一覧などを保存する場所。
- Railway Storage: 配布版で写真ファイルそのものを保存する場所。
- Turso/R2: `akieguchi.com` 本番で使う既存の DB / 画像ストレージ。
- tenant: 1つのサービス内で複数の利用者を分ける仕組み。今はまだやらない。

### v0.5: Concierge Setup

秋さんまたはセットアップ担当者が、写真家ごとに専用環境を作って渡す形。
非エンジニアにはこれが一番使いやすい。

- 事前ヒアリングフォームで必要情報を集める
- 専用 Railway/Turso/R2 を作る
- 初期 settings を入れる
- admin の使い方だけ渡す

写真家本人に渡すものは、原則として次の3つだけにする。

- サイトURL
- 管理画面URLとパスワード
- `docs/photographer-guide.md`

GitHub / Railway / Turso / R2 / 環境変数は、セットアップ担当者だけが見る。

この方式なら、利用者は GitHub や環境変数をほぼ意識しなくてよい。

### v1 Next: Template UX Polish

Railway deploy button は公開済み。次は初回セットアップウィザード、
seed script、テンプレート変数説明、デモ/OGP などを磨き、技術に詳しく
ない人でも迷わず立てられる状態へ近づける。

### Not First: SaaS

SaaS 化は別プロジェクト。必要になるものが一気に増える。

- user accounts and password reset
- tenant IDs on every table
- per-tenant R2 key prefixes or buckets
- per-tenant custom domains
- billing and plan limits
- support/admin tooling
- data export and deletion flows

今やると、写真の見せ方より運用基盤が主役になってしまう。

## 使う人ごとの体験設計

### 写真家本人

目的: 写真を上げ、並べ、プロフィールと問い合わせ先を整えるだけで、
ちゃんとしたポートフォリオになること。

必要な導線:

- 初回ログイン後に「まず設定するもの」が見える
- 管理画面は `写真 / 見せ方 / サイト` の3グループで、写真家が
  迷わず更新順を追える
- 管理画面の見た目は「印画紙とコンタクトシート」を基調にし、生成りの
  背景、細い罫線、控えめな赤アクセントで写真が主役になる
- サイト名、プロフィール、公開URL、連絡先、SNS、SEO説明文を順に埋める
- 写真をアップロードすると、サイズ最適化と EXIF 補完が自動で動く
- S/M/L、並び替え、レイアウト選択だけで編集された見え方になる
- 空状態でも壊れた画面ではなく、静かな placeholder になる

避けること:

- 最初から大量のデザイン項目を触らせる
- CSS や環境変数を直接編集させる
- 秋さん固有の名前やドメインが見える

### 配布・セットアップする人

目的: 毎回同じ手順で、漏れなく、短時間で新しいサイトを作れること。

必要な導線:

- required env checklist
- Railway/Turso/R2 setup checklist
- 初期設定 checklist
- pre-launch QA checklist
- backup/export checklist
- support boundary

避けること:

- 口頭説明に依存する
- 各サイトで TypeScript を手で書き換える
- 本番 secrets や写真データが template に混ざる

### 開発AI / 保守者

目的: 現サイトと配布版の違いを混同せず、安全に改善できること。

必要な導線:

- production app と distribution template の境界を文書化
- settings 追加時の同期ルールを維持
- build/test/check コマンドを README と AGENTS で一致させる
- hard-coded identity を検索できる checklist を持つ
- release 前に `git diff --check`, `tsc -b`, `bun run build` を必ず通す

避けること:

- `akieguchi.com` のための最適化を、無自覚に template default にする
- template のために現サイトの佇まいを雑に薄める
- DB/auth/storage/SEO 変更をレビューなしで進める

## 完成度を損なわない原則

- 写真が主役。テンプレート化しても UI を派手にしない。
- 初期値は静かで完成されたものにする。空っぽでも安っぽくしない。
- デザイン自由度は preset と少数の軸に制限する。
- 重要な見え方は管理画面で安全に選べるようにし、コード編集を要求しない。
- SEO/OGP/canonical/sitemap は最初から正しく出る。
- 画像品質の方針は落とさない。R2 + sharp の最適化は維持する。
- 配布版に秋さんの写真、名前、ドメイン、分析ID、秘密情報を混ぜない。
- 「立てられる」と「美しく公開できる」は別。公開前QAを必須にする。

## P0: Must Fix Before Public Distribution

- Generalize hard-coded identity defaults:
  - Done: API settings defaults now read from `DEFAULT_*` env values via
    `packages/web/src/api/site-defaults.ts`, then fall back to generic
    photographer labels.
  - Done: OGP/JSON-LD/canonical/sitemap URL resolution now uses admin `siteUrl`,
    then `SITE_URL`, then the request's current public origin, then generic
    `https://example.com`.
  - Done: `packages/web/index.html` static fallback meta tags are generic, so
    static previews or HTML before server-side OGP injection no longer leak
    production-only names/domains.
- Generalize credentialed CORS:
  - Done: credentialed CORS now allows localhost plus configured `SITE_URL`,
    `DEFAULT_SITE_URL`, and comma-separated `ALLOWED_ORIGINS`.
  - Done: configured custom domains automatically allow their `www` / non-`www`
    pair.
- Remove or configure hard-coded analytics:
  - Done: OGP injection reads `GA_MEASUREMENT_ID`; empty template installs do
    not get GA unless configured.
  - Compatibility note: `akieguchi.com` keeps its legacy GA fallback when
    `GA_MEASUREMENT_ID` is not set, so current production analytics do not
    disappear accidentally.
- Provide a first-run setup path:
  - Done: `/admin` starts with a Japanese `はじめに` checklist for site name,
    profile, contact, photos, published photos, and hero photos.
  - Done: client-side public-page fallbacks now use generic photographer labels
    while settings are still loading, instead of showing production identity.
- Keep secrets out of distributed artifacts:
  - `.env.template` should stay placeholder-only.
  - real `.env`, R2 keys, DB tokens, local screenshots, and scratch notes must
    never be included in a release bundle.
- Verify empty-database startup:
  - deploy a fresh Railway template project with PostgreSQL + Storage
  - confirm startup migrations create the schema without manual `db:push`
  - confirm public pages, `/api/settings`, `/api/photos`, `/admin/login`, and
    upload failure messages are understandable before any photos exist
  - confirm no production data, categories, settings, or photos are bundled

## P1: Should Fix For A Smooth Template

- Rename template leftovers:
  - root package name `sandbox-app-template`
  - web package name `@template/web`
- Add deployment guide:
  - Done: `docs/setup-guide.md` covers Turso database, R2 bucket/access keys,
    Railway service, env vars, `bun run db:push`, custom domain, and handoff.
  - Done: README publishes the Railway Deploy button and
    `docs/post-deploy-guide.md` covers the non-engineer one-click flow.
  - Done: `docs/photographer-guide.md` is a short no-code guide for the
    photographer receiving the site.
- Add setup checklist in `/admin`:
  - site identity
  - profile
  - public URL
  - contact
  - SNS
  - SEO description
  - first gallery upload
- Add optional seed/demo content:
  - default categories
  - empty-state copy
  - sample settings only, not sample private photos
- Add import/export or backup guidance:
  - site settings export
  - database backup
  - R2 object ownership
- Decide licensing:
  - private template, paid template, source-available license, or open-source
    license.

## P2: Later Productization

- Improve Railway template variable descriptions and first-run setup flow.
- First-run admin wizard.
- Better storage health checks.
- Optional local filesystem storage for development without R2.
- Theme presets for different photography styles.
- Template documentation for non-engineers.
- Versioned template releases and changelog.

## Recommended Build Path

### Phase 1: Template Hygiene

Outcome: another person can read the repository and understand what it is.

- Done: replace stale README content.
- Done: keep `.env.template` accurate for current required variables.
- Done: add this distribution checklist.
- Rename package leftovers.
- Search and classify all hard-coded identity values.

### Phase 2: Identity And SEO Generalization

Outcome: a fresh deployment never leaks 秋さん's identity.

- Replace OGP/site defaults with env-configurable fallback values.
- Make `SITE_URL` the canonical default source.
- Add optional `GA_MEASUREMENT_ID`.
- Derive CORS allowed origins from `SITE_URL` / `ALLOWED_ORIGINS`.
- Document when `ALLOWED_ORIGINS` is needed for `www` / preview domains.
- Update tests so they prove configurability, not `akieguchi.com`.

### Phase 3: First-Run Owner Experience

Outcome: a new photographer can configure the site from admin without code.

- Add setup checklist panel to admin.
- Mark required settings as incomplete until filled.
- Show safe empty states on public pages.
- Keep advanced typography/design controls collapsed.

### Phase 4: Deployment Package

Outcome: a maintainer can repeatedly create new sites without improvising.

- Add `docs/setup-railway.md`.
- Add `docs/prelaunch-checklist.md`.
- Done: split the first combined guide into `docs/setup-guide.md` for the
  setup person and `docs/photographer-guide.md` for the photographer.
- Later: split into `docs/setup-railway.md`, `docs/prelaunch-checklist.md`,
  and `docs/owner-guide.md` when the process stabilizes.
- Add release checklist for secrets, screenshots, and sample data.

### Phase 5: Concierge Flow

Outcome: non-engineers can receive a finished site.

- Create an intake checklist:
  - display name
  - domain
  - profile text
  - contact email/form endpoint
  - SNS links
  - preferred visual direction
  - first photo set
- Create a handoff checklist:
  - admin URL
  - login instructions
  - upload guide
  - backup/export note
  - support boundary

## Template v0 Boundary

Template v0 should promise:

- deployable single-photographer portfolio
- admin-managed photos/settings/categories/series/profile/contact
- good default visual direction
- correct SEO/OGP for the configured domain
- no hard-coded 秋さん identity in a fresh install

Template v0 should not promise:

- multi-user accounts
- client galleries
- proofing/delivery
- payments
- booking calendar
- automatic custom-domain setup
- zero-cost hosting
- SaaS updates across all users

This boundary protects the quality. The site stays a polished portfolio, not a
half-built business platform.

## Acceptance Criteria For Template v0

- A new photographer can deploy from a fork without editing TypeScript.
- Empty DB state does not display 江口秋, Aki Eguchi, or `akieguchi.com`.
- `/admin` clearly guides the owner through required settings.
- Sitemap, canonical URLs, OGP, and JSON-LD use the new site's domain.
- GA4 is absent unless explicitly configured.
- A maintainer can follow one setup checklist from blank services to live site.
- The public site still feels like a quiet, edited photography portfolio.
- `cd packages/web && bun x tsc -b && bun run build` succeeds.

## Railway All-in-One Template — Maintenance Notes

The distribution version runs entirely on Railway (PostgreSQL + Storage bucket)
and is selected at runtime with `DATABASE_PROVIDER=postgres`. The original
Turso/libSQL + R2 stack (production `akieguchi.com`, `DATABASE_PROVIDER` unset)
is unchanged. See README → "Deploy on Railway (distribution template)".

### Automatic migrations on startup

- The server applies PostgreSQL migrations on boot via `runStartupMigrations()`
  (`packages/web/src/api/database/migrate.ts`). A freshly deployed empty
  database gets its tables on first boot — the recipient never runs `db:push`.
- The migrator tracks applied migrations in `drizzle.__drizzle_migrations`, so
  restarts and redeploys are idempotent.
- On failure (e.g. unreachable DB) the process exits with a clear `[migrate]`
  log instead of serving a broken site; Railway keeps the previous version up.
- Production (Turso/libSQL) path: `runStartupMigrations()` does not run the
  PostgreSQL Drizzle migrator. It does run `ensureTursoColumns()`, which checks
  for a small set of known legacy columns and `ALTER TABLE ADD COLUMN`s any that
  are missing.

### `DATABASE_URL` vs `DATABASE_PUBLIC_URL`

- The template should set `DATABASE_PUBLIC_URL` from Railway PostgreSQL's
  `DATABASE_PUBLIC_URL` (`*.proxy.rlwy.net:PORT`). This is the verified path for
  one-click installs and local debugging.
- `DATABASE_URL` (`*.railway.internal`) remains supported as a fallback, but
  Railway private networking can be more sensitive to runtime/library details.
  Do not make recipients debug that path during first install.
- Keep both values in Railway variables or a gitignored `.env`, never hard-coded.

### Schema is maintained in two files — keep them in sync

Because SQLite/libSQL and PostgreSQL column types differ, the schema lives in
two files. **Any schema change must be applied to both, with both migration sets
regenerated:**

| Backend | Schema | Drizzle config | Migrations dir |
| --- | --- | --- | --- |
| Turso/libSQL (production) | `packages/web/src/api/database/schema.ts` | `drizzle.config.ts` | `packages/web/drizzle/` |
| PostgreSQL (distribution) | `packages/web/src/api/database/schema.postgres.ts` | `drizzle.postgres.config.ts` | `packages/web/drizzle-postgres/` |

When adding/changing a column:

1. Edit **both** `schema.ts` and `schema.postgres.ts` (same column names; types
   per dialect — e.g. `integer({mode:"boolean"})` ↔ `boolean()`,
   `integer({mode:"timestamp"})` ↔ `timestamp()`).
2. Regenerate both: `bun x drizzle-kit generate` and
   `bun x drizzle-kit generate --config=drizzle.postgres.config.ts`.
3. The query code in `api/index.ts` / `server.ts` imports `schema` from
   `./database` (the `DATABASE_PROVIDER` switch), so it automatically uses the
   right table objects at runtime — do not import `schema.ts` directly.

Forgetting the PostgreSQL side breaks only the distribution build, not
production — so it is easy to miss. This rule is mirrored in `CLAUDE.md` /
`AGENTS.md` §0.
