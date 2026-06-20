# eguchi-portfolio-app

写真家ポートフォリオサイト。Hono (API) + React 19 (SPA) + Drizzle/Turso (SQLite) + Bun。Railway にデプロイ（git push で自動デプロイ）。

## AI共同作業メモ

- 2026-06-11: Codex が保守メンバーとして参加。以後、Claude Code / Codex が同じ仕様書と `task.md` を見て作業する前提。
- Claude Code / Codex は実装着手前に `task.md` の最新 Handoff を確認し、未完了・検証済み・触ったファイルを追記する。
- settings ライブプレビューの送信キーは `packages/web/src/web/lib/settings-preview.ts` が台帳。新規 settings キー追加時はここも更新し、`provider.tsx` の DB 適用 / preview 適用、API `/settings` の default を揃える。
- 2026-06-16: Runable → Railway 移行完了。デプロイ正本は `git push`。ZIP 作成・Runable publish は legacy 手順であり、通常作業では使わない。
- Runable 関連ファイル（`RUNABLE_AI.md`, `scripts/deploy.sh`, `packages/web/website.config.json`）は過去運用の参照用。復旧・検証で必要になった場合のみ、現行 Railway 方針との整合を確認してから `bun run deploy:runable:legacy` として使う。
- Codex は作業前に、存在すればローカル専用メモ `.codex/USER_CONTEXT.md` も読む。ここには秋さんの作業スタイル・好み・AI運用上の文脈を置く（`.codex/` は gitignore 済み、秘密情報は書かない）。

### Claude Code / Codex agmsg 運用

- agmsg team は `eguchi-portfolio`。Claude Code は `claude-driver`、Codex は `codex-reviewer`。
- 窓口AIは固定しない。ユーザーが話している方をそのタスクの主担当にし、もう片方は必要時だけ短く呼ぶ。
- 主担当AIは次の場合だけ agmsg で相手に相談する:
  - 設計判断が2択以上で迷う
  - 同じバグ修正を2回試して解決しない
  - DB / auth / deploy / settings / 画像処理など失敗時の影響が大きい箇所を触る
  - commit / push 前に高リスク差分のレビューが必要
- 相談は1セッション最大3回を目安にする。自動会議や雑談で両方のクレジットを消費しない。
- 相談文には必ず `目的` / `制約` / `触ったファイル` / `検証` / `返答形式` を含める。相手には「実装なし、P0/P1中心、短く」と依頼する。
- 相手AIからの返信は主担当AIが要約してユーザーへ伝える。ユーザーに agmsg の中継作業を戻さない。
- delivery mode は Claude Code `monitor`、Codex `turn` を基本にする。消費を抑えたい時は一時的に `off` へ落とす。

## スタック

| レイヤー | 技術 |
|---|---|
| ランタイム | Bun |
| API | Hono 4 (`.basePath('api')`) |
| フロントエンド | React 19 + Wouter + TanStack Query + Tailwind CSS 4 |
| DB | Drizzle ORM + Turso (libsql) |
| ストレージ | Cloudflare R2 (S3 互換) |
| 画像処理 | sharp (アップロード時に 3200px/mozjpeg q92 最適化、配信時にオンザフライリサイズ) |
| モノレポ | Bun workspaces + Turborepo |
| デプロイ | Railway (git push → 自動ビルド + `bun src/server.ts`) |

## プロジェクト構造

```
eguchi-portfolio-app/
├── packages/
│   └── web/                     # メインパッケージ（API + フロントエンド統合）
│       ├── src/
│       │   ├── api/
│       │   │   ├── index.ts     # Hono ルート全体（AppType エクスポート）
│       │   │   └── database/
│       │   │       ├── index.ts # Turso クライアント + withRetry
│       │   │       └── schema.ts# Drizzle スキーマ
│       │   ├── server.ts        # Bun.serve エントリ（OGP インジェクション含む）
│       │   └── web/
│       │       ├── app.tsx      # Wouter ルーティング
│       │       ├── pages/       # top, gallery, profile, contact, admin, admin-login
│       │       ├── components/  # Layout, PageTransition, provider, ui/
│       │       ├── hooks/
│       │       └── lib/
│       │           └── api.ts   # hono/client による型付き API クライアント
│       ├── drizzle/             # マイグレーションファイル
│       ├── vite.config.ts
│       └── website.config.json  # Runable legacy 設定（通常デプロイでは不使用）
├── ecosystem.config.cjs         # PM2 設定（本番起動）
├── task.md                      # 直近のタスクログ
├── admin-enhancement-spec.md    # 管理画面強化仕様書 P1〜P4（参照先）
├── admin-enhancement-spec-v2.md # 管理画面強化仕様書 v2 確定版（グループC〜F / Q1〜Q5）
├── design-spec.md               # デザイン仕様書（見た目・佇まいの設計図）
└── layout-patterns.svg          # レイアウトパターン参考図（design-spec と対）
```

## DB スキーマ

- `photos` — 写真（filename, url, title, meta, description, category, displaySize S/M/L, sortOrder）
- `categories` — カテゴリ（slug, label, sortOrder）
- `hero_photos` — トップページヒーロー写真（photoId, sortOrder）
- `site_settings` — サイト全体設定（key-value）

## 環境変数

`.env` をプロジェクトルートに置く（gitignored）。

```
DATABASE_URL=         # Turso libsql URL（コードは process.env.DATABASE_URL を参照）
DATABASE_AUTH_TOKEN=  # Turso 認証トークン
S3_ENDPOINT=          # Cloudflare R2 エンドポイント
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_BUCKET=
ADMIN_PASSWORD=       # 未設定だと管理ログイン無効（セッショントークンもこの値から導出）
PORT=4200
```

> 変数名は `.env.template` が正。DB は `DATABASE_URL` / `DATABASE_AUTH_TOKEN`（旧称 TURSO_* ではない）。

- API コード内では `process.env.VAR`
- ブラウザ公開が必要な場合のみ `VITE_` プレフィックスを付けて `import.meta.env.VITE_VAR`
- Drizzle CLI スクリプトは `bun --env-file=../../.env drizzle-kit ...`

## 開発

```sh
# フロントエンド + Vite dev server（API は hono-dev-plugin でプロキシ）
bun run dev

# DB 操作（packages/web から実行 or プロジェクトルートの turbo スクリプト）
bun run db:push        # スキーマ同期
bun run db:generate    # マイグレーション生成
bun run db:migrate     # マイグレーション実行
bun run db:studio      # Drizzle Studio
```

## 本番デプロイ（Railway）

```sh
cd packages/web && tsc -b && bun run build
git add -A && git commit -m "..."
git push              # Railway が自動ビルド → bun src/server.ts で起動
```

- Railway は `PORT` 環境変数（自動設定）を `process.env.PORT` 経由で受け取る（`server.ts` は `PORT ?? 3000`）
- `src/server.ts` が `Bun.serve` で静的ファイル配信 + API プロキシ + OGP インジェクションを担う
- 環境変数は Railway ダッシュボードで管理（`.env` は gitignored のままでよい）

### 実装完了時のデプロイ手順（必須ルール）

機能の実装・修正が一区切りしたら、毎回以下を実施する：

1. **Handoff 確認** — `task.md` の最新 Handoff と `git status --short` を確認。
2. **型チェック** — `cd packages/web && tsc -b`（`tsc --noEmit` は0ファイル検査の罠あり。必ず `-b`）。
3. **ビルド確認** — `cd packages/web && bun run build`。
4. **必要に応じてテスト** — 影響範囲がある場合は `cd packages/web && bun test ./src`、または該当 Playwright/手動確認。
5. **git push** — Railway が自動デプロイ。数分後に本番が更新される。
6. 報告に「**git push でデプロイしました**」と明記する。

```sh
cd packages/web && tsc -b && bun run build
git push
```

## ルーティング

| パス | 説明 |
|---|---|
| `/` | トップ（ヒーロー写真 + 最新作品） |
| `/gallery` | ギャラリー（カテゴリフィルタ + マソンリーグリッド） |
| `/about` または `/profile` | プロフィール |
| `/contact` | コンタクト |
| `/admin/login` | 管理ログイン |
| `/admin` | 管理画面（写真管理・設定） |
| `/api/*` | Hono API |
| `/api/images/:key?w=&q=` | R2 画像プロキシ（オンザフライリサイズ） |

## 管理画面

詳細仕様: `admin-enhancement-spec.md`

### 認証

- セッション Cookie (`admin_session`) で認証。`ADMIN_PASSWORD` 環境変数と照合。

### 既存タブ構成

| タブ | 内容 |
|---|---|
| GalleryTab | 写真一覧・アップロード・メタ編集・削除・並べ替え |
| HeroTab | トップヒーロー写真の選択・並べ替え |
| ProfileTab | プロフィール写真・テキスト設定 |
| CategoriesTab | カテゴリ管理・並べ替え |
| SettingsTab | タイポグラフィ・色・フォント等のサイト設定 |

### 実装ルール（§0 必須）

- DB クエリは必ず `withRetry(() => db....)` でラップ
- データ更新後は `qc.invalidateQueries({ queryKey: [...] })` で再取得
- **DB schema は2ファイル同期必須**（配布版の Railway/PostgreSQL 対応）。カラム追加・変更時は
  `schema.ts`（Turso/libSQL・本番）と `schema.postgres.ts`（PostgreSQL・配布版）の**両方**を
  同じカラム名で更新し（型は方言ごと: `integer({mode:"boolean"})`↔`boolean()`、
  `integer({mode:"timestamp"})`↔`timestamp()`）、`drizzle-kit generate` を両 config で再生成する。
  クエリは `./database`（`DATABASE_PROVIDER` 切替境界）から `schema` を import すること
  （`schema.ts` を直接 import しない）。PostgreSQL 側の更新漏れは配布版だけ壊し本番では気づけない。
  詳細は `DISTRIBUTION.md`「Schema is maintained in two files」。
- **新規 settingsキー追加時は以下3箇所を必ずセットで更新**:
  1. `admin.tsx` `SettingsTab` の `previewPayload` キー配列
  2. `provider.tsx` の DB適用 `useEffect`
  3. `provider.tsx` の `handlePreviewMessage`
- ライブプレビュー: 管理画面の iframe(`src="/"`) に `postMessage({ type: "preview-settings", settings })` を送信。受信は `provider.tsx` の `handlePreviewMessage`

### 仕様書（参照先）

| ファイル | 内容 |
|---|---|
| `admin-enhancement-spec.md` | 管理画面強化 P1〜P4（グループA: タイポグラフィ / グループB: 管理快適化）。下記「強化計画」を参照 |
| `admin-enhancement-spec-v2.md` | 続編・全項目確定版。グループC（写真管理を Lightroom/Bridge 化: 重複検知・範囲選択・キーボード・D&D・メタ表示）/ D（編集UI刷新: 折りたたみ・サイト文言整理・インスペクタ構造化・Typography軸別再編・プレビュー幅切替）/ E（閲覧側デザイン: ヒーロー・余白・トランジション・srcset・About土台）/ F（SEO）。着手順 Q1〜Q5。§0 既存パターン厳守 |
| `design-spec.md` | デザイン（見た目・佇まい）の設計図。雑誌/写真集的な編集された佇まい・写真主役・余白主導。秋が S/M/L サイズ指定＋並べ替えでレイアウトを演出する仕組み（完全自由配置はしない、レスポンシブ自動対応）。色/タイポ/余白/動き/画質の原則 |
| `layout-patterns.svg` | `design-spec.md` 1章のレイアウトパターン参考図（A: 不揃いグリッド / B: 見開き / C: ずらし大 / D: 整然グリッド） |

### 強化計画（admin-enhancement-spec.md）

#### グループA: タイポグラフィ編集強化

| ID | 内容 |
|---|---|
| A1 | 字間（letter-spacing）コントロール — 5つの CSS 変数（`--hero-name-tracking` 等）を追加、`styles.css` のハードコード `tracking-[...]` を変数参照に置換。**まずヒーロー/ナビ/セクション見出し3箇所のみ** |
| A2 | 行間（line-height）コントロール — `--body-leading` / `--section-leading` 追加 |
| A3 | フォントウェイト選択 — `--hero-name-weight` / `--body-weight`。選択肢はフォント定義から動的導出（固定リスト禁止） |
| A4 | モバイル縮小率 — `--mobile-scale`（0.6〜1.0、既定 0.78）を `@media (max-width: 768px)` で各サイズ変数に `calc` 適用。**優先度高（ヒーロー名はみ出し解消）** |
| A5 | フォントフォールバック修正（既知バグ） — `GOOGLE_FONTS_JA/EN` を `{ param, category: "serif"\|"sans-serif", weights: number[] }` 型に変更し、category に応じてフォールバックを切替 |
| A6 | フォントペアリングプリセット — ワンクリックで和英フォントを一括設定（Classic Mincho / Modern Serif / Quiet Sans / Editorial） |
| A7 | プレビュー体験改善 — 任意プレビュー文字入力・読込中スピナー・ウェイト別プレビュー |
| A8 | カスタムフォントアップロードのバリデーション — 受理拡張子 `.woff2/.woff/.ttf/.otf`、2MB 上限、`alert()` 廃止→インラインエラー |
| A9 | TypoControl 数値直接入力 — スライダーと双方向同期 |
| A10 | Typography セクション再編 — Font Pairing / Hero / Navigation / Section Labels / Body / Footer / Mobile のグループ折りたたみ |

#### グループB: 管理快適化

| ID | 内容 |
|---|---|
| B1 | 写真メタ保存フィードバック — `updatePhoto` 成功時に 1.5秒 "Saved" 表示 |
| B2 | 写真検索 — タイトル/meta/ファイル名でクライアント側フィルタ |
| B3 | **論理削除 + Undo（最重要）** — `photos.deletedAt` カラム追加（マイグレーション必要）。`DELETE` を論理削除に変更、`POST /restore`・`DELETE /purge` を新規追加。管理画面にゴミ箱ビューと Undo トーストを追加 |
| B4 | アップロード時 EXIF 自動補完 — `sharp().metadata()` から撮影日時を `meta` 初期値に設定（取得失敗時は空のまま） |
| B5 | 並び替え保存フィードバック — reorder 成功時にハイライトまたはトースト |
| B6 | キーボードショートカット一覧 — `?` キーでモーダル表示 |

### 実装フェーズ

| フェーズ | 項目 |
|---|---|
| **P1** | A5（フォールバック修正）/ A1（字間）/ A2（行間）/ B3（論理削除） |
| **P2** | A4（モバイル縮小）/ A7（プレビュー）/ B1（保存FB）/ B2（検索） |
| **P3** | A6（ペアリング）/ A3（ウェイト）/ A10（セクション再編）/ B4（EXIF） |
| **P4** | A8（アップロード検証）/ A9（数値入力）/ B5（並び替えFB）/ B6（ショートカット） |

### B3 実装時の注意

```sh
cd packages/web && bun run db:push  # deletedAt カラム追加
```
既存写真の `deletedAt` は null のまま（表示維持）。公開 `GET /photos` と管理一覧の通常取得に `isNull(photos.deletedAt)` を追加する。

## CSS カスタムプロパティ（サイト設定 → ページ反映）

`site_settings` テーブルに保存した値は `provider.tsx` が CSS 変数としてルート要素に注入する。

主なキー: `--nav-opacity`, `--footer-opacity`, `--sns-opacity`, `--hero-name-size`, `--hero-name-color`, `--hero-name-en-size`, `--hero-name-en-color`, `--hero-sub-size`, `--hero-sub-color`, `--section-label-size`, `--section-label-opacity`, `--heading-size`

## コーディング規約

- コメントは WHY が非自明な場合のみ。WHAT は書かない
- 型付き API クライアント（`lib/api.ts`）を使う。`fetch` を直接呼ばない
- フロントエンドの DB 直接アクセス禁止。必ず `/api/*` 経由
- lint: `oxlint`（`bun run lint`）
- 型チェック: `bun run typecheck`

## 注意事項

- `ADMIN_PASSWORD` 未設定時はサーバ起動は続行するが管理ログインが無効になる（警告ログのみ）
- R2 への画像は `3200px / mozjpeg q92 / 4:4:4` に最適化してから保存。元のサイズは保存しない
- in-memory LRU キャッシュ（バイト予算 256MB + 元画像 96MB/60s TTL）でサムネイルをキャッシュ
- 写真の複製（O1）は同じ R2 オブジェクトを共有する。purge は他に参照が無い場合のみ R2 から削除
- OGP メタタグはサーバサイドで `index.html` に注入（60 秒 TTL キャッシュ）
- テンプレート由来の `packages/mobile/`・`packages/desktop/` は 2026-06 に削除済み（パッケージは `web` のみ）
- ギャラリーレイアウトは 9 種（mosaic / grid / scroll / stagger / editorial / collage / clean-grid / masonry / large-format）。freeform / polaroid / timeline / fullbleed / compare は 2026-06 に削除。未知の値は mosaic にフォールバック
