# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-20 JST（3回目）

- **Status:** wiki の再検証2ページと、夜間ラン記述の洗い出し。**commit 済み・push なし。**
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF` / originとの差は
  `git status --short --branch` で測り直す

### 目的と完了条件

鮮度警告に出た wiki を実装と突き合わせて直す。夜間ラン前提の記述を洗う。
正本は `docs/specs/reading-layer-audit-2026-08.md`（監査 + 実行記録3回分）。

### 完了（commit 済み・push なし）

1. `wiki/pages/invariants.md` を訂正。**11行が誤っていた**（CLAUDE.md /
   AGENTS.md / task.md への行番号引用が全滅、#3と#13が別のルールファイルを
   指していた、存在しない「14番目のStop hook」）
2. `wiki/pages/database.md` を訂正。**4件が古く1件は当初から誤り**
   （withRetry の再試行条件に "Failed query" を挙げていたが逆）
3. 両ページの `last_verified` を今日へ。**日付だけ進めた箇所は無い**
4. 新しい gap を `open-issues.md` #18〜20 に記録
5. 夜間ラン記述の洗い出し。**対象4箇所には1件しか残っていない**（下記）

### 検証

- `bun run check` = **1019 tests / 0 fail**、`test:tools` **37 pass / 0 fail**、
  終了コード0。鮮度警告 10件 → **8件**
- `bun run smoke` は未実施（製品コードに差分なし）
- 本番・Railway反映・実機は**いずれも未実施**

### オーナー判断待ち（夜間ラン関連。触っていない）

- **N-1** `codex-workflow.md:165` の `closing` は旧判定の段階名で、現在の
  `credit-status.md` に定義が無い。文自体は有人でも要るので**語の差し替え案**
- **N-2** `docs/reports/night-20260707.md`（60行）は朝に読む前提の夜間レポート。
  archive 行き候補。ただし ws / js-yaml とR2リークの**当初記録**でもある
- **N-3** ローカルブランチ `improve/night-20260707` が残っている（origin には無い）

### オーナー判断待ち（その他）

- **`docs/archive/task-handoffs.md:1355` に管理パスワードの平文**
- `ensureTursoColumns()` が9列しか見ていない（schema は16列。open-issues #18）
- `hono` / `sharp` の更新（調査済み・未実行）
- backlog **B-19** / **B-15**

### 次の一手

- 鮮度警告の残り8件。`deployment.md` と `project-overview.md` が次に効く
- **中身を見ずに `last_verified` だけ進めない**

### 触ってはいけない範囲

- **push はオーナーのみ。**本番DB・Turso・R2・Railway・環境変数
- `shotAt` の保存方法、公開API応答形、Lightbox の既存ロジック
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
