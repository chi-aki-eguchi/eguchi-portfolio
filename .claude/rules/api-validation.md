---
paths:
  - "packages/web/src/api/**"
---
API ハンドラ（`packages/web/src/api/index.ts`）では DB クエリを必ず `withRetry(() => db....)` でラップする。

フロントエンドの書き込み系リクエスト後は `assertOk(res)` でレスポンスを検証する（`admin.tsx` パターン参照）。

エラーレスポンスは `{ error: string }` 形式で統一する。

API クライアントは `packages/web/src/web/lib/api.ts` の Hono 型付きクライアントを使う。フロントエンドから直接 `fetch` を呼ばない。

新しいルートを追加したら `AppType` エクスポートに含まれているか確認する（型付きクライアントの前提）。
