# Distribution Plan

目的: この写真家ポートフォリオを、完成度を落とさず、他の人にも
わかりやすく使える形で配布できるようにする。

結論として、最初は SaaS ではなく **写真家ごとに1つの専用環境を作る
テンプレート配布** を目指す。現サイトの品質を守りながら広げるには、
「誰でも何でも自由に変えられる」より、「写真が主役になる良い初期値と
少数の安全な選択肢を渡す」ほうが向いている。

## 配布モデル

### v0: Template + Setup Guide

配布の最初の形。利用者は repository を fork または template copy し、
自分の Railway / Turso / R2 / domain を接続する。

- 1 repository
- 1 Railway service
- 1 Turso database
- 1 Cloudflare R2 bucket
- 1 custom domain
- 1 admin password

これは現在の単一サイト構成と相性がよい。tenant 分離、課金、共有容量、
サポート管理をまだ背負わないので、品質を守りやすい。

### v0.5: Concierge Setup

秋さんまたはセットアップ担当者が、写真家ごとに専用環境を作って渡す形。
非エンジニアにはこれが一番使いやすい。

- 事前ヒアリングフォームで必要情報を集める
- 専用 Railway/Turso/R2 を作る
- 初期 settings を入れる
- admin の使い方だけ渡す

この方式なら、利用者は GitHub や env var をほぼ意識しなくてよい。

### v1 Later: Turnkey Template

Railway deploy button、初回セットアップウィザード、seed script まで整え、
技術に詳しくない人でも自力で立てられる状態。

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
- サイト名、プロフィール、公開URL、連絡先、SNS、SEO説明文を順に埋める
- 写真をアップロードすると、サイズ最適化と EXIF 補完が自動で動く
- S/M/L、並び替え、レイアウト選択だけで編集された見え方になる
- 空状態でも壊れた画面ではなく、静かな placeholder になる

避けること:

- 最初から大量のデザイン項目を触らせる
- CSS や env var を直接編集させる
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
  - Done: API settings defaults and OGP/JSON-LD fallbacks now read from
    `DEFAULT_*` env values via `packages/web/src/api/site-defaults.ts`.
  - Remaining: `packages/web/index.html` still ships static fallback meta tags
    for 江口秋 and `akieguchi.com`; this matters for static previews or any HTML
    path before server-side OGP injection runs.
  - Remaining: compatibility fallbacks in `site-defaults.ts` still preserve
    current `akieguchi.com` behavior. Template releases should either set
    generic env defaults or flip these to neutral fallbacks after production env
    is confirmed.
- Generalize credentialed CORS:
  - Done: credentialed CORS now allows localhost plus configured `SITE_URL`,
    `DEFAULT_SITE_URL`, and comma-separated `ALLOWED_ORIGINS`.
  - Note: template users who serve both apex and `www` domains should add the
    extra variant to `ALLOWED_ORIGINS`.
- Remove or configure hard-coded analytics:
  - Done: OGP injection reads `GA_MEASUREMENT_ID`; empty template installs do
    not get GA unless configured.
  - Compatibility note: `akieguchi.com` keeps its legacy GA fallback when
    `GA_MEASUREMENT_ID` is not set, so current production analytics do not
    disappear accidentally.
- Provide a first-run setup path:
  - a new site currently falls back to 秋さん's identity until settings are
    edited. A template should start blank, generic, or guide the admin through
    site name, profile, URL, contact, and SEO setup.
- Keep secrets out of distributed artifacts:
  - `.env.template` should stay placeholder-only.
  - real `.env`, R2 keys, DB tokens, local screenshots, and scratch notes must
    never be included in a release bundle.
- Verify empty-database startup:
  - run schema setup against a fresh Turso/libSQL database
  - confirm public pages, `/api/settings`, `/api/photos`, `/admin/login`, and
    upload failure messages are understandable before any photos exist
  - confirm no production data, categories, settings, or photos are bundled

## P1: Should Fix For A Smooth Template

- Rename template leftovers:
  - root package name `sandbox-app-template`
  - web package name `@template/web`
- Add deployment guide:
  - create Turso database
  - create R2 bucket and access keys
  - create Railway service
  - set env vars
  - run `bun run db:push`
  - connect custom domain
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

- Railway deploy button or setup script.
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
- Add `docs/owner-guide.md`.
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
