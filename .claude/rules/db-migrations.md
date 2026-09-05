---
paths:
  - "**/drizzle/**"
  - "**/drizzle-postgres/**"
  - "**/*.sql"
  - "**/schema.ts"
  - "**/schema.postgres.ts"
---
スキーマ同期と適用済みmigrationの扱いはルート `AGENTS.md` に従う。
TursoとPostgreSQLの型の方言差を確認し、必要なmigrationを各configで生成する。
生成と本番適用は別工程。適用経路と既存データへの影響は `docs/checklists.md` のDB節を確認する。
