---
name: gallery-feature
description: 新しいカテゴリ・シリーズを追加する手順。ギャラリーレイアウト変更、シリーズ作成、写真割り当てを含む。
---
# ギャラリー・シリーズ追加手順

## DB スキーマ（関連テーブル）

- `categories` — ギャラリーのカテゴリフィルタ（slug, label, sortOrder）
- `series` — 作品群（slug, title, subtitle, statement, coverPhotoId, sortOrder, isPublished, themeConfig）
- `photos` — 写真（category, seriesId で分類。filmType: "フィルム" | "デジタル"）

## 新規カテゴリ追加

1. 管理画面の **Categories タブ** から追加
2. `slug`（URLに使うID）と `label`（表示名）を設定
3. ギャラリーページ（`/gallery`）のカテゴリフィルタに自動で表示される
4. 写真の `category` フィールドにこの slug を設定すれば絞り込みが効く

## 新規シリーズ追加

1. 管理画面の **Gallery タブ → Series セクション** から追加
2. 設定項目:
   - `slug` — URL パス（`/series/xxx`）
   - `title` / `subtitle` — 表示名
   - `statement` — コンセプト文（任意）
   - `coverPhotoId` — 表紙写真（後から設定可）
   - `sortOrder` — シリーズ一覧での表示順
   - `isPublished` — 公開/非公開
   - `themeConfig` — JSON形式のレイアウト設定（null でグローバル設定に従う）
3. 写真の `seriesId` にシリーズのIDを設定すると、シリーズ詳細ページ（`/series/xxx`）に表示される

## ギャラリーレイアウト（9種）

有効なレイアウト値（未知の値は `mosaic` にフォールバック）:

| 値 | 説明 |
|---|---|
| `mosaic` | 不揃いグリッド（デフォルト） |
| `grid` | 整然グリッド |
| `scroll` | 横スクロール |
| `stagger` | ずらしレイアウト |
| `editorial` | 雑誌的 |
| `collage` | コラージュ |
| `clean-grid` | クリーンな格子 |
| `masonry` | マソンリー |
| `large-format` | 大判 |

レイアウトは `themeConfig`（シリーズ単位）または **Settings タブ** のグローバル設定で変更。

## 写真のサイズ指定（S/M/L）

`displaySize` フィールド（S/M/L）でギャラリー内の表示サイズを制御。秋がこれを使ってレイアウトを演出する仕組み（完全自由配置はしない）。

## コード変更が必要な場合

### ギャラリーページ追加時

`packages/web/src/web/app.tsx` にルートを追加:
```tsx
<Route path="/gallery/new-path" component={NewGalleryPage} />
```

### 新規ページ追加時の注意

`src/api/ogp.ts` の OGP 生成ロジックに新ルートを追加すること（OGP が `/` にフォールバックするのを防ぐ）。

## §0 チェック（コード変更を含む場合）

- `withRetry` — 新規 DB クエリは全てラップ
- `qc.invalidateQueries` — データ更新後に再取得
- `tsc -b` + `bun run build` 通過後に `git push`
