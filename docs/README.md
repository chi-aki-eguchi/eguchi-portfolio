# ドキュメント索引

作業方針は [AGENTS.md](../AGENTS.md)、現在地は [task.md](../task.md)。必要になったときに、この索引から目的の文書を引く。

## いま必要になりやすいもの

| 知りたいこと | 文書 |
|---|---|
| 現在地・進行中の作業 | `task.md` 冒頭 Current State |
| 管理画面刷新の目的（6軸） | `docs/specs/admin-renewal-goal.md` |
| 仕様書の索引（用途と優先順） | `docs/specs/README.md` |
| 未完了の作業 | `docs/agents/backlog.md`（完了したらこの文書から消す） |
| 測り方・存在しない不具合を作らない手順 | `docs/agents/measuring.md` |
| 高リスク領域の検査手順 | `docs/checklists.md` |
| 配布版（Portfolio Kit）のDB差分・運用 | `DISTRIBUTION.md` |

> 引き継ぎの手順書とクレジット判定の文書は、2026-08-27 に儀式が多すぎるとして
> `docs/archive/` へ移した（`handoff-workflow.md` / `credit-status.md`）。

## ディレクトリの役割

- `docs/specs/` — 現に有効な仕様。1仕様1ファイルで、その場で更新する。
- `docs/agents/` — backlogと必要時に使う測定手順。
- `docs/archive/` — 役目を終えた文書。経緯を調べるときに使い、古い命令を現行ルールとして扱わない。
- `knowledge/wiki/` — 索引・要約の層であって正本ではない。各ページの `last_verified`
  が古いものは `bun run check` が警告する（`scripts/ai/check-wiki-freshness.mjs`）。
- `scratch/` — 試作・検証資料。`scratch/README.md` 以外はgit管理外。再利用する内容を確認してから整理する。

## オーナー向けの案内

- **壊れたときの戻し方: `docs/rollback-guide.md`（コピペで実行できる形）**
- 全体の入口: `docs/owner-guide.md`
- 管理画面の使い方: `docs/admin-guide.md`
- デプロイ後の手順: `docs/post-deploy-guide.md`（英語版 `-en`）
- よくある質問: `docs/faq.md`
