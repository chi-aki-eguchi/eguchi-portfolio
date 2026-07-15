# Setup Guide

このガイドは、配布する側・セットアップ担当者向けです。

写真家本人が読む必要はありません。写真家本人には
[photographer-guide.md](./photographer-guide.md)（自分で立ててもらう場合は
[post-deploy-guide.md](./post-deploy-guide.md) も）と、サイトURL・管理画面URL・
管理パスワードを渡します。

納品済みサイトへ最新版を届けるときは、作り直さず
[配布先サイトの更新手順](./template-update-guide.md) を使います。写真・文章・管理設定を
残したまま、セットアップ担当者がRailwayで約10分で更新します。

> **配布方法は2つ。まず方法1（Railway テンプレート）を検討してください。**
>
> - **方法1: Railway テンプレート（推奨）** — Turso も R2 も使わず、Railway だけで
>   完結します。Deploy ボタン → 変数を入れる → 公開、で立ち上がり、database schema は
>   起動時に自動作成されます（`db:push` 不要）。非エンジニアの写真家本人でも、
>   [post-deploy-guide.md](./post-deploy-guide.md) を見れば自力で立てられます。
> - **方法2: Turso + R2（従来・上級者向け）** — 保存先を個別に用意する方式。秋さん本番
>   `akieguchi.com` と同じ構成です。既存の Turso/R2 を使いたい場合や、Railway 以外で
>   運用したい場合の選択肢です。

## 考え方

配布の基本形は、1人の写真家につき1つの専用サイトを作る方式です。
GitHub / Railway / Turso / R2 や環境変数は、セットアップ担当者だけが見ます。
写真家本人に渡すのは、原則として管理画面（URL とパスワード）だけです。

- 管理画面: 写真家本人が写真や文章を入れる場所。
- それ以外（公開場所・保存場所・設定メモ）は、担当者が先に用意します。

---

## 方法1: Railway テンプレート（推奨）

一番かんたんで、毎回の手順が少ない方法です。PostgreSQL と Storage が Railway 側に
含まれるので、Turso や R2 を別に用意する必要がありません。

### だれが立てるか（2通り）

- **写真家本人にまかせる（おすすめ）**: 購入者向けの setup link と
  [post-deploy-guide.md](./post-deploy-guide.md) を渡すだけ。本人が自分で
  立てられます。専門用語なしの手順書です。
- **担当者が代わりに立てる（コンシェルジュ）**: 下の手順で担当者がデプロイし、
  最後に URL と管理パスワードだけ本人に渡します。

### 手順（担当者が立てる場合）

1. 購入者向けに管理している Railway setup link を開く。
2. デプロイ画面の変数で **`ADMIN_PASSWORD`** に管理パスワードを入れる
   （本人に決めてもらう、または担当者が決めて後で伝える）。ほかの変数は
   テンプレート既定のままでよい。
3. **Deploy** → すべてのサービスが緑（Active）になるまで待つ。
4. **web** サービス → **Settings → Networking → Generate Domain** で公開URLを作る。
5. `/api/health` が 200、`/admin/login` でログインできることを確認。
6. 本人に **サイトURL** と **管理パスワード** を渡す（必要なら
   [post-deploy-guide.md](./post-deploy-guide.md) も）。

### テンプレート側の注意（保守者向け）

- **`ADMIN_PASSWORD` に共通の初期値（`test-pass` など）を入れない。** 入れると配布した
  全員が同じ既知パスワードになります。`${{ secret() }}` も使わない（本人がログインに
  使う値なので、知っている必要があります）。詳細は README の保守者ノート。
- テンプレートの web サービスは **Start Command** `bun packages/web/src/server.ts`、
  **Healthcheck** `/api/health` を明示設定します（repo の `railway.json` は本番保護の
  ため置いていません）。
- database schema は起動時に自動適用されます（`DATABASE_PROVIDER=postgres`）。
  `db:push` は不要。失敗時は起動ログの `[migrate]` 行に原因が出ます。
- 既存サイトの更新はRailwayのtemplate更新通知を優先します。通知が無く元repoの`main`へ
  直接接続している場合は、Command Paletteの`Deploy Latest Commit`を使います。
  過去deploymentの`Redeploy`は選んだ古いコードを再利用するため、更新になりません。

---

## 方法2: Turso + R2（従来・上級者向け）

保存先を個別に用意する方式です。秋さん本番 `akieguchi.com` と同じ構成で、Railway とは
別に Turso（データベース）と Cloudflare R2（写真ファイル）を使います。

ここで言う database は、サイト名・説明文・写真一覧などの保存場所です。
bucket は、アップロードした写真ファイルそのものの保存場所です。

### セットアップ担当者が作るもの

1. GitHub でサイトのファイル一式をコピーする
2. Turso で新しい database を作る
3. Cloudflare R2 で新しい bucket と access key を作る
4. Railway で新しい service を作る
5. Railway に非公開の設定メモ（環境変数）を入れる
6. database schema を反映する
7. build と公開確認をする
8. 写真家本人に、URL とパスワードだけ渡す

### Railway 設定

Railway service は GitHub のコピー先につなぎます。

Root directory:

```text
packages/web
```

Start command:

```sh
bun src/server.ts
```

Railway 側で `PORT` は自動設定されるので、通常は手入力しません。

### Railway に入れる設定

`環境変数` は、パスワードや接続先を書く非公開の設定メモです。GitHub には入れません。

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

`www.example.com` と `example.com` の両方を使う場合だけ、追加します。

```sh
ALLOWED_ORIGINS=https://www.example.com
```

### Database schema を反映する

schema は、database に「写真テーブル」「設定テーブル」などの形を作る作業です。
方法2（Turso）では手動で反映します。

```sh
cd packages/web
bun run db:push
```

これを忘れると、サイトは起動しても写真や設定を保存できません。
（方法1（Railway PostgreSQL）では起動時に自動で適用されるので、この作業は不要です。）

---

## 公開前チェック（どちらの方法でも）

コードを変更した場合だけ、先にビルドして反映します（方法2、または改修時）。

```sh
cd packages/web
bun x tsc -b
bun run build
git push
```

`git push` は、変更を GitHub に送り、Railway に公開させる操作です。
（方法1でテンプレートからそのまま立てた場合は、この build/push は不要です。）

公開後に確認するもの:

- `/` が表示される
- `/gallery` が空でも壊れない
- `/about` が本人情報、または汎用の表示になっている
- `/contact` が表示される
- `/admin/login` にログインできる
- `/api/settings` が 200 を返す
- `/api/health` が 200 を返す
- title、SNS共有表示、canonical、sitemap が新しい domain になっている
- 秋さんの名前、写真、domain、GA ID が出ていない

## 写真家本人に渡すもの

渡すものはこの3つ（自分で立ててもらう場合は4つ目も）にします。

1. サイトURL
2. 管理画面URLとパスワード
3. [photographer-guide.md](./photographer-guide.md)
4. （自分で立ててもらう場合）[post-deploy-guide.md](./post-deploy-guide.md)

GitHub、Railway、Turso、R2、環境変数は渡さなくて大丈夫です。

## 混同防止

配布先のコピーを作ったら、そのコピーの `CLAUDE.md` や作業メモの冒頭に、
次のような一文を入れます。

```text
このサイトは <photographer-name> さん向けの配布版です。
akieguchi.com 本番とは別物です。
```

これを入れておくと、AI や保守担当者が秋さん本番サイトと配布先サイトを
混同しにくくなります。
