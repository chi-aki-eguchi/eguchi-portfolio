---
paths:
  - "packages/web/src/api/**"
---
API ハンドラ（`packages/web/src/api/index.ts`）では DB クエリを必ず `withRetry(() => db....)` でラップする。

エラーレスポンスは `{ error: string }` 形式で統一する。

新しいルートを追加したら `AppType` エクスポートに含まれているか確認する（型付きクライアントの前提）。

`POST /admin/settings` は許可リスト外のキーを無視し、`ignoredKeys` で返す。この形を変えるときは、呼び出し側の `postAdminSettings()`（`admin-shared.ts`）も併せて直す。片方だけ変えると、画面は「保存成功」のまま一部が保存されない。
