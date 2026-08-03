---
paths:
  - "packages/web/src/web/**"
---
API クライアントは `packages/web/src/web/lib/api.ts` の Hono 型付きクライアントを使う。フロントエンドから直接 `fetch` を呼ばない。

書き込み系リクエストの応答は、本文を読む前に必ず検証する。使い分けを間違えると無言で壊れる。

- admin 配下: `admin-shared.ts` の `assertOk` / `jsonOrThrow` を使う。401 をログイン画面へのリダイレクトとして扱うため、素の `res.ok` 検査に置き換えるとセッション切れが無言で失敗する。
- それ以外: `lib/api.ts` の `assertOk` / `jsonOrThrow`。

settings の保存は必ず `postAdminSettings()` を経由する。`assertOk` だけでは `ignoredKeys` を検出できず、「保存成功」の表示のまま一部が保存されない。

正本は `AGENTS.md`「製品コードの不変条件」。
