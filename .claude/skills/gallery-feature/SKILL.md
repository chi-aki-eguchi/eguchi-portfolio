---
name: gallery-feature
description: カテゴリ・シリーズ・ギャラリーの設定や実装を変更する。
---
# ギャラリーとシリーズ

- `categories` はslug・label・順序、`series` はslug・題・説明・表紙・公開状態・`themeConfig` を持つ。写真は `category` / `seriesId` で関連付ける。
- コンテンツ追加は管理画面のCategories・Seriesから行える。コード変更が要るか、既存設定で完成するかを先に確かめる。
- シリーズ固有の `themeConfig` がない場合はグローバル設定を使う。写真ごとの `displaySize` は構成に応じたサイズ指定に使う。
- レイアウトの種類とフォールバックは現在の `PhotoGallery.tsx` と設定側を確認する。対応種類をこの文書に複製せず、新規レイアウトも依頼に応じて追加できる。
- 新規ページは `src/web/app.tsx` のルートと、API側の公開ルート・OGP・必要なsitemapを揃える（パスは `packages/web/` 基準）。
- 写真の公開や本番データ変更は依頼・承認範囲内で行う。共通の不変条件・検証・pushはルート `AGENTS.md` に従う。
