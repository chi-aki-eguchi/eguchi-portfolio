---
paths:
  - "packages/web/src/api/**"
  - "packages/web/src/server.ts"
---
圧縮処理は `api/http-compression.ts` で本文とヘッダーを一緒に扱う。ヘッダーだけの追加や二重圧縮を避ける。
ヘッダーの読み取り・テスト・圧縮モジュールの修正は可能。詳細な確認方法は `docs/checklists.md` の画像節。
