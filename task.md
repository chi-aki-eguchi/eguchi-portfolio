# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-06 JST

- **Status:** 公開サイト＋管理画面のデバッグを4巡し24件修正、オーナーが push 済み。
  **いまは Codex が「大きいバグ」の発見と修正を担当する段階。**
- **Current owner: Codex**（Claude Code は停止し、read-only の検証役に回る）
- **Branch:** `main` / **HEAD:** `SELF`
- **Git:** clean（未追跡は `scratch/` のみ・gitignore 対象）
- push 状況・ahead 件数はここに書かない（すぐ古くなる）。
  `git status --short --branch` で測る

### いま Codex に依頼していること

`scratch/codex-bigbug-brief.md` が依頼の正本。要点だけ再掲する。

**対象は「大きい」5分類のみ** — データが壊れる/消える、保存したつもりが保存
されていない、間違ったものが見えている、サイトやadminが使えなくなる、
セキュリティ。**余白・文言・色・タップ判定は今回の対象外。**

前回 Phase A（`docs/agents/codex-debug-2026-08-05.md`）の推奨 2・3・4・6・8・9 は
未着手で着手対象に含めてよい。ただしそれが全部とは限らない。

### 完了済み（2026-08-05、push 済み）

設定が効かない系4件 / 表示されない・触れない系3件 / 操作系5件 /
スマホadmin 5件 / 壊れた時の表示1件 / Codex推奨1（派生画像のR2孤立）と
7（Serviceリンク・カスタムフォント）。詳細は git log と
`docs/agents/codex-debug-2026-08-05.md`。

### 未検証・未着手

- **Railway 反映と本番での確認は未実施**（push はしたが本番を見ていない）
- Codex 推奨 2・3・4・6・8・9 は未着手
- Codex 推奨 5（回転時の focal point）は**オーナー判断待ち**

### 次の一手

1. Codex が「大きい」不具合を実物で再現し、確認できたものだけ
   テスト付き・1件1commit で直す
2. Claude Code が差分を read-only で独立検証する
3. push はオーナーだけ

### 触ってはいけない範囲

- `git push` / 本番DB / Turso / R2 / Railway / 環境変数 / 公開設定
- `bun run smoke` の実行（本番と同じDBにつながる）
- `.env`・APIキー・トークンの表示と記録
- `docs/archive/` の本文
- Lightbox は「既存の修正済みロジックを壊さない」対象
- 写真の並べ替えは `photo-reorder-safety.ts` の競合検知を壊さない

### 検証

- 製品コード変更後は `bun run check`（リポジトリルート）
- 回帰テストは**修正を戻すと落ちる**ことまで確認する
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
