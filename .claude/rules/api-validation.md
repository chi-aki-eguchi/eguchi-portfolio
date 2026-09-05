---
paths:
  - "packages/web/src/api/**"
---
エラーレスポンスは `{ error: string }` を基本にし、追加ルートを `AppType` に含める。
`POST /admin/settings` の `ignoredKeys` と呼び出し側 `postAdminSettings()` は一緒に扱う。
DBリトライと保存の共通条件はルート `AGENTS.md` にまとめてある。
