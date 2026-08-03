# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-04 JST

- **Status:** AI運用の文書整理・クレジット判定の作り直し・backlog の実測が完了。
  製品コードは未着手。commit 済み・push 未実施
- **Current owner:** Claude Code（停止中）
- **Branch:** `main` / **HEAD:** `SELF` / **origin/main:** `d183fe8` より 2 commits ahead
- **Git:** clean（未追跡は `scratch/` のみ・gitignore 対象）

### 目的と完了条件

AI が作業前に読む量を減らし、規則の食い違いと埋もれた残作業を無くす。
完了条件は、次に来る AI が **backlog と Current State だけ見れば動ける**こと。

### 経緯と実績はここに書かない

正本は次のとおり。**この節を経過報告で太らせない。**

| 主題 | 正本 |
|---|---|
| 未完了の作業 | `docs/agents/backlog.md` |
| backlog 判定の根拠 | `docs/agents/backlog-verification.md` |
| 文書整理の調査 | `docs/agents/doc-cleanup-survey.md` / `pre-push-review.md` |
| クレジット判定 | `docs/agents/credit-status.md` / `credit-status-review.md` |
| ツール修正の検証 | `docs/agents/tooling-fix-review.md` |
| Codex レーンの使い方 | `docs/agents/codex-workflow.md` |

### 次の一手

1. **B-1（グローバルCSSの特異度）が最優先。** `!important` が実宣言216件
   （2026-07-26 の記録は145）、`.admin-atelier` の4回以上の重複が44箇所（記録14）。
   **直っておらず悪化している。**影響が管理画面全体に及ぶため、
   案(a)(b) をオーナーへ出して**止まる**こと。
2. 製品コードへ着手するなら B-3 / B-4（写真データの整合性）。
   **着手前にオーナーへ優先順位を確認する**（削除ロジックに触れるため）。
3. AI運用側の残り: hook の3軸分離は未完成 /
   製品コードの `assertOk` 3重定義 / 毎プロンプトのクレジット文の削減 /
   hook テストの外部依存。詳細は backlog と各レビュー記録。
4. push するか判断する（**push はオーナーだけ**）。

### 検証の状態

- `bun run check` **成功**（`test:tools` 24件を含む。2026-08-04）
- `bun run smoke` は**未実施**。製品コードを変更していないため
- `node scripts/ai/check-handoff-freshness.mjs` は `[handoff OK]`

### 触ってはいけない範囲

- push / deploy / 本番DB / Turso / R2 / Railway / env 変更
- `docs/archive/` と `docs/reports/` の**本文**（移動は可、書き換えは不可）
- 履歴文書の削除

### 記録

- Codex session ID は `scratch/codex-out-*.log` の先頭
- local commit: あり / push: 一部済み（`d183fe8` まで） /
  Railway 反映: 未確認 / 本番確認: 未実施
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
