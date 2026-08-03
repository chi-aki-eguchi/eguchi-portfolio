# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-03 JST

- **Status:** Codex レーン確定 / 文書整理 第1・2段 完了 / **クレジット判定の作り直し完了**。
  commit 済み・push 未実施
- **Current owner:** Claude Code（停止中）
- **Branch:** `main` / **HEAD:** `SELF` / **origin/main:** `a3946fc` より 14 commits ahead
- **Git:** clean（未追跡は `scratch/` のみ・gitignore 対象）

### 目的と完了条件

1. **（完了）Codex のレーン運用を決める** — 安い Luna へ定型作業を逃がす。
2. **（第1・2段完了）文書整理** — AI が作業前に読む量が過大だった。
   オーナー判断は「全部やる」。完了条件は読む量が実際に小さくなること。

### 決まったこと（Codex レーン）

**レーン指定は `codex exec` のフラグ2つ**（`-m gpt-5.6-luna` / `-m gpt-5.6-terra` に
`-c model_reasoning_effort="max"`、読み取りは `-s read-only`）。実機確認済み。
Desktop app のエージェント選択は効かないため TOML は定義文書として維持し、依頼文の
下敷きに使う。判断が要る作業は Luna に投げない。詳細は `docs/agents/codex-workflow.md`。

**Luna 実測2件（読み取り棚卸し / 12ファイル移動＋参照52箇所置換）ともに合格。**
件数を自己検証し、範囲外の判断もせず、本文も書き換えなかった。消費は Codex 週枠で各約1%。

### 文書整理の実績（2026-08-03）

| 対象 | 前 | 後 |
|---|---:|---:|
| `task.md` 全体 | 9,974行 | **76行** |
| 起動時に読む Current State | 359行 | 66行 |
| docs/（archive 除く） | 83ファイル / 17,111行 | 52ファイル / 10,174行 |

- 第1段: Current State を圧縮。第2段: 被リンク0の specs 3件と `agent-logs` 12件を
  `docs/archive/` へ `git mv`（参照52箇所はパス置換のみ。Luna 実施・Claude 検証済み）
- **第3段: 過去 Handoff 133本と過去 Current State 3件を
  `docs/archive/task-handoffs.md` へ分離。`task.md` は Current State 専用にした。**
- **削除ゼロ。**移し先を git 内にしたのは、クラウド実行環境から Obsidian が
  読めないため（今回実証済み）。リポジトリの履歴は vault へ出さない。
- 見送り: `admin-enhancement-spec` の `-v2` 改名。3件は別内容で重複ではなく、
  12箇所から参照されるため費用対効果が低い
- `bun run check` / `bun run smoke` は**未実施**。AI運用・文書だけの変更のため

### 次の一手

1. **残る重複の解消（未着手）** — `withRetry` 等の規則が `.claude/` 配下4箇所に
   転記されたまま。サブエージェントやスキルは `AGENTS.md` を自動で読まない可能性が
   あるため、消す前に確認が要る。
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
