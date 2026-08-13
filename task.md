# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-14 JST

- **Status:** 配布版Postgresの写真API 500 をローカル修正済み。Claude Codeのread-only検証待ち。
- **Current owner:** Codex（実装完了） / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF` / **Git・originとの差:** `git status --short --branch` で測る

### 完了した変更

- 新規Postgres migration 0002_add_photo_source_metadata を追加。photos の不足7列を
  ADD COLUMN で追加し、既存行の shot_at_source はDB既定値 legacy になる。
- schema.postgres.ts、最新Drizzle snapshot、journalに載る全SQL migrationの列集合を
  比べるPostgres schema契約チェックを追加し、bun run check の先頭で必ず実行する。
- APIのunhandled errorはDrizzle/pgのcauseとDB error codeを残しつつ、接続URLと
  password・token等の値を伏せてログへ出す。
- SQLite schema、withRetry、起動時migrationの6回リトライと失敗時exit(1)は変更していない。

### 検証済み

- schemaに一時的な未migration列を足すと契約チェックが失敗し、削除後に成功することを実測。
- bun run check 成功（Postgres契約チェック、typecheck、lint、test、tools、build）。
- DATABASE_PROVIDER=postgres bunx turbo build --force 成功（外部DBへは未接続）。
- git diff --check 成功。

### 未検証 / 境界

- Railway、PostgreSQL実DB、Turso、R2、環境変数、デプロイは未操作。
- 実際の起動時migrationと既存Postgresデータ上の GET /api/photos 成功は未検証。
- local commit: `git log -1 --oneline` で測る / push: オーナーのみ /
  Railway反映・本番確認: 未実施。

### 次の一手 / 禁止範囲

- Claude Codeが差分と検証結果をread-onlyで確認後、オーナーがpush可否を判断する。
- pushはオーナーのみ。Railway・本番DB・環境変数・デプロイは触らない。
- Codex session: 現在のrootセッション（別resume logなし）。
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
