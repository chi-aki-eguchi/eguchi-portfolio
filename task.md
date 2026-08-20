# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-20 JST（4回目）

- **Status:** 起動時セーフティネットの修正、規則#11の書き戻し、片付け2件。
  **commit 済み・push なし。**
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF` / originとの差は
  `git status --short --branch` で測り直す

### 目的と完了条件

`open-issues` #18/#19 を閉じ、夜間ランの残骸を畳む。
正本は `docs/specs/reading-layer-audit-2026-08.md`。

### 完了（commit 済み・push なし）

1. **`ensureTursoColumns()` を9列→16列へ**（`f7825df`）。0005 の7列が
   安全網から漏れており、その列を持たない Turso DB で写真取得が500になる状態だった。
   既存9列は並び・型・既定値をそのまま。**テスト9件**（すべて :memory: SQLite）
2. 契約テストが、列表と migration の SQL の一致を見張る。
   **次に列を足す人が表を更新し忘れると `bun run check` が落ちる**
3. 規則#11「コメントには WHY を書く」を `.claude/rules/comments.md` へ
   書き戻した（`ee5fa5b`）。paths は `**/*.ts` `**/*.tsx` で**A層は増やしていない**
4. `docs/reports/night-20260707.md` → `docs/archive/` へ `git mv`（削除していない）
5. `codex-workflow.md` の `closing`（定義が消えた旧用語）を現行3軸の語へ差し替え

### 検証

- `bun run check` = **1028 tests / 0 fail**、`test:tools` 37 pass / 0 fail
- テストが素通りしないことを実測: 1列外すと8件、既定値を誤ると2件が落ちる
- `bun run smoke` は未実施（admin UI に差分なし）
- **本番DBには接続していない。**すべて使い捨ての :memory: SQLite
- 本番・Railway反映・実機は**いずれも未実施**

### 分かったこと（次に効く）

- **配布版はこの不具合を踏まない。**`DATABASE_PROVIDER=postgres` で別経路を通り、
  PostgreSQL 側は `0002_add_photo_source_metadata.sql` で対応済み。影響は Turso のみ
- 安全網は `0003`〜`0005` の16列が対象。**欠番 `0001` の2列は対象外**（それを欠く
  DB は全 migration より古く `db:push` しか道が無いため、実害は考えにくい）

### オーナー判断待ち

- **`docs/archive/task-handoffs.md:1355` に管理パスワードの平文**
- ローカルブランチ `improve/night-20260707`（origin に無い。8コミットの
  取り込み状況が未確認のため消していない）
- `hono` / `sharp` の更新（調査済み・未実行）
- backlog **B-19** / **B-15**

### 次の一手

- wiki の鮮度警告 残り8件。`deployment.md` と `project-overview.md` が次に効く
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
