# MacBook / Mac mini Workflow

このプロジェクトを MacBook と Mac mini の両方で触るときの基本ルールです。

## 結論

- コードの正本は GitHub。
- 本番反映は `git push` から Railway auto-deploy。
- 写真とサイト設定の正本は Turso / Cloudflare R2。
- `.env` は GitHub に入れず、各 Mac に同じ内容を置く。
- プロジェクトフォルダを iCloud Drive / Dropbox / Google Drive で丸ごと同期しない。

2台のMacを直接同期するのではなく、GitHub / Railway / Turso / R2 を中心にして、各Macがそこへ参加する形にします。

## 2台目の初回セットアップ

リポジトリは iCloud Drive などの同期フォルダの外に置きます。

```sh
mkdir -p ~/Projects
cd ~/Projects
git clone git@github.com:OWNER/eguchi-portfolio-app.git
cd eguchi-portfolio-app
bun install
cp .env.template .env
```

`OWNER` は実際の GitHub owner / organization に置き換えます。HTTPS で clone する場合は、GitHub の repo 画面に出ている HTTPS URL を使います。

`.env` には Turso、R2、admin password などを入れます。値は 1Password / Bitwarden / iCloud キーチェーンの安全なメモなどで管理し、チャットや GitHub には貼らないでください。

もっと楽にするなら、`.env` の手入力を自動化できます。

- 1Password CLI: ローカル専用のテンプレートを作り、`op inject -i .env.op.template -o .env` で生成する。
- Railway CLI: Railway にログインしたMacで `railway variables --json` を使い、本番変数を確認する。

どちらの場合も、出力された値や secret 参照用テンプレートは秘密情報として扱います。`.env` や secret を含むテンプレートは commit しません。

既存の本番/共通DBにつなぐだけなら、2台目セットアップ時に `db:push` を実行する必要はありません。`db:push` はスキーマを変える作業をしたときだけ、意図して実行します。

動作確認:

```sh
cd packages/web
bun x tsc -b
bun run build
bun run dev
```

## 作業開始時

```sh
git status --short
git pull --rebase
bun install
bun run dev
```

`git status --short` で未コミット変更が出ているときは、pull 前に commit / stash / 破棄のどれにするか決めます。特に MacBook と Mac mini の両方で同じファイルを同時に触ると conflict になりやすいので、片方の作業を push してからもう片方で pull します。

## 作業終了時

```sh
cd packages/web
bun x tsc -b
bun run build
cd ../..
git status --short
git add <changed-files>
git commit -m "..."
git push
```

`git push` は Railway の本番 auto-deploy につながります。途中の作業や壊れている状態は push せず、必要なら作業ブランチを使います。

## AI作業の引き継ぎ

- 共有したい恒久ルールは `AGENTS.md` に書く。
- 作業の引き継ぎは `task.md` に Handoff として残す。
- `.codex/USER_CONTEXT.md` はローカル専用なので、MacBook と Mac mini で自動共有される前提にしない。
- Mac を切り替える前に、必要な差分と Handoff を commit / push しておく。

## 避けること

- リポジトリ丸ごとの iCloud / Dropbox 同期。
- `.env`、APIキー、admin password の commit。
- `node_modules` や `dist` を手動で別Macへコピーすること。
- 片方のMacで未pushのまま、もう片方で同じ作業を進めること。
