# ドキュメント索引

`AGENTS.md`「参照先」から 2026-08-20 に移設した。**常時読む必要はない。**
必要になったときに、ここから目的の文書を引く。

## いま必要になりやすいもの

| 知りたいこと | 文書 |
|---|---|
| 現在地・進行中の作業 | `task.md` 冒頭 Current State |
| 管理画面刷新の目的（6軸） | `docs/specs/admin-renewal-goal.md` |
| Claude / Codex の連携、Phase、モデルのレーン | `docs/agents/codex-workflow.md` |
| 引き継ぎ、Current State の書き方、オーナーへの報告 | `docs/agents/handoff-workflow.md` |
| クレジット残量の判定と行動 | `docs/agents/credit-status.md` |
| 未完了の作業 | `docs/agents/backlog.md`（完了したらこの文書から消す） |
| 測り方・存在しない不具合を作らない手順 | `docs/agents/measuring.md` |
| 高リスク領域の検査手順 | `docs/checklists.md` |
| 配布版（Portfolio Kit）のDB差分・運用 | `DISTRIBUTION.md` |
| 読む文書の棚卸し（2026-08 監査） | `docs/specs/reading-layer-audit-2026-08.md` |

## ディレクトリの役割

- `docs/specs/` — 現に有効な仕様。1仕様1ファイルで、その場で更新する。
- `docs/agents/` — **今も守る運用規則だけ。**1回限りの調査・レビュー記録は置かない。
- `docs/archive/` — 役目を終えた文書。**通常は読まない**（`AGENTS.md`「読まない場所」）。
- `knowledge/wiki/` — 索引・要約の層であって正本ではない。各ページの `last_verified`
  が古いものは `bun run check` が警告する（`scripts/ai/check-wiki-freshness.mjs`）。
- `scratch/` — 使い捨て。`scratch/README.md` 以外は gitignore 対象。

## オーナー向けの案内

- 全体の入口: `docs/owner-guide.md`
- 管理画面の使い方: `docs/admin-guide.md`
- デプロイ後の手順: `docs/post-deploy-guide.md`（英語版 `-en`）
- よくある質問: `docs/faq.md`
