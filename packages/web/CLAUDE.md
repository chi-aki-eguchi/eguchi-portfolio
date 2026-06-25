# packages/web

フロントエンド（React 19 + Tailwind CSS 4）と API（Hono 4）が同一パッケージに同居している。

## ディレクトリ構成

```
src/
├── api/
│   ├── index.ts          # Hono ルート全体 + AppType エクスポート
│   ├── database/
│   │   ├── index.ts      # Turso/PostgreSQL 切替 + withRetry
│   │   ├── schema.ts     # Drizzle スキーマ（Turso/libSQL・本番）
│   │   └── schema.postgres.ts  # 配布版 PostgreSQL スキーマ
│   ├── ogp.ts            # OGP メタタグ生成 + BUILD_ID
│   └── site-defaults.ts  # サイトデフォルト値
├── server.ts             # Bun.serve エントリ
└── web/
    ├── app.tsx           # Wouter ルーティング
    ├── pages/            # top, gallery, profile, contact, admin, admin-login, series, service
    ├── components/       # Layout, Lightbox, PhotoGallery, provider, SeriesGrid 等
    ├── hooks/
    └── lib/
        ├── api.ts        # Hono 型付きクライアント（AppType）
        ├── settings-preview.ts  # settings キー台帳（SETTINGS_PREVIEW_KEYS）
        └── utils.ts
```

## コマンド

```sh
# 開発
bun run dev           # Vite dev server（hono-dev-plugin でAPIプロキシ）

# 確認（デプロイ前必須）
tsc -b                # 型チェック（--noEmit は0ファイル検査の罠。必ず -b）
bun run build         # tsc -b && vite build

# テスト
bun test ./src

# DB（packages/web から実行）
bun run db:push       # スキーマ同期（開発）
bun run db:generate   # マイグレーション生成
bun run db:migrate    # マイグレーション実行
```

## API 規約（src/api/）

- DB クエリは必ず `withRetry(() => db....)` でラップする
- 新しいルートを追加したら `AppType` エクスポートに含める
- エラーレスポンスは `{ error: string }` 形式で統一
- `Content-Encoding` を手動設定しない（§0 invariant）
- スキーマ変更時は `schema.ts` と `schema.postgres.ts` の両方を更新する

## フロントエンド規約（src/web/）

- API 呼び出しは `lib/api.ts` の型付きクライアントを使う（`fetch` 直呼び禁止）
- 書き込み系レスポンスは `assertOk(res)` で検証する（admin.tsx パターン参照）
- TanStack Query でデータ取得。更新後は `qc.invalidateQueries` で再取得
- **Lightbox は `Lightbox.tsx` の既存ロジックを壊さないこと**
- ギャラリーレイアウトは9種のみ（mosaic/grid/scroll/stagger/editorial/collage/clean-grid/masonry/large-format）
- **settings キー追加時は `settings-preview.ts` / API default / provider.tsx の DB適用・handlePreviewMessage の4箇所セットで更新**

## §0 必須チェック（実装完了ごと）

1. `withRetry` — 全 DB クエリをラップ
2. `assertOk` — 全書き込みレスポンスをチェック
3. settings 4箇所同期 — 新規キー追加時
4. `Content-Encoding` 手動設定なし
5. `tsc -b` + `bun run build` 通過
