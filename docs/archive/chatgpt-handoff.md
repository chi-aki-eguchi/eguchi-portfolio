# ChatGPT 引き継ぎ文書 — eguchi-portfolio-app

> この文書は ChatGPT に渡して読んでもらうためのもの。
> ChatGPT の役割は「Claude Code に投げるプロンプトを作成すること」。
> 実装は一切しない。Claude Code が実装する。

---

## あなた（ChatGPT）の役割

秋くん（江口秋）は写真家で、自分のポートフォリオサイト `akieguchi.com` を AI で開発・運用している。実装を担当しているのは **Claude Code**（Anthropic の CLI エージェント）で、ターミナルから直接コードを読み書きし、ビルド・テスト・git push まで自律的に行う。

ChatGPT に求めるのは **Claude Code に渡すプロンプト（指示書）の作成** だけ。つまり:

1. 秋くんから「こういうことをしたい」と相談を受ける
2. このプロジェクトの構造・制約・現在の状態を踏まえて、Claude Code が迷わず正確に実装できる詳細なプロンプトを書く
3. 秋くんがそのプロンプトを Claude Code に貼り付けて実行する

ChatGPT 自身がコードを書いたり、ファイルを編集したりする必要はない。

### プロンプト作成時の注意

- Claude Code は `CLAUDE.md`（後述）を自動的に読むので、そこに書いてある基本ルールは繰り返さなくてよい。ただし、今回のタスク固有の制約・手順・検証方法は明示する。
- Claude Code にはもう1体の AI「Codex」（OpenAI のエージェント）がレビュー役として付いている。高リスクな変更では agmsg（エージェント間メッセージ）で Codex にレビュー依頼を出すよう指示できる。
- プロンプトには以下を含めると Claude Code が迷わない: **目的** / **制約（触ってはいけないもの）** / **具体的な手順** / **検証コマンド** / **完了条件** / **Handoff（task.md への記録内容）**。
- 秋くんは「短く結果先出し、絵文字なし、淡々としたトーン」を好む。プロンプトもその方針で書く。

---

## プロジェクト概要

### 何のサイトか

写真家・江口秋の個人ポートフォリオサイト。公開URL: **https://akieguchi.com**。写真のギャラリー表示、シリーズ管理、プロフィール、お問い合わせ、管理画面（写真アップロード・設定変更・ライブプレビュー）を備えている。

加えて、このサイトを **他の写真家にも配布・販売する計画** が進行中。配布版は Railway のテンプレートとして提供し、購入者がワンクリックで自分のポートフォリオサイトを立てられることを目指している。販売ページは `/service`（Stripe Payment Link 接続済み、2コース: 自分で立てる ¥10,000 / おまかせ設定 ¥30,000）。

### 技術スタック

| レイヤー | 技術 |
|---|---|
| ランタイム | Bun |
| API | Hono 4（`/api` ベースパス） |
| フロントエンド | React 19 + Wouter（ルーティング）+ TanStack Query（データ取得）+ Tailwind CSS 4 |
| DB | Drizzle ORM + Turso（libSQL / SQLite）— 秋くん本番用 |
| DB（配布版） | Drizzle ORM + PostgreSQL（Railway 内蔵）— `DATABASE_PROVIDER=postgres` で切替 |
| ストレージ | Cloudflare R2（S3互換）— 写真の保存先 |
| 画像処理 | sharp（アップロード時 3200px/mozjpeg q92、配信時オンザフライリサイズ） |
| モノレポ | Bun workspaces + Turborepo |
| デプロイ | Railway（git push → 自動ビルド + `bun src/server.ts`） |

### リポジトリ構造

```
eguchi-portfolio-app/
├── packages/web/                  # メインパッケージ（API + フロントエンド統合）
│   ├── src/
│   │   ├── api/index.ts           # Hono ルート全体（AppType エクスポート）
│   │   ├── api/database/          # DB切替境界（Turso or PostgreSQL）
│   │   │   ├── index.ts           # DATABASE_PROVIDER で動的 import
│   │   │   ├── libsql.ts          # Turso/libSQL 実装（秋くん本番）
│   │   │   ├── postgres.ts        # PostgreSQL 実装（配布版）
│   │   │   ├── schema.ts          # SQLite スキーマ（Turso用）
│   │   │   ├── schema.postgres.ts # PostgreSQL スキーマ（配布版用）
│   │   │   └── migrate.ts         # 配布版の起動時自動マイグレーション
│   │   ├── api/ogp.ts             # OGP注入・JSON-LD・sitemap
│   │   ├── server.ts              # Bun.serve エントリ
│   │   ├── shared/image-url.ts    # 画像URL・回転・focal point の共通helper
│   │   └── web/
│   │       ├── app.tsx            # Wouter ルーティング
│   │       ├── pages/             # top, gallery, profile, contact, admin, service, series-detail
│   │       ├── components/        # Layout, PhotoGallery, Lightbox, SeriesGrid, Picture, provider
│   │       └── lib/
│   │           ├── api.ts         # hono/client 型付き API クライアント
│   │           ├── settings-preview.ts  # Settings台帳（ライブプレビュー用キー管理）
│   │           ├── site-fallbacks.ts    # 配布版の中立フォールバック
│   │           └── photo-sort.ts        # クライアント側ソート
│   ├── drizzle/                   # Turso マイグレーション
│   ├── drizzle-postgres/          # PostgreSQL マイグレーション
│   └── vite.config.ts
├── docs/                          # 配布・運用ドキュメント群
├── CLAUDE.md                      # Claude Code が自動で読む指示書（§0 ルール等）
├── AGENTS.md                      # Claude Code / Codex 共通ルール
├── task.md                        # 作業ログ・Handoff 記録
├── railway.json                   # 配布版 Railway テンプレート設定
└── 各種仕様書（admin-enhancement-spec*.md, design-spec.md 等）
```

### DB スキーマ（主要テーブル）

- `photos` — filename, url, title, meta, description, category, displaySize (S/M/L), sortOrder, **rotationDeg** (0/90/180/270), **focalX**, **focalY**, width, height, camera, lens, shotAt, filmType, thumbUrl, mediumUrl, deletedAt
- `categories` — slug, label, sortOrder
- `hero_photos` — photoId, sortOrder
- `site_settings` — key-value（サイト名、フォント、色、レイアウト等 130以上のキー）
- `series` — slug, title, subtitle, statement, coverPhotoId, sortOrder

### ブランチ構成

- `main` — 本番。git push で Railway 自動デプロイ。
- `codex/railway-all-in-one-experiment` — 配布版実験。現在は main に追従済み（fast-forward 済み）。

---

## 守るべきルール（§0 Invariants）

Claude Code はこれらを破ってはならない。プロンプトで「§0 を守ること」と書けば伝わるが、特に関係する項目があれば明示するとよい。

1. **withRetry** — DB クエリは必ず `withRetry(() => db....)` でラップ。
2. **Settings 4箇所同期** — 新しい settings キーを追加する場合、以下4箇所すべてを更新:
   - `lib/settings-preview.ts` の `SETTINGS_PREVIEW_KEYS`（台帳）
   - API `GET /settings`（`api/index.ts`）の default 値
   - `provider.tsx` の DB適用 `useEffect`
   - `provider.tsx` の `handlePreviewMessage`
3. **assertOk** — 全書き込み API レスポンスの `res.ok` チェック。
4. **No manual Content-Encoding** — Railway プロキシが自動処理。手動設定で二重圧縮になる。
5. **DB schema 2ファイル同期** — `schema.ts`（Turso）と `schema.postgres.ts`（PostgreSQL配布版）を両方更新。片方だけ更新すると配布版だけ壊れ、本番では気づけない。
6. **invalidateQueries** — データ更新後は `qc.invalidateQueries({ queryKey: [...] })` で再取得。

### その他の重要な規約

- コメントは WHY のみ。WHAT は書かない。
- `lib/api.ts` の型付きクライアントを使う（`fetch` 直接呼び禁止）。
- フロントエンドから DB 直接アクセス禁止 — `/api/*` 経由。
- lint: `oxlint`（`bun run lint`）、型チェック: `tsc -b`（`tsc --noEmit` ではない）。
- `test-*.mjs` は scratch スクリプト（管理パスワード含む可能性）— `git add .` でコミットしない。

---

## デプロイフロー

実装完了ごとに必ず実行:

```sh
cd packages/web && tsc -b && bun run build   # 型チェック + ビルド
git add ... && git commit && git push         # Railway 自動デプロイ
```

- `bun run deploy` は **使わない**（旧 Runable ZIP 用の legacy スクリプト）。
- 環境変数は Railway ダッシュボードで管理（`.env` は gitignored）。

---

## 現在の状態（2026-06-27 時点）

### 直近で完了したこと

- **写真の回転・focal point 機能**（V3-1〜V3-4）: DB に `rotationDeg` / `focalX` / `focalY` を追加。画像プロキシが `rot` クエリで回転配信。管理画面にクイック回転ボタン・focal point 9点プリセット・キーボードショートカット `[` `]` を実装。公開側の PhotoGallery / Lightbox / Hero / SeriesGrid すべてに反映。
- **`/service` 販売ページの完成**（Stripe Payment Link 接続済み）: 実例を公開サイト自体から見せる構成に。管理画面の訴求セクション追加。購入後のフロー説明。Runable 要素の除去。
- **管理画面 settings ↔ 公開サイトの全面デバッグ**: 台帳の拡張、preview payload の完全同期、sortOrder のクライアント側反映、query cache の invalidation 補強。テスト 166→173 pass。
- **配布版の Railway All-in-One 化**: PostgreSQL + Railway Storage への切替基盤。起動時自動マイグレーション。`railway.json` テンプレート。ドキュメント整備（setup-guide, photographer-guide, post-deploy-guide, faq）。
- **ナビへの `/service` 控えめ導線追加**（akieguchi.com のみ表示）。
- **2台 Mac 運用手順**（docs/two-mac-workflow.md）。

### 未完了・残件

- **Railway Template の公開**（Railway dashboard での template 公開 → README の `<YOUR_TEMPLATE_ID>` 差し替え）— 秋くんの手作業。
- **GA4 の `akieguchi.com` fallback 除去** — Railway に `GA_MEASUREMENT_ID` env を入れてからコード側 fallback を消す。
- **空DB / 新規 Turso での起動確認** — 未実施。
- root `package.json` の `sandbox-app-template`、`packages/web/package.json` の `@template/web` のリネーム — 未変更。
- 管理画面の focal point ドラッグUI（9点プリセットのみ実装済み、任意位置ドラッグは未）。
- dev server / ブラウザ実機での回転UI・focal point の操作確認 — Codex sandbox 制約で未実施。
- `claude-code-luxury-feel-prompt.md` — 未追跡のまま残っている。
- `site-analysis-2026-06.md` — 未追跡のまま残っている。

### 直近の git log（最新5件）

```
ea7e51b fix(service): resolve three post-redesign bugs
c456029 refactor(service): redesign service page
31a420a Clarify service examples and purchase flow
646354c Improve service examples and admin preview
dd8039d Polish service page and remove Runable remnants
```

### ワーキングツリーの状態

未追跡ファイル2件:
- `claude-code-luxury-feel-prompt.md`
- `packages/web/src/web/pages/service.tsx.handoff.md`

未コミット変更: なし。

---

## AI 運用体制

| 役割 | AI | 説明 |
|---|---|---|
| 実装ドライバー | Claude Code | ターミナルで直接コードを書く。ビルド・テスト・push まで自律実行。CLAUDE.md を自動で読む |
| レビュー・相談役 | Codex (OpenAI) | agmsg でレビュー依頼を受ける。実装は基本しない。P0/P1/P2 の短い返答 |
| プロンプト作成 | ChatGPT（あなた） | 秋くんの要望を聞いて、Claude Code 用の詳細プロンプトを作る |

### agmsg（エージェント間メッセージ）

Claude Code と Codex は agmsg で非同期にやりとりできる。チーム名は `eguchi-portfolio`。相談トリガー:
- 設計判断で2択以上迷う
- 同じバグ修正を2回失敗
- DB / auth / deploy / settings / 画像処理など高リスク箇所
- push 前の高リスク差分レビュー

1セッション最大3回が目安。

---

## 仕様書の所在

| ファイル | 内容 |
|---|---|
| `CLAUDE.md` | Claude Code の基本指示書（スタック・§0・デプロイ手順・規約） |
| `AGENTS.md` | Claude Code / Codex 共通ルール・agmsg 運用 |
| `task.md` | 全作業ログ・Handoff 記録（1943行） |
| `admin-enhancement-spec.md` | 管理画面強化 P1〜P4 |
| `admin-enhancement-spec-v2.md` | 続編 C〜F / Q1〜Q5 |
| `admin-enhancement-spec-v3-draft.md` | V3: 写真回転・focal point・管理画面改善（Claude レビュー済み） |
| `design-spec.md` | デザイン設計図（雑誌的佇まい・余白主導） |
| `DISTRIBUTION.md` | 配布化の方針・P0〜P2・Railway All-in-One 保守ノート |
| `refine-and-loop-spec.md` | 自走改善ループ運用方針 |
| `docs/setup-guide.md` | セットアップ担当者向け手順 |
| `docs/photographer-guide.md` | 写真家本人向けガイド |
| `docs/post-deploy-guide.md` | 非エンジニア向け公開手順 |

---

## プロンプトのテンプレート

ChatGPT が Claude Code 用プロンプトを書くときの推奨フォーマット:

```markdown
## 目的
（何をなぜやるか。1〜3行）

## 背景
（現状の問題、関連ファイル、直近の変更など。Claude Code が判断に必要な情報）

## やること
1. ...
2. ...
3. ...

## 制約
- 触ってはいけないファイル、変えてはいけない挙動があれば明記
- §0 のうち特に関係するルール

## 検証
```sh
cd packages/web && tsc -b && bun run build
cd packages/web && bun test ./src
git diff --check
```
（追加の検証手順があれば）

## 完了条件
- ...

## Handoff
task.md に以下を追記:
- 目的
- やったこと
- 検証結果
- 触ったファイル
```

---

## よくある作業パターン

### 新しい settings キーを追加する場合
§0-2 の4箇所同期が必須。プロンプトに「settings-preview.ts の台帳 / API default / provider の DB適用 useEffect / provider の handlePreviewMessage の4箇所を更新」と明記する。

### DB スキーマを変更する場合
§0-5 の2ファイル同期が必須。`schema.ts`（Turso）と `schema.postgres.ts`（PostgreSQL）の両方を更新し、それぞれの drizzle config でマイグレーション生成。Turso 側は `bun run db:push` も実行。

### 画像表示に関わる変更
`shared/image-url.ts` の `srcFor()` / `srcSetFor()` を使う。`rotationDeg` と `focalX/Y` が正しく通っているか確認。PhotoGallery / Lightbox / Top Hero / SeriesGrid / Picture の5箇所に影響する可能性がある。

### 公開サイトの表示に関わる変更
`provider.tsx` でライブプレビューが壊れないか確認。preview message で即時反映されるか、settings-preview.ts の台帳にキーがあるか。

### 配布版に影響する変更
`site-defaults.ts` / `site-fallbacks.ts` に akieguchi.com 固有値が漏れていないか。`static-template.test.ts` で固有名リグレッションを検出する仕組みがある。

---

*この文書は 2026-06-27 時点の状態を反映。大きな構造変更があれば更新すること。*
