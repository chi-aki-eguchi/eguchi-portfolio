# eguchi-portfolio-app

> これは akieguchi.com（個人ポートフォリオ・Hono構成）。家業の Ivy's House サイト（別リポジトリ・Astro）とは別物。混同・流用しない。

写真家ポートフォリオサイト。Hono (API) + React 19 (SPA) + Drizzle/Turso (SQLite) + Bun。Railway にデプロイ（git push で自動デプロイ）。

## AI共同作業メモ

- 2026-06-11: Codex が保守メンバーとして参加。以後、Claude Code / Codex が同じ仕様書と `task.md` を見て作業する前提。
- Claude Code は実装着手前に `task.md` の最新 Handoff を確認し、未完了・検証済み・触ったファイルを追記する。
- settings ライブプレビューの送信キーは `packages/web/src/web/lib/settings-preview.ts` が台帳。新規 settings キー追加時はここも更新し、`provider.tsx` の DB 適用 / preview 適用、API `/settings` の default を揃える。
- **2026-06-16: Runable → Railway 移行完了。デプロイは git push のみ。ZIP 作成不要。**

### 自走改善ループ運用方針（refine-and-loop-spec.md）

> 詳細・正本は `refine-and-loop-spec.md`。継続的な自走改善はこの方針で運用する（2026-06-15 確定）。

- **起動**: クレジット（利用枠）がリセットされる時刻になったら自動で起動（イベント駆動。固定時刻cronは使わない）。
- **1サイクル**: ①「今サイトと秋のために何をすべきか」を一度考える → ②安全な範囲で**1件だけ**実装・改善 → ③「何を考えて何をしたか・次に気になること」を報告 → ④ビルド確認（`tsc -b` + `vite build`）→ ⑤`git push` でデプロイ → ⑥上限メッセージの `resets HH:MM (Asia/Tokyo)` を読んで次の起動を予約。
- **前提**: ターミナルが開いている間だけ動く（セッション内ループ）。近々 Mac mini で常時起動予定。クレジット切れ中は待機し、復活したら次のリセット直後に自動再開。
- **やること**: バグ/表示崩れ/スマホ不具合修正・既存機能の使いやすさ改善・パフォーマンス/SEO/アクセシビリティの小改善・参考サイト調査の取り込み。「変更なし」報告は避け毎回1つ価値を出す。
- **やらないこと**: 危険な大規模リファクタ・枠を消費するだけの無意味な変更。

### Codex との並行運用ルール

- **Codex の用途**: Claude のクレジット切れ時の緊急バグ修正、およびコードの監査。
- **同時に動かさない**: 片方の作業が終わってから次を動かす（同一ファイルへの競合編集を防ぐ）。
- **引き継ぎ**: Codex が変更したファイルは、次に Claude Code に渡すとき「Codex が〇〇を変えた」と伝える。
- **デプロイ**: どちらが作業した場合でも `tsc -b` + `vite build` でビルド確認してから `git push`（Railway が自動デプロイ）。
- **§0 ルールは Codex にも同じく適用**: `withRetry` ラップ・settings キーの3箇所同期・`assertOk`（全書き込みの res.ok チェック）・実装完了ごとに git push でデプロイ。

### 2026-06-18 Codex sanity notes（Claude Code 向け）

最近の Runable → Railway 移行で、古い手順と新しい手順が混在している。作業前に以下を確認すること。

- **`bun run deploy` は通常使わない**。中身の `scripts/deploy.sh` は Runable ZIP 用の legacy 手順で、現行の `ogp.ts` の `BUILD_ID = process.env.RAILWAY_GIT_COMMIT_SHA...` と噛み合わない。Railway 正本は `tsc -b` + `bun run build` + `git push`。
- **`task.md` は末尾の最新 Handoff を優先**。古い節には Runable ZIP / `bun run deploy` / ALLOWALL などの旧判断が残っている。
- **`NIGHT-RUN-LOG.md` は時系列で読む**。前半に「BUILD_ID が stale」という未解決メモが残るが、後半で `RAILWAY_GIT_COMMIT_SHA` 化済み。
- **`ecosystem.config.cjs` は Runable/PM2 時代の名残が多い**。Railway の実起動コマンドがこれを使っているか不明なため、触る前に Railway 側の start command を確認する。
- **未追跡の `test-*.mjs` / `packages/web/test-*.mjs` は scratch Playwright 監査スクリプト**。管理パスワードを含むものがあるため、安易に `git add .` でコミットしない。
- **`spec-layout-expansion.md` は参照HTML不足**。`design-reference/Portfolio_Redesign_dc.html` が現ワークツリーに無いので、レイアウト拡張に入る前に入手する。
- **最初に直すなら `package.json` の `deploy`**。今の `"deploy": "bash scripts/deploy.sh"` は Claude/Codex を旧Runableフローへ誘導するため、`deploy:runable:legacy` へ退避するか、Railway用の検証スクリプトに置き換えるのが安全。

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
│       └── vite.config.ts
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
git push   # Railway が自動ビルド → bun src/server.ts で起動
```

- Railway は `PORT` 環境変数（自動設定）を `process.env.PORT` 経由で受け取る（`server.ts` は `PORT ?? 3000`）
- `src/server.ts` が `Bun.serve` で静的ファイル配信 + API プロキシ + OGP インジェクションを担う
- 環境変数は Railway ダッシュボードで管理（`.env` は gitignored のままでよい）

### 実装完了時のデプロイ手順（必須ルール）

機能の実装・修正が一区切りしたら、毎回以下の順で実施する：

1. **型チェック** — `cd packages/web && tsc -b`（`tsc --noEmit` は0ファイル検査の罠あり。必ず `-b`）
2. **ビルド確認** — `cd packages/web && bun run build`
3. **git push** — Railway が自動デプロイ。数分後に本番が更新される
4. 報告に「**git push でデプロイしました**」と明記する。

```sh
# ローカル確認（任意）
cd packages/web && tsc -b && bun run build
# デプロイ
git add -A && git commit -m "..." && git push
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
- **新規 settingsキー追加時は以下4箇所を必ずセットで更新**（Codex により台帳化済み。admin.tsx は台帳から自動生成するため直接編集しない）:
  1. `lib/settings-preview.ts` の `SETTINGS_PREVIEW_KEYS`（台帳。React レンダー駆動のキーは `JS_PREVIEW_KEYS` にも）
  2. API `GET /settings`（`api/index.ts`）の default 値
  3. `provider.tsx` の DB適用 `useEffect`
  4. `provider.tsx` の `handlePreviewMessage`
- ライブプレビュー: 管理画面の iframe(`src="/"`) に `postMessage({ type: "preview-settings", settings })` を送信。payload は `makeSettingsPreviewPayload()`（台帳由来）で生成。受信は `provider.tsx` の `handlePreviewMessage`

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
- ギャラリーレイアウトは 6 種（mosaic / grid / scroll / stagger / editorial / collage）。freeform / polaroid / timeline / fullbleed / compare は 2026-06 に削除。未知の値は mosaic にフォールバック
