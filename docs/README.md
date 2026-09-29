# ドキュメント索引

作業方針は [AGENTS.md](../AGENTS.md)、現在地は [task.md](../task.md)。必要になったときに、この索引から目的の文書を引く。

## いま必要になりやすいもの

| 知りたいこと | 文書 |
|---|---|
| 管理画面を骨格に関係なく1つに（2026-09-29） | `docs/specs/admin-one-shell-20260929.md` |
| 「サイト」を見ながら直す画面（2026-09-29） | `docs/specs/admin-site-editor-20260929.md` |
| 管理画面の仕上げ（部分ごとの設定・効かない設定の実測・英語）（2026-09-30） | `docs/specs/admin-complete-20260930.md` |
| 全ページ・Adminの定型的な装飾とコピーの見直し | `docs/specs/editorial-ui-20260929.md` |
| 文字・余白・操作部品の仕上げ（2026-09-29） | `docs/specs/ui-polish-20260929.md` |
| 管理画面内のPDF作品集（2026-09-27） | `docs/specs/portfolio-pdf-v0.md` |
| 残件修正・最終配布版と復元の証拠 | `docs/specs/remaining-issues-20260928.md` |
| 未完了一覧の再確認・候補保存の修正 | `docs/specs/backlog-review-20260928.md` |
| 現在地・進行中の作業 | `task.md` 冒頭 Current State |
| 写真表示機能の統合と旧試作の扱い | `docs/specs/prototype-integration-20260928.md` |
| 紹介素材・About写真の仕上げ | `docs/specs/finish-review-20260928.md` |
| 写真中心への作り直し・1枚を複数シリーズへ（2026-09-26） | `docs/specs/photo-first-2026-09-26.md` |
| 写真管理・サイト編集の再設計（2026-09-13） | `docs/specs/admin-studio-2026-09-13.md` |
| 公開サイトの根本デザイン比較（2026-09-08） | `docs/specs/public-design-review-2026-09-08.md` |
| 2026年9月の管理画面・スマホ・公開サイト見直し | `docs/specs/usability-review-2026-09.md` |
| 管理画面刷新の目的（6軸） | `docs/specs/admin-renewal-goal.md` |
| 仕様書の索引（用途と優先順） | `docs/specs/README.md` |
| 未完了の作業 | `docs/agents/backlog.md`（完了したらこの文書から消す） |
| 測り方・存在しない不具合を作らない手順 | `docs/agents/measuring.md` |
| 分野別の確認ポイント | `docs/checklists.md` |
| Portfolio Kitの初回受注・納品の進め方 | `output/portfolio-kit-owner/owner-start-here.md`（手元の非公開資料） |
| Portfolio Kitの販売・納品・復元検証 | `docs/specs/portfolio-sales-readiness.md` |
| 配布版（Portfolio Kit）のDB差分・運用 | `DISTRIBUTION.md` |

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
