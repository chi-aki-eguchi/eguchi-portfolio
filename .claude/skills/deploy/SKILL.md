---
name: deploy
description: Railway へのデプロイ手順とデプロイ前チェックリスト。git push のみで自動デプロイ。
disable-model-invocation: true
---
# デプロイ手順

## デプロイ前チェック（必須）

```sh
# 1. 型チェック（--noEmit は0ファイル検査の罠。必ず -b）
cd packages/web && tsc -b

# 2. ビルド確認
cd packages/web && bun run build

# 3. lint（任意だが推奨）
cd packages/web && bun run lint
```

## デプロイ

```sh
git add -A
git commit -m "feat/fix/chore: 変更内容の説明"
git push   # Railway が自動ビルド → bun src/server.ts で起動
```

- Railway は `main` ブランチへの push で自動デプロイ
- デプロイ完了まで数分かかる
- 本番確認: https://akieguchi.com

## DB マイグレーション

スキーマ変更を含む場合は**デプロイ前**に手動実行:

```sh
cd packages/web && bun run db:push   # Turso (本番) に適用
```

スキーマ変更時は `schema.ts` と `schema.postgres.ts` の**両方**を更新してから実行すること。

## ロールバック

```sh
# git revert して再 push
git revert HEAD
git push

# または Railway ダッシュボードから前のデプロイに revert
```

## 注意事項

- `bun run deploy` は Runable 時代の legacy（`deploy:runable:legacy` に退避済み）。通常は使わない
- ZIP 作成は不要（2026-06 に Railway 移行済み）
- 環境変数は Railway ダッシュボードで管理（`.env` は gitignored のまま）
- 新しい環境変数を追加した場合は Railway ダッシュボードにも追加すること
