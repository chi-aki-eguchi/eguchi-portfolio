# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-03 JST

- **Status:** Codex レーン確定 / 文書整理 第1〜3段 完了 / クレジット判定の作り直し完了 /
  **Sol の独立調査で残課題を洗い出し済み**。commit 済み・push 未実施
- **Current owner:** Claude Code（停止中）
- **Branch:** `main` / **HEAD:** `SELF` / **origin/main:** `a3946fc` より 14 commits ahead
- **Git:** clean（未追跡は `scratch/` のみ・gitignore 対象）

### 目的と完了条件

1. **（完了）Codex のレーン運用を決める** — 安い Luna へ定型作業を逃がす。
2. **（第1・2段完了）文書整理** — AI が作業前に読む量が過大だった。
   オーナー判断は「全部やる」。完了条件は読む量が実際に小さくなること。

### 経緯と実績

**ここには書かない。** Codex レーンの使い方は `docs/agents/codex-workflow.md`、
文書整理の経緯と残課題は `docs/agents/doc-cleanup-survey.md`、クレジット判定は
`docs/agents/credit-status.md` と `credit-status-review.md` が正本。

**この節を経過報告で太らせないこと。**Current State は「今どこにいて次に何をするか」
だけを書く場所で、30〜60行に保つ。終わったことは正本側へ移す。

`bun run check` / `bun run smoke` は**未実施**。AI運用・文書だけの変更のため。

### 次の一手

1. **残課題は `docs/agents/doc-cleanup-survey.md`（Sol 独立調査）の推奨表が正本。**
   優先順は P0 古い導線の修正（着手済み）→ P1 `.claude/rules` の整理と
   `assertOk` 合格条件の統一 → P1 毎プロンプトのクレジット文の削減 →
   P1 ARCHIVED 文書の移動（**未完了事項の抽出が先**）→ P2 索引化・月別分割・改名。
   **`docs/agents/task-queue.md` を archive へ動かさない。**未完了の作業
   （孤児R2オブジェクトのP2×4、セットアップ完了の穴、CSS構造問題）が入っている。
2. **（完了）クレジット判定の作り直し** — Phase C 反対レビュー → Terra 実装 →
   Claude 独立検証。単一の深刻度をやめ3軸（取得状態 / 週枠 / 作業継続性）へ分離し、
   行動は「範囲を縮める」「再開可能な区切りを作る」の2つ、命令形は廃止。
   現存バグ（時計が戻ると古い cache を fresh 扱い）も修正。**反論の全文と採否は
   `docs/agents/credit-status-review.md`。要約で上書きしない。**
3. **オーナー保留**: 古いログを「必要部分だけ書き写して削除」する案。Claude の見解は
   「git 履歴が既にアーカイブなので、移動で十分。消すなら移動後の状態を見てから」。
4. push するか判断する（**push はオーナーだけ**）。14 commits 未 push。

### 触ってはいけない範囲

- push / deploy / 本番DB / Turso / R2 / Railway / env 変更
- 製品コード（`packages/`）— 今回の一連の差分に無し
- 履歴文書の削除。整理は `git mv` と要約までとし、消さない。

### 記録

- Codex session: `scratch/codex-out-luna-inventory.log` と
  `scratch/codex-out-luna-agentlogs.log` の先頭に session ID
- local commit: 14本（`64ac597`〜HEAD）
- push: 無し / Railway 反映: 無し / 本番確認: 無し
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
