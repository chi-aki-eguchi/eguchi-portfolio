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

## コミットまで（エージェントが行う範囲）

`git add -A` は使わない（無関係なファイルを巻き込むリスクがあるため禁止）。
まず `git status --short` で現在の変更を確認し、このタスクで実際に触ったファイルだけを
明示的に指定して stage する。

```sh
git status --short
git add <このタスクで変更したファイルを1つずつ列挙>
git commit -m "feat/fix/chore: 変更内容の説明"
```

- **`git push` はオーナーの手で行う。エージェントは実施しない**（AGENTS.md「完了の定義」）
- Railway は `main` ブランチへの push で自動デプロイ（push 後、数分でRailway反映）
- 本番確認: https://akieguchi.com（push・Railway反映後にオーナーが確認）

## DB マイグレーション

スキーマ変更を含む場合、`bun run db:push`（Turso 本番へ適用）は**本番DB書き込みのためエージェントは実行しない**。
スキーマ変更時は `schema.ts` と `schema.postgres.ts` の**両方**をコードとして更新し、
実行が必要なことと実行コマンドを決定ログ/Handoffに明記してオーナーに引き継ぐ。

## ロールバック

- `git revert HEAD` はエージェントが自動実行しない。必要になった場合は候補として
  内容（何をrevertするか・なぜ必要か）をオーナーに説明し、**オーナーの明示的な承認後にのみ**
  commitまで行う。その後の **push はオーナーが行う**
- または Railway ダッシュボードから前のデプロイに revert（オーナー操作）

## 注意事項

- `bun run deploy` は Runable 時代の legacy（`deploy:runable:legacy` に退避済み）。通常は使わない
- ZIP 作成は不要（2026-06 に Railway 移行済み）
- 環境変数は Railway ダッシュボードで管理（`.env` は gitignored のまま）
- 新しい環境変数を追加した場合は Railway ダッシュボードにも追加すること
