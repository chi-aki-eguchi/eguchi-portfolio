---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---
`Content-Encoding` を付けるのは `packages/web/src/api/http-compression.ts` **だけ**。
他の場所で手を出さない。

禁止の理由は「本文を圧縮せずにヘッダだけ付ける」「既に付いている応答へ重ねる」で、
これが 2026-06-13 の二重圧縮事故。

**「Railway プロキシが圧縮するから origin は不要」は誤り**（2026-08-23 実測で訂正）。
プロキシは HTML と `/api` を gzip で圧縮するが、`/assets/*` は圧縮しない
（immutable で edge にキャッシュされる分）。だから origin 側でも圧縮している。
測り方は `docs/agents/measuring.md`。

同様に、HTML レスポンスには必ず `Cache-Control: no-store` を設定する（OGP インジェクションの前提）。`server.ts` の既存パターンを踏襲する。
