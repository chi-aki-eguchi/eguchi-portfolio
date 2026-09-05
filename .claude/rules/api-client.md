---
paths:
  - "packages/web/src/web/**"
---
アプリ内APIは `lib/api.ts` の型付きクライアントを基本にする。外部API・ストリーミングなど、型付きクライアントが合わない用途では `fetch` も使える。
書き込み応答、adminの401、settings保存、画面のエラー表示はルート `AGENTS.md`「製品コードの不変条件」を参照する。
