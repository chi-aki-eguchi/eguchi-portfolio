---
paths:
  - "packages/web/src/web/**/*.tsx"
  - "packages/web/src/web/**/*.ts"
---

React 19 を使う。コンポーネントは default export、Props に型定義をつける。

Tailwind CSS 4 のユーティリティクラスを使う。カスタム CSS 変数は `provider.tsx` が root に注入する（`site_settings` テーブル由来）。

**Lightbox は既存の修正済みロジックを壊さないこと**（`Lightbox.tsx`）。

ギャラリーレイアウトは mosaic / grid / scroll / stagger / editorial / collage / clean-grid / portrait-grid / landscape-grid / masonry / large-format / justified の12種のみ（2026-07-09: オーナー承認により9種から拡張、portrait-grid/landscape-gridを追加。2026-07-12〜13: justifiedを追加）。未知の値は mosaic にフォールバック。freeform / polaroid / timeline / fullbleed / compare は削除済み — 復活させない。

データ取得は TanStack Query を使う。更新後は `qc.invalidateQueries({ queryKey: [...] })` で再取得する。

**新規 settings キー追加時は4箇所セットで更新**:

1. `lib/settings-preview.ts` の `SETTINGS_PREVIEW_KEYS`
2. API `GET /settings` の default 値
3. `provider.tsx` の DB 適用 `useEffect`
4. `provider.tsx` の `handlePreviewMessage`
