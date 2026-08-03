---
paths:
  - "packages/web/src/web/**"
---
API クライアントは `packages/web/src/web/lib/api.ts` の Hono 型付きクライアントを使う。フロントエンドから直接 `fetch` を呼ばない。

書き込み系リクエストの応答は、本文を読む前に必ず検証する。使い分けを間違えると無言で壊れる。

- admin 配下の新規・変更箇所: `admin-shared.ts` の `assertOk` / `jsonOrThrow` を使う。401 をログイン画面へのリダイレクトとして扱うため、素の `res.ok` 検査に置き換えるとセッション切れが無言で失敗する。`admin.tsx` は共通版を import せず独自定義を使う既存重複が残る未解消の技術的負債であり、統一済みとして扱わない。
- それ以外: `lib/api.ts` の `assertOk` / `jsonOrThrow`。

settings の保存は必ず `postAdminSettings()` を経由する。`assertOk` だけでは `ignoredKeys` を検出できず、「保存成功」の表示のまま一部が保存されない。

新しい書き込み処理には、応答検証に加えて、`onError` または try/catch による利用者へ見えるエラー表示を必ず付ける。応答検証は例外を投げるだけで、画面に出る保証はない。

正本は `AGENTS.md`「製品コードの不変条件」。
