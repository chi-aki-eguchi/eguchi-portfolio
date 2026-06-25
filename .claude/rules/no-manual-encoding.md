---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---
`Content-Encoding` ヘッダを手動で設定するコードを書かない。

Railway のリバースプロキシが自動処理する。手動設定すると二重圧縮になりブラウザでレスポンスが壊れる（§0 invariant）。

同様に、HTML レスポンスには必ず `Cache-Control: no-store` を設定する（OGP インジェクションの前提）。`server.ts` の既存パターンを踏襲する。
