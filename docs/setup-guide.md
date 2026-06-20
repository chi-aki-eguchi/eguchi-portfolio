# Setup Guide

このガイドは、配布する側・セットアップ担当者向けです。

写真家本人が読む必要はありません。写真家本人には
[photographer-guide.md](./photographer-guide.md) と、サイトURL、管理画面URL、
管理パスワードだけを渡します。

> **2つの配布方法があります。**
>
> - **Railway 一本化（推奨・新）**: Turso も R2 も使わず、Railway だけで完結します。
>   「Deploy on Railway」ボタン → PostgreSQL と Storage を足す → 環境変数
>   （`DATABASE_PROVIDER=postgres` を含む）を入れる、で立ち上がります。
>   **database schema は起動時に自動で作られる**ので `db:push` は不要です。
>   手順は README の「Deploy on Railway (distribution template)」を参照。
> - **Turso + R2（このページ・従来）**: 下記の手順。保存先を個別に用意する方式で、
>   秋さん本番 `akieguchi.com` と同じ構成です。

## 考え方

最初の配布形態は、1人の写真家につき1つの専用サイトを作る方式です。

- サイトのファイル一式: GitHub に置く
- サイトの公開場所: Railway
- 設定や写真一覧の保存場所: Turso
- 写真ファイルの保存場所: Cloudflare R2
- 管理画面: 写真家本人が写真や文章を入れる場所

GitHub、Railway、Turso、R2 は写真家本人に説明しなくて大丈夫です。
セットアップ担当者が最初に用意し、本人には管理画面だけ渡します。

## セットアップ担当者が作るもの

1. GitHub でサイトのファイル一式をコピーする
2. Turso で新しい database を作る
3. Cloudflare R2 で新しい bucket と access key を作る
4. Railway で新しい service を作る
5. Railway に非公開の設定メモを入れる
6. database schema を反映する
7. build と公開確認をする
8. 写真家本人に、URL とパスワードだけ渡す

ここで言う database は、サイト名、説明文、写真一覧などの保存場所です。
bucket は、アップロードした写真ファイルそのものの保存場所です。

## Railway 設定

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

## Railway に入れる設定

`環境変数` は、パスワードや接続先を書く非公開の設定メモです。
GitHub には入れません。

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

## Database schema を反映する

schema は、database に「写真テーブル」「設定テーブル」などの形を作る作業です。

**Railway 一本化（PostgreSQL）の場合は、この作業は不要です。** サーバー起動時に
自動で適用されます（`DATABASE_PROVIDER=postgres` のとき）。失敗したら起動ログに
`[migrate]` の行で原因が出ます。

Turso + R2（従来）の場合のみ、手動で反映します。

```sh
cd packages/web
bun run db:push
```

これを忘れると、サイトは起動しても写真や設定を保存できません。

## 公開前チェック

```sh
cd packages/web
bun x tsc -b
bun run build
git push
```

`git push` は、変更を GitHub に送り、Railway に公開させる操作です。

公開後に確認するもの:

- `/` が表示される
- `/gallery` が空でも壊れない
- `/about` が本人情報、または汎用の表示になっている
- `/contact` が表示される
- `/admin/login` にログインできる
- `/api/settings` が 200 を返す
- title、SNS共有表示、canonical、sitemap が新しい domain になっている
- 秋さんの名前、写真、domain、GA ID が出ていない

## 写真家本人に渡すもの

渡すものはこの3つだけにします。

1. サイトURL
2. 管理画面URLとパスワード
3. [photographer-guide.md](./photographer-guide.md)

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
