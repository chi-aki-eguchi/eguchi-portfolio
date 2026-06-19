# Recipient Setup Guide

このガイドは、写真家本人またはセットアップ担当者が、このポートフォリオを
別の人用に配布・導入するための実務手順です。

最初の配布形態は SaaS ではなく、**1人の写真家につき1つの専用環境** です。

## 全体像

配布する側が渡すもの:

- repository の fork または template copy
- Railway service
- Turso database
- Cloudflare R2 bucket
- custom domain
- admin URL and password
- owner guide

受け取る人がやること:

- admin にログインする
- サイト名、プロフィール、連絡先、SNS、公開URLを入れる
- 写真をアップロードする
- S/M/L サイズ、並び順、レイアウトを調整する
- 公開前チェックを一緒に見る

## 配布する側の手順

### 1. 新しい repository を作る

GitHub でこの repository を fork または template copy する。

配布先ごとに repository を分けると、あとから個別の修正・更新・バックアップを
追いやすい。

### 2. Turso database を作る

新しい写真家専用の Turso database を作り、以下を控える。

- `DATABASE_URL`
- `DATABASE_AUTH_TOKEN`

既存の秋さん本番 database は絶対に流用しない。

### 3. Cloudflare R2 bucket を作る

新しい写真家専用の R2 bucket と S3 access key を作り、以下を控える。

- `S3_ENDPOINT`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`

写真データの所有権と削除責任が分かりやすいよう、bucket は人ごとに分ける。

### 4. Railway service を作る

Railway で新しい service を作り、repository を接続する。

Start command:

```sh
bun src/server.ts
```

Root directory:

```text
packages/web
```

Railway 側に `PORT` は自動設定されるので、通常は手入力しない。

### 5. Environment variables を入れる

Railway に最低限これを設定する。

```sh
SITE_URL=https://example.com
ADMIN_PASSWORD=<strong-password>
DATABASE_URL=<turso-url>
DATABASE_AUTH_TOKEN=<turso-token>
S3_ENDPOINT=<r2-endpoint>
S3_BUCKET=<r2-bucket>
S3_ACCESS_KEY_ID=<r2-access-key>
S3_SECRET_ACCESS_KEY=<r2-secret>
DEFAULT_SITE_NAME=<photographer-name>
DEFAULT_SITE_NAME_EN=<photographer-name-en>
DEFAULT_SITE_DESCRIPTION=<short-site-description>
DEFAULT_PROFILE_NAME=<photographer-name>
DEFAULT_PROFILE_NAME_EN=<photographer-name-en>
DEFAULT_PROFILE_BIO=<short-profile>
GA_MEASUREMENT_ID=
```

`www` と apex domain の両方、または preview domain から credentialed API を
呼ぶ場合だけ、追加で設定する。

```sh
ALLOWED_ORIGINS=https://www.example.com,https://preview.example.com
```

### 6. Schema を反映する

ローカルまたは Railway shell で `.env` を設定した状態にして実行する。

```sh
cd packages/web
bun run db:push
```

これを忘れると API が database table missing で動かない。

### 7. Build を確認して push する

```sh
cd packages/web
bun x tsc -b
bun run build
git push
```

Railway が自動で build/deploy する。

### 8. 本番確認

以下を確認する。

- `/` が表示される
- `/gallery` が空状態でも壊れない
- `/about` が generic または本人情報になっている
- `/contact` が表示される
- `/admin/login` に入れる
- `/api/settings` が 200 を返す
- HTML title / OGP / canonical が新しい domain になっている
- 秋さんの名前、写真、domain、GA ID が出ていない

## 受け取った人がやること

### 1. Admin にログインする

セットアップ担当者から受け取るもの:

- public site URL
- admin URL
- admin password

Admin URL:

```text
https://example.com/admin/login
```

### 2. Site identity を入れる

Settings で以下を入れる。

- Site Name
- Site Name EN
- Site Description
- Site URL
- Google Site Verification if needed

`Site URL` は sitemap、canonical、OGP、JSON-LD の基準になるので、
公開 domain が決まったら必ず入れる。

### 3. Profile を入れる

Profile で以下を入れる。

- name
- profile photo
- bio
- statement
- SNS links
- gear if needed

### 4. Contact を入れる

Contact で以下を入れる。

- contact intro
- contact email
- Formspree URL if form submission is needed
- pricing plans if shooting requests are offered

### 5. Photos を入れる

Gallery で写真をアップロードする。

写真は server 側で 3200px / mozjpeg q92 に最適化され、R2 に保存される。
EXIF があれば camera / lens / shot date の補完も走る。

### 6. 見え方を整える

写真ごとに以下を調整する。

- title
- description
- category
- series
- display size: S / M / L
- published status
- order

サイト全体では以下を選ぶ。

- gallery layout
- series layout
- top works layout
- hero mode
- typography presets
- spacing

最初は細かい typography より、写真の順番と S/M/L を整えるほうが効く。

## 公開前チェック

配布する側と受け取る人で一緒に見る。

- Top page に代表写真が出ている
- Gallery が空白・崩れ・broken image になっていない
- About に本人情報が入っている
- Contact の送信先が正しい
- SNS links が正しい
- mobile 幅で名前や nav がはみ出さない
- `/sitemap.xml` が新しい domain を指している
- social share preview が本人の名前・説明・写真になっている
- admin password を本人だけが知っている

## 渡し方のおすすめ

### 技術に詳しくない人へ

Concierge setup がよい。

セットアップ担当者が Railway/Turso/R2/env/domain を作り、受け取る人には
admin URL と使い方だけ渡す。

### 自分で触れる人へ

Template copy がよい。

README とこの guide を渡し、本人が GitHub/Railway/Turso/R2 を自分で作る。

### 有料配布にする場合

まずは「テンプレート単体」より「セットアップ込み」のほうが事故が少ない。

このサイトは写真の見せ方と初期品質が価値なので、env 設定で詰まって
未完成のまま放置されるより、最初だけ整えて渡すほうが完成度を守れる。

## サポート境界

Template v0 が面倒を見る範囲:

- portfolio site deployment
- admin-managed photos/settings/profile/contact
- image optimization and R2 storage
- sitemap / OGP / basic SEO

Template v0 が面倒を見ない範囲:

- account system
- client proofing
- booking/payment
- multi-language workflow
- automatic custom-domain purchase
- ongoing SaaS-style updates
