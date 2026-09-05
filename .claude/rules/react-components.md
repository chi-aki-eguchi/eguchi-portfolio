---
paths:
  - "packages/web/src/web/**/*.tsx"
  - "packages/web/src/web/**/*.ts"
---
React、Tailwindと既存の共通コンポーネントを使い、Propsに型を付ける。共通のCSS変数は `provider.tsx` を確認する。
データ取得はTanStack Queryを基本にする。settings同期と更新後の再取得はルート `AGENTS.md` を参照する。
Lightboxやレイアウトの変更も依頼に応じて行える。既存のキーボード操作・画像表示・未知の設定値のフォールバックを関連テストで確かめる。
