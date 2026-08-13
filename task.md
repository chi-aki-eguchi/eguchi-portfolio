# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-14 JST

- **Status:** 配布版Postgresの写真API 500 は **push・Railway反映・実測まで完了。復旧確認済み。**
- **Current owner:** Sol（Claude Code） / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF` / **Git・originとの差:** `git status --short --branch` で測る

### 本番実測（2026-08-14、push後）

- テンプレート環境（PostgreSQL）: `/api/health` 200 / `/api/photos` **200・写真2枚**。
  build `c2e8f4ce`。**500は解消。**
- 本番 akieguchi.com（Turso）: `/api/health` 200 / `/api/photos` 200・**写真497枚**。
  同じ build へ更新されたが影響なし。
- 両環境とも RSS 136MB。**497枚を配信している本番でこの値**であり、写真枚数による
  メモリ破綻の兆候は現時点で無い（この数値は再測定できる。将来の事実として扱わない）。

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
