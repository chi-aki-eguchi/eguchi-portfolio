# eguchi-portfolio-app

> akieguchi.com（個人ポートフォリオ・Hono構成）。Ivy's House（別リポジトリ・Astro）とは別物。混同しない。

写真家ポートフォリオサイト。Hono (API) + React 19 (SPA) + Drizzle/Turso (SQLite) + Bun。Railway デプロイ（git push で自動）。

## スタック

| レイヤー       | 技術                                                                  |
| -------------- | --------------------------------------------------------------------- |
| ランタイム     | Bun                                                                   |
| API            | Hono 4 (`.basePath('api')`)                                           |
| フロントエンド | React 19 + Wouter + TanStack Query + Tailwind CSS 4                   |
| DB             | Drizzle ORM + Turso (libsql)                                          |
| ストレージ     | Cloudflare R2 (S3 互換)                                               |
| 画像処理       | sharp (アップロード時 3200px/mozjpeg q92、配信時オンザフライリサイズ) |
| モノレポ       | Bun workspaces + Turborepo                                            |
| デプロイ       | Railway (git push → 自動ビルド + `bun src/server.ts`)                 |

## プロジェクト構造

```
packages/web/                  # メインパッケージ（API + フロントエンド統合）
├── src/
│   ├── api/index.ts           # Hono ルート全体（AppType エクスポート）
│   ├── api/database/          # Turso クライアント + withRetry + schema
│   ├── server.ts              # Bun.serve エントリ（OGP インジェクション含む）
│   └── web/
│       ├── app.tsx            # Wouter ルーティング
│       ├── pages/             # top, gallery, profile, contact, admin
│       ├── components/        # Layout, provider, ui/
│       └── lib/api.ts         # hono/client 型付き API クライアント
├── drizzle/                   # マイグレーション
└── vite.config.ts
```

## DB スキーマ

- `photos` — filename, url, title, meta, description, category, displaySize S/M/L, sortOrder
- `categories` — slug, label, sortOrder
- `hero_photos` — photoId, sortOrder
- `site_settings` — key-value

## 開発

```sh
bun run dev          # Vite dev server（API は hono-dev-plugin でプロキシ）
bun run db:push      # スキーマ同期
bun run db:generate  # マイグレーション生成
bun run db:studio    # Drizzle Studio
```

## デプロイ（Railway）

実装完了ごとに必ず実行：

```sh
cd packages/web && tsc -b && bun run build   # ① 型チェック + ビルド
git add ... && git commit && git push         # ② Railway 自動デプロイ
```

- `tsc --noEmit` は0ファイル検査の罠 — 必ず `tsc -b`
- 環境変数は Railway ダッシュボードで管理（`.env` は gitignored）
- 報告に「**git push でデプロイしました**」と明記

## §0 Invariants（必守）

1. **withRetry** — DB クエリは必ず `withRetry(() => db....)` でラップ
2. **Settings 4箇所同期** — 新規キー追加時:
   - `lib/settings-preview.ts` の `SETTINGS_PREVIEW_KEYS`（台帳）
   - API `GET /settings`（`api/index.ts`）の default 値
   - `provider.tsx` の DB適用 `useEffect`
   - `provider.tsx` の `handlePreviewMessage`
3. **assertOk** — 全書き込み API レスポンスの `res.ok` チェック
4. **No manual Content-Encoding** — Railway プロキシが自動処理。手動設定で二重圧縮になる
5. **DB schema 2ファイル同期** — `schema.ts`（Turso）と `schema.postgres.ts`（配布版）を両方更新。詳細は `DISTRIBUTION.md`
6. **invalidateQueries** — データ更新後は `qc.invalidateQueries({ queryKey: [...] })` で再取得

## コーディング規約

- コメントは WHY のみ。WHAT は書かない
- `lib/api.ts` の型付きクライアントを使う（`fetch` 直接呼び禁止）
- フロントエンドから DB 直接アクセス禁止 — `/api/*` 経由
- lint: `oxlint`（`bun run lint`）/ 型チェック: `bun run typecheck`

## 環境変数

`.env` をルートに配置（gitignored）。変数名は `.env.template` が正。

- `DATABASE_URL` / `DATABASE_AUTH_TOKEN` — Turso（旧 TURSO\_\* ではない）
- `S3_ENDPOINT` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_BUCKET` — R2
- `ADMIN_PASSWORD` — 未設定で管理ログイン無効
- `PORT=4200`

## AI並行運用（Codex）

- **agmsg team**: `eguchi-portfolio`。Claude Code = `claude-driver`、Codex = `codex-reviewer`
- Codex を呼ぶ条件: 設計判断で迷う / 同じバグ2回失敗 / 高リスク箇所 / push 前レビュー
- 相談上限: 1セッション最大3回。テンプレ: 目的/制約/触ったファイル/検証/返答形式
- §0 ルールは Codex にも同じく適用
- 実装着手前に `task.md` の最新 Handoff を確認

## 仕様書

| ファイル                       | 内容                                                            |
| ------------------------------ | --------------------------------------------------------------- |
| `admin-enhancement-spec.md`    | 管理画面強化 P1〜P4（タイポグラフィ A1-A10 / 管理快適化 B1-B6） |
| `admin-enhancement-spec-v2.md` | 続編 C〜F / Q1〜Q5（写真管理・編集UI・閲覧側・SEO）             |
| `design-spec.md`               | デザイン設計図（雑誌的佇まい・余白主導）                        |
| `refine-and-loop-spec.md`      | 自走改善ループ運用方針                                          |

## Compaction policy

When compacting, preserve:

- current task goal and next steps
- files changed in this session
- failing tests and exact errors
- §0 invariants

Drop:

- old exploration paths
- repeated logs
- file contents already committed

## 注意事項

- R2 画像: 3200px / mozjpeg q92 / 4:4:4 で保存。元サイズは保存しない
- LRU キャッシュ: サムネイル 256MB + 元画像 96MB/60s TTL
- OGP: サーバサイドで index.html に注入（60s TTL）
- ギャラリーレイアウト 9種: mosaic / grid / scroll / stagger / editorial / collage / clean-grid / masonry / large-format。未知値は mosaic フォールバック
- 写真複製は R2 オブジェクト共有。purge は他参照なしの場合のみ
- `test-*.mjs` は scratch スクリプト（管理パスワード含む可能性）— `git add .` でコミットしない

## Agent rules & knowledge index

Shared agent rules (Driver/Reviewer, wiki usage): see AGENTS.md.
Knowledge index: `knowledge/wiki/index.md` — the wiki is an index, NOT the
source of truth; canonical docs win on conflict.
