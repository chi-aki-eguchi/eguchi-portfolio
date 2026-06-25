---
paths:
  - "**/drizzle/**"
  - "**/*.sql"
  - "**/schema.ts"
  - "**/schema.postgres.ts"
---
マイグレーションファイルは append-only。既存の `.sql` ファイルを編集・削除しない。

新しいマイグレーションは `bun run db:generate` で生成する（`packages/web/` から実行）。

**スキーマ2ファイル同期必須**: カラム追加・変更時は `schema.ts`（Turso/libSQL・本番）と `schema.postgres.ts`（PostgreSQL・配布版）の両方を同じカラム名で更新する。型の方言差に注意（`integer({mode:"boolean"})` ↔ `boolean()`、`integer({mode:"timestamp"})` ↔ `timestamp()`）。

クエリは `./database` からの `schema` import を使う。`schema.ts` を直接 import しない（DATABASE_PROVIDER 切替境界を壊す）。

Turso リモート DB に直接 `DROP TABLE` / `ALTER TABLE` を実行しない。
