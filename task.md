# Task Log

## 追記 2026-06-29 — Codex: manifest.webmanifest alias追加

### 対応

- 既存の `/manifest.json` と同じ内容を `/manifest.webmanifest` でも返すようにした。
- 一般的な PWA/ブラウザ検査で `.webmanifest` を見に来ても404にならないようにした。

### 検証

- `cd packages/web && bun x tsc -b && bun run build`
- `cd packages/web && bun test ./src/api/public-routes.test.ts ./src/api/static-template.test.ts`
- `PORT=4301 bun src/server.ts` を起動し、`/manifest.json` と `/manifest.webmanifest` がどちらも200 / `application/manifest+json` になることを確認。
- `cd packages/web && bun test ./src`

### 触ったファイル

- `packages/web/src/server.ts`
- `task.md`

## 追記 2026-06-29 — Codex: Library写真向きフィルター追加

### 対応

- 管理画面 Library のフィルター群に「写真の向き」セレクトを追加。
- `縦写真` / `横写真` / `正方形` で絞り込めるようにした。
- 判定は既存の `orientedDimensions()` を使い、90/270度回転済みの写真も表示上の向きで分類する。
- 向きフィルター中は、表示順を誤って公開順として保存できないよう既存の reorder lock 条件へ追加。

### 検証

- `bun test ./packages/web/src/web/test/pages.render.test.tsx`
- `cd packages/web && bun x tsc -b && bun run build && bun test ./src`

### 触ったファイル

- `packages/web/src/web/pages/admin.tsx`
- `packages/web/src/web/test/pages.render.test.tsx`
- `task.md`

## 追記 2026-06-29 — Codex: Library公開状態フィルター追加

### 対応

- 管理画面 Library のフィルター群に「公開状態」セレクトを追加。
- `公開のみ` / `非公開のみ` で絞り込めるようにした。
- 公開状態フィルター中は、表示順を誤って公開順として保存できないよう既存の reorder lock 条件へ追加。

### 検証

- `bun test ./packages/web/src/web/test/pages.render.test.tsx`
- `cd packages/web && bun x tsc -b && bun run build && bun test ./src`

### 触ったファイル

- `packages/web/src/web/pages/admin.tsx`
- `packages/web/src/web/test/pages.render.test.tsx`
- `task.md`

## 追記 2026-06-29 — Codex: 未知URLのHTTP 404化

### 対応

- 既知のSPAルート判定を `packages/web/src/api/public-routes.ts` に分離。
- `/unknown-test-path` のような存在しない拡張子なしURLは、SPAのNot Found画面を表示しつつHTTPステータスを404にするようにした。
- `/`, `/gallery`, `/series`, `/about`, `/profile`, `/contact`, `/service`, `/admin`, `/admin/login` は引き続き200。
- `/series/:slug` はサーバ側でシリーズOGP解決できた場合は200、未解決なら404 HTMLにした。

### 検証

- `bun test ./packages/web/src/api/public-routes.test.ts ./packages/web/src/api/ogp.test.ts ./packages/web/src/web/test/pages.render.test.tsx`
- `cd packages/web && bun x tsc -b && bun run build && bun test ./src`
- `PORT=4301 bun src/server.ts` を起動し、`/`, `/gallery`, `/admin` が200、`/unknown-test-path` が404になることを確認。

### 触ったファイル

- `packages/web/src/api/public-routes.ts`
- `packages/web/src/api/public-routes.test.ts`
- `packages/web/src/server.ts`
- `task.md`

## 追記 2026-06-29 — Codex: 撮影日ソートのアップロード日 fallback

### 対応

- 公開側の共通写真ソート `sortPhotosBySetting()` で、`shotAt` がない写真は `createdAt` を日付ソートの代替値として使うようにした。
- 管理画面 Library の「撮影日」表示ソートも同じく `shotAt ?? createdAt` 相当で並ぶようにした。
- これにより、撮影日未入力でも最近アップロードした写真が日付順表示で常に最下部へ沈む挙動を避ける。

### 検証

- `bun test ./packages/web/src/web/lib/photo-sort.test.ts ./packages/web/src/web/test/pages.render.test.tsx`
- `cd packages/web && bun x tsc -b && bun run build && bun test ./src`

### 触ったファイル

- `packages/web/src/web/lib/photo-sort.ts`
- `packages/web/src/web/lib/photo-sort.test.ts`
- `packages/web/src/web/pages/admin.tsx`
- `task.md`

## 追記 2026-06-29 — Codex: Library「日付なし」フィルター追加

### 対応

- 管理画面 Library のフィルター群に `日付なし (N)` ボタンを追加。
- `shotAt` が空の写真だけを絞り込めるようにした。
- 日付なしフィルター中は、誤ってその表示順を公開順として保存できないように既存の reorder lock 条件へ追加。

### 検証

- `bun test ./packages/web/src/web/test/pages.render.test.tsx`
- `cd packages/web && bun x tsc -b && bun run build && bun test ./src`

### 触ったファイル

- `packages/web/src/web/pages/admin.tsx`
- `packages/web/src/web/test/pages.render.test.tsx`
- `task.md`

## 追記 2026-06-29 — Codex: Filmアップロード日時補完とadmin初期タブ改善

### 対応

- FilmアップロードでEXIF日時があれば `shotAt` に残し、EXIF日時がない場合もファイル更新日時を `shotAt` に入れるようにした。
  - Film選択時もカメラ・レンズ・露出などのEXIF詳細は従来通り自動入力しない。
  - 日付ソート時に新しいFilm写真が未日付扱いで最下部へ落ちる問題を避ける。
- adminの前回タブを `localStorage` に保存するようにし、ブラウザを開き直しても前に触った画面を復元するようにした。
- adminの保存済みタブがない初回表示は「はじめに」ではなく Library にした。「はじめに」は上部タブから引き続き開ける。
- 既存の `sessionStorage` に残っている `admin:tab` は一度だけ読み取って `localStorage` に移行できるようにした。

### 検証

- `bun test ./packages/web/src/web/lib/upload-date.test.ts ./packages/web/src/web/test/pages.render.test.tsx`
- `cd packages/web && bun x tsc -b && bun run build && bun test ./src`

### 触ったファイル

- `packages/web/src/web/pages/admin.tsx`
- `packages/web/src/web/lib/upload-date.ts`
- `packages/web/src/web/lib/upload-date.test.ts`
- `packages/web/src/web/test/pages.render.test.tsx`
- `task.md`

## 2026-06-11 Codex Maintenance Pass

### Done

- Added `packages/web/src/web/lib/settings-preview.ts` as the single registry for Settings live-preview payload keys.
- Updated `SettingsTab` to build preview payloads from the registry instead of a long inline key/dependency list.
- Updated `provider.tsx` to import React-driven preview keys from the same registry.
- Added a regression test for preview key uniqueness, JS-preview coverage, and empty string defaults.
- Updated Runable publish metadata in `packages/web/website.config.json`.
- Added `RUNABLE_AI.md` with the publish handoff for Runable AI.
- Updated `CLAUDE.md` so Claude Code can see Codex joined the project.

### Handoff

- New settings key flow: update API `/settings` defaults, `settings-preview.ts`, `provider.tsx` DB apply path, and `provider.tsx` `handlePreviewMessage`.
- Publish flow: run `bun run deploy`, then upload the root `eguchi-portfolio-deploy.zip`.
- Next useful cleanup: move more settings defaults into a typed shared registry so API defaults and admin/provider behavior are harder to drift.

### Touched Files

- `CLAUDE.md`
- `RUNABLE_AI.md`
- `task.md`

## 追記 2026-06-22 — Codex: Stripe URL組み込み用 Claude Code プロンプト作成

### 背景

- 秋さんから「Stripe のURLができたので、1時間後に Claude Code へ実行させるための仕様書
  （プロンプト）を丁寧に書いてほしい」と依頼。
- 直近 Handoff を確認し、`/service` はすでに作成済みで、Stripe Payment Link は
  `packages/web/src/web/pages/service.tsx` の `STRIPE_SELF` / `STRIPE_CONCIERGE` を実URLに
  差し替える設計になっていることを確認。
- 現時点ではこの会話内に実際の Stripe URL は未共有。販売ページは2コース制のため、原則2本の
  Stripe Payment Link が必要。

### 対応

- Claude Code にそのまま渡せる詳細プロンプトを
  `claude-code-stripe-template-prompt-2026-06-22.md` として新規作成。
- 内容には以下を含めた:
  - Stripe URL差し替え手順
  - 2コース分のURLが必要であること
  - 片方だけURLがある場合の確認事項
  - 購入後文面・運用runbook・販売ページdocsの見直し指示
  - Claude Code / Codex 内部情報の整理方針
  - `/service` まわりのコード整理・デバッグ観点
  - テンプレート販売計画のP0/P1/P2レビュー観点
  - 検証コマンドと Handoff / push 報告ルール

### 検証

- `task.md` 最新 Handoff、`.codex/USER_CONTEXT.md`、`packages/web/src/web/pages/service.tsx`、
  `docs/order-handling.md`、`docs/purchase-thankyou.md` を確認。
- `git status --short` で既存の未追跡 `site-analysis-2026-06.md` を確認。今回の作業では触らず。
- 実コード変更ではなくプロンプト作成のため、`tsc -b` / build は未実行。

### 残り

- 秋さんが実際の Stripe Payment Link を2本（自分で立てる / おまかせ設定）用意し、
  プロンプト内の `STRIPE_SELF_URL` / `STRIPE_CONCIERGE_URL` を置換してから Claude Code に渡す。
- URLが1本だけの場合は、どちらのコースのURLかを Claude Code に伝え、片方だけStripe化するか、
  2本そろうまでメール導線を維持するか判断する。

### 触ったファイル

- `claude-code-stripe-template-prompt-2026-06-22.md`
- `task.md`

## 追記 2026-06-22 — Codex: Claude Code の1時間後実行を `at` で予約

### 背景

- 秋さんから「Codexの自動化ではなく、Claude Code に作業させたい。ターミナル機能で1時間後に
  このMDを読んで動き出すようにしたい」と依頼。

### 対応

- プロジェクトルートに `CLAUDE-STRIPE-TEMPLATE-RUN.md` を追加。
  - ここに Stripe Payment Link 2本を入れる欄を用意。
  - 詳細仕様は `claude-code-stripe-template-prompt-2026-06-22.md` を読むよう指示。
- `scripts/run-claude-stripe-template-later.sh` を追加。
  - `DELAY_SECONDS` 後に `/Users/chiaki/.local/bin/claude --print` でルートMDを渡す。
  - ログは `.claude-delayed-runs/` に出す。
- `.claude-delayed-runs/` を `.gitignore` に追加。
- macOS の `at` で 2026-06-22 03:26 JST に1回実行するジョブを登録。
  - job id: `1`
  - 実行内容: `DELAY_SECONDS=0 CLAUDE_PERMISSION_MODE=acceptEdits ./scripts/run-claude-stripe-template-later.sh`

### 検証

- Claude CLI は `/Users/chiaki/.local/bin/claude` に存在。
- `CLAUDE_BIN=/bin/echo DELAY_SECONDS=1 ./scripts/run-claude-stripe-template-later.sh` で
  スクリプトのログ出力・プロンプト読み込みを確認。
- `atq` で job `1 Mon Jun 22 03:26:00 2026` を確認。
- `git diff --check` 成功。

### 注意

- 現在の permission mode は安全寄りの `acceptEdits`。Claude Code が追加許可を要求する操作で
  止まる可能性がある。完全無人で commit / push まで通したい場合は、実行前に job を作り直して
  `CLAUDE_PERMISSION_MODE=bypassPermissions` を使う必要があるが、危険度が上がる。
- 実行前に `CLAUDE-STRIPE-TEMPLATE-RUN.md` の `STRIPE_SELF_URL` /
  `STRIPE_CONCIERGE_URL` を実URLに置換すること。未入力なら Claude はURL不足として止まる。

### 触ったファイル

- `CLAUDE-STRIPE-TEMPLATE-RUN.md`
- `scripts/run-claude-stripe-template-later.sh`
- `.gitignore`
- `task.md`
- `scripts/deploy.sh`
- `packages/web/website.config.json`
- `packages/web/src/web/lib/settings-preview.ts`
- `packages/web/src/web/lib/settings-preview.test.ts`
- `packages/web/src/web/pages/admin.tsx`
- `packages/web/src/web/components/provider.tsx`

## Previous: Settings → Page Reflection Fix Task

## Root Cause

API `/settings` GET endpoint was missing 8 keys that the admin UI saves:

- sectionLabelSize, sectionLabelOpacity
- heroNameSize, heroNameColor
- heroNameEnSize, heroNameEnColor
- heroSubSize, heroSubColor

## Fixes Applied

### API (api/index.ts)

- [x] Added 8 missing keys to settings GET response

### Layout.tsx

- [x] Nav links: use `var(--nav-opacity, 0.35)` via inline style
- [x] Footer text: use `var(--footer-opacity, 0.20)` via inline style
- [x] SNS links: use `var(--sns-opacity, 0.25)` via inline style

### top.tsx

- [x] h1 (siteNameJa): use `var(--hero-name-size)` + `var(--hero-name-color)`
- [x] EN name (siteNameEn): use `var(--hero-name-en-size)` + `var(--hero-name-en-color)`
- [x] subtitle: use `var(--hero-sub-size)` + `var(--hero-sub-color)`
- [x] Works h2: use `var(--section-label-size)` + `var(--section-label-opacity)`

### gallery.tsx

- [x] Gallery h2: use `var(--section-label-size)` + `var(--section-label-opacity)`

### profile.tsx

- [x] Profile h2: use `var(--section-label-size)` + `var(--section-label-opacity)`
- [x] h3 (nameJa): use `var(--heading-size)`

### contact.tsx

- [x] Contact h2: use `var(--section-label-size)` + `var(--section-label-opacity)`

## Status: COMPLETE

---

# Handoff — 2026-06-12〜13 メンテナンスループ（Claude Code）

30分ごとの自動ループ（refine-and-loop-spec.md T1）で実施した変更の一括記録。
全変更は `bun run deploy` のゲート（tsc -b + bun test + vite build + 5ページsmoke）通過済み。
テストは 50 → 65 件に拡充。最新 ZIP: eguchi-portfolio-deploy.zip（06-13 06:25 版）。

## 公開サイト（閲覧者向け）

- [x] **グレイン（DD）表示バグ修正** — Layout の不透明 `bg-[var(--background)]` が body::before(z-index:-1) のグレインを覆っていた。Layout の背景を削除（body が同色を描画）。回帰テストあり。`Layout.tsx` / `styles.css`
- [x] グレインのブレンドを背景輝度で自動切替（暗背景では multiply→screen）。`provider.tsx` `textureBlendFor()`
- [x] **photoRevealEffect 新設定**（fade既定/none/rise/scale）— 旧実装は実質 rise(22px) でコラージュで枠ずれして見えた。4箇所同期済み（台帳/API/provider×2）+ admin UI。`settings-preview.ts` / `api/index.ts` / `provider.tsx` / `admin.tsx` / `styles.css`
- [x] **Lightbox ズーム刷新** — transform ベース。PC: ホイール(カーソル基準)/ダブルクリック/ドラッグパン/`+`-`0`キー。スマホ: ピンチ/1本指パン/ダブルタップ(手動判定)。ズーム中 3200px ソース重畳。段階的Esc（ズーム解除→閉じる）。counter は aria-live。`Lightbox.tsx`
- [x] スマホのタップ領域修正 — ハンバーガー 32→44px、ヒーロードット 7→23px（透明ボーダー方式）。`Layout.tsx` / `styles.css` / `top.tsx`
- [x] グリッドのホバーキャプション（Format系パターン、`@media (hover:hover)` 限定）。`PhotoGallery.tsx` / `styles.css`
- [x] 画像読込失敗時の静かなプレースホルダ（photo-broken）。テストあり。`PhotoGallery.tsx` / `SeriesGrid.tsx` / `styles.css`
- [x] シリーズ詳細に「Next →」ナビ（折返し循環）。`series-detail.tsx`
- [x] フィルタ/表示切替時にグリッド先頭へスクロールバック。`gallery.tsx`
- [x] SeriesGrid の aria-label 二重読み上げ解消（subtitle が読まれるように）
- [x] サブページ5つの見出しを h2→h1（SEO/a11y）
- [x] noscript フォールバック追加。`index.html`

## サーバ / SEO / パフォーマンス

- [x] **gzip 配信** — 静的アセット（ハッシュ付きはメモリキャッシュ）+ API JSON（hono/compress, threshold 1KB, /api/images 除外）+ OGP注入HTML。react-vendor 366→111KB、/api/photos 50→7.8KB。`server.ts` / `api/index.ts`
- [x] **画像サイトマップ** — /gallery に全公開写真、各シリーズページに所属写真（計162エントリ）。Search Console への sitemap 送信は秋さんの作業（未done）。`server.ts`
- [x] 未知の /series/:slug を noindex（ソフト404対策）。回帰テスト4件。`ogp.ts`
- [x] `injectOgp`/`buildJsonLd`/SITE_URL を server.ts → `ogp.ts` へ移設（テスト可能化）
- [x] X-Frame-Options ALLOWALL / frame-ancestors *（Runable プレビュー iframe 対応・秋さん指示）

## 管理画面

- [x] **シリーズ内の写真並べ替え解禁** — 単一シリーズ絞り込み(+手動ソート)時のみ。±1/先頭末尾は表示サブセット基準（`lib/reorder.ts` に抽出、単体テスト6件）。`admin.tsx`
- [x] **ヒーロー参照切れ検知** — hero_photos 15行全部がゴミ箱写真参照だった（本番実データ）。警告バナー+一括「選択から外す」。秋さんの判断待ち（復元するなら先にゴミ箱から復元）。`admin.tsx`
- [x] ライブプレビュー即時反映修正 — preview-ready ハンドシェイク + setQueryDefaults(staleTime Infinity) で refetch 上書き防止。`provider.tsx` / `admin.tsx`
- [x] hover限定だった操作ボタン4箇所をタッチ常時表示に（ゴミ箱復元/各削除ボタン）
- [x] ゴミ箱に「残りN日」バッジ（5日以下は赤）
- [x] シリーズ表紙ピッカー改善（シリーズ内写真を optgroup 先頭+サムネ表示）
- [x] A6 フォントペアリング4種（`provider.tsx` の `FONT_PAIRINGS`、整合テストあり）
- [x] A9 TypoControl 数値直接入力（全スライダー、双方向同期）

## 削除（死にコード）

- [x] shadcn残骸: ui/button.tsx, cn(), @radix-ui/react-slot, class-variance-authority, clsx, tailwind-merge, tw-animate-css, react-hook-form, zod, @aws-sdk/s3-request-presigner（計10 npm依存）
- [x] styles.css の @theme inline / .dark / 未使用キーフレーム群
- [x] fix-urls.ts ×2 / set_email.ts（役目を終えた移行スクリプト・秋さん承認済み）

## テスト基盤

- [x] settings 台帳→API default の同期ガードテスト（§0 ドリフト検知）
- [x] pages.render.test に DD/reveal/dblタップ等の preview 回帰テスト群

## 未完了 / 判断待ち

- [ ] **Runable へ最新 ZIP の再デプロイ**（グレイン以降の全改善が本番未反映）
- [ ] ヒーロー参照切れ15件の扱い（復元 or 整理）
- [ ] スマートアルバム（O6）削除可否 — 本番未使用、S2 報告済み
- [ ] コンテンツ: profileStatement / シリーズ statement / 料金プラン / formspreeUrl / homeCtaEnabled on
- [ ] Search Console 登録 + sitemap 送信
- [ ] adminApi:any 型復元（admin sub-app 分離、リスク大のため未着手）

## 追記 2026-06-13 08:13 — 独自ドメイン移行（akieguchi.com）

- [x] ベースURL一元化 — `ogp.ts` の `siteUrlFrom()`（解決順: 設定 siteUrl → env SITE_URL → 既定 https://akieguchi.com）。sitemap / robots Sitemap行 / canonical / og:url / og:image / JSON-LD / 画像サイトマップ162件すべて追従。実機検証済み・回帰テストあり
- [x] admin Settings に「サイトURL（公開ドメイン）」欄追加（空欄 = akieguchi.com）
- [x] CORS 許可オリジンに (www.)akieguchi.com 追加（runable.site は後方互換で残置）
- [x] index.html の静的 OGP デフォルトも新ドメインに更新
- 残置（意図的）: `website.config.json` の hostname は Runable のルーティング設定のため未変更（変更可否は Runable 側のドメイン設定に依存 → 秋さん確認待ち）
- [ ] 検討: 旧 chi-aki-eguchi.runable.site への直アクセスを akieguchi.com へ 301 リダイレクトするか（Runable のプレビュー iframe が旧ホスト経由だと壊れるリスクがあるため秋さんの判断待ち。canonical 統一済みなので SEO 上の重複は既に防げている）

## 追記 2026-06-13 — 本番真っ白の修正（gzip 撤去）

- 症状: 6/13 朝の再デプロイ後、本番サイトと Runable プレビューが両方真っ白。ローカルは正常。
- 原因: 6/12 深夜に入れた自前 gzip 配信（server.ts 静的/HTML + hono/compress API）。Runable のエッジプロキシが Content-Encoding と衝突（二重圧縮 or ヘッダ正規化）し、ブラウザが本文を解凍できなくなったと推定。素の curl（gzip 交渉なし）によるスモークテストでは検出不能だった。
- 対処: **gzip 2層を全面撤去**し移行前の配信に復帰。Content-Encoding ヘッダが一切付かないことを確認済み。
- 教訓: Content-Encoding を触る変更は Runable 本番での確認まで「未検証」と扱うこと。スモークに `Accept-Encoding: gzip` 付きリクエストを足す価値あり。
- 再導入するなら: env フラグ（例 `SELF_GZIP=1`）でゲートし、Runable エッジの挙動を本番で確認してから。

## 追記 2026-06-14 — ultracode 最終総点検（マルチエージェント監査 + 修正）

- 体制: 7ディメンション静的監査をワークフローでファンアウト→各findingを独立スケプティックで反証検証。**途中でセッション上限(16:20 JST)に当たり Verify の大半と perf-seo-a11y / deadcode の Review が脱落**。落ちた分は Claude が手動でコード精査して補完。
- ベースライン: `tsc -b` / `oxlint` / 69テスト 全green（着手前・修正後とも）。
- 本番相当検証(part5): `dist`削除→`vite build`(クリーン成功)→`bun src/server.ts`。全ルート200・`#root`あり、未知シリーズ=noindex、OGP注入、canonical=新ドメイン、`lang=ja`、**Content-Encodingなし(真っ白対策維持)**、sitemap(URL7+画像213)。
- **確定バグ修正（1件・low）**: `top.tsx` topWorks manual モードで重複ID指定時に同一photoが複数tileになり React key 衝突 → `[...new Set(...)]` で ID dedupe。`pages/top.tsx:269`。
- 誤検知と判定（既存ガードで無害）: 公開ページの`res.ok`未チェックは `?.field ?? []` がエラー形状ボディを吸収しクラッシュしない / note サムネ`alt=""`は隣接タイトルが代替名でWCAG適合 / series-detail undefined は API が404を返すため発生せず / prefersReducedMotion 非決定性は SPA なので非該当。
- **既知・意図的トレードオフ（未変更、owner承認済み or 認証背後）**: X-Frame ALLOWALL+frame-ancestors *（Runable iframe対応・秋さん指示／変更は再破壊リスク）、固定セッションCookie（単一管理者・ADMIN_PASSWORD由来）、画像プロキシ任意R2キー（全写真public）、upload系のcontent-type検証薄（requireAdmin背後）。
- **未実装の機能ギャップ（バグではない）**: A4 `--mobile-scale` はコードに一切なし。現状の既定ヒーロー名(1.75rem)はモバイルでも収まるが、admin が大きい`heroNameSize`を設定するとモバイルではみ出す潜在課題。実装は4箇所同期+admin UI を要するため別タスク。
- nav/footer/sns opacity のインラインfallbackと styles.css :root 既定が不一致だが、:root が常に勝つため**死にfallback（視覚バグなし）**。整理は任意。
- デプロイ: `bun run deploy` 成功、`eguchi-portfolio-deploy.zip` 更新済み。**Runable 再デプロイは秋さんの手動作業（未done）**。
- 触ったファイル: `packages/web/src/web/pages/top.tsx`、`task.md`。

## 追記 2026-06-14 — 最終総点検 第2周（opus）＋ モダン化着手

- 体制: opus エージェントで全7軸再監査＋モダン化軸を追加。第1周の既知誤検知/意図トレードオフ/修正済みを「再提起しない前提」として注入。**第2周も Verify がセッション上限で大半脱落**（"no verdict"）。確定はバグ1件のみ。
- **実装した変更（deployゲート通過・ZIP更新済み）**:
  1. **画像 AVIF/WebP コンテンツ交渉**（`api/index.ts` 画像プロキシ）。env フラグ `IMAGE_FORMAT_NEGOTIATION=1` でゲート（既定OFF＝従来のJPEG互換）。format対応キャッシュキー＋`Vary: Accept`。ローカル実証: w=1200 で JPEG 191KB→WebP 103KB(-46%)→AVIF 44KB(-77%)、出し分け/キャッシュHIT/OFF時互換 確認済み。**Runable で env をONにして本番検証するのは秋さんの作業**（gzip 教訓に倣いフラグ運用）。
  2. **focus-visible 強化**（`styles.css`）: alpha 0.12→`2px/0.55`・前景色参照。WCAG可視性。
  3. **profile note サムネに onError**（確定バグ）: 外部RSS URL失効時の破損アイコンを隠す（SeriesGrid/top と同パターン）。`profile.tsx`。
- 触ったファイル: `api/index.ts`, `web/styles.css`, `web/pages/profile.tsx`, `proposals/09-modernization.md`, `improvement-roadmap.md`, `task.md`。
- 残モダン化（未実装・#09 に整理）: og:image寸法/WebSite JSON-LD/manifest/dark theme-color（安全・小）、View Transitions/CSP/container queries（要相談）。**git管理外のため承認後に1つずつ。**
- 運用: セッション上限のリセット時刻に自動で作業再開する仕組みを整備（下記）。

## 追記 2026-06-14 — 中断作業の継続（第2周 Verify 未検証分）＋ 再開ルール

- budget 復活後、第2周で未検証(no verdict)のまま残った admin 系指摘を手動検証:
  - **§0違反を1件確定・修正**: `rememberPresets`(admin.tsx:482) が `adminApi.settings.$post` を res.ok 未チェックで実行 → assertOk 追加。ただし updatePhoto の onSuccess から fire-and-forget で呼ばれ await されないため、try/catch で握り（throw すると unhandled rejection）。挙動: プリセット記憶失敗時は console.error のみ、写真保存本体には影響なし。
  - 誤検知と確認: Lightbox popstate 二重pop（`if(history.state?.lightbox)` ガードで防止済）、sitemap hero N+1（livePhotos は単一 select、N+1 でない）。
- deploy ゲート通過・ZIP更新済み。
- **セッション上限の自動再開ルール（秋さん指示・メモリ化済み）**: 固定 daily cron は廃止。上限で中断したら
  エラーの reset 時刻を読み、その直後に one-shot ScheduleWakeup で中断作業の続きから再開する運用に変更。

## 追記 2026-06-15 — 自走ループ運用方針の改定 ＋ cycle 10（WebSite JSON-LD）

- **運用方針を改定（秋さん指示）**。正本=`refine-and-loop-spec.md` の **T0**（CLAUDE.md「自走改善ループ運用方針」/ memory `autonomous-improvement-loop` と同期）。
  起動はクレジット（利用枠）リセット駆動（**固定時刻cron不可・イベント駆動**）。1サイクル=①考える→②安全な1件を実装→③報告→④`bun run deploy`でZIP更新→⑤上限メッセージの reset 時刻を読んで次の起動を予約。**「変更なし」報告は避け毎回1件の価値を出す**。ターミナルが開いている間だけ動くセッション内ループ（近々 Mac mini で常時起動予定）。
  ※ `improvement-roadmap.md` の旧原則「実装せず企画書だけ」（cycle 3〜9）は本改定で終了。
- **実装（安全な1件）**: WebSite JSON-LD ノード追加（`packages/web/src/api/ogp.ts` buildJsonLd）。`@graph` に Person/ImageGallery と並ぶ **WebSite**（url / name=EN / alternateName=JA / inLanguage:ja / description / publisher=Person）。ドメイン自体を検索の knowledge graph に認識させる。追加のみ・視覚変化なし・巻き戻し不要。
- 検証: `bun run deploy` ゲート通過（`tsc -b` + **71テスト[+2]** + `vite build` + 5ページ smoke 200）。ZIP更新済み（`eguchi-portfolio-deploy.zip` 1.3M / `deploys/...-20260615-074132.zip`）。**Runable 再デプロイは秋さんの手動作業（未done。グレイン以降の全改善とともに本番未反映）**。
- 触ったファイル: `refine-and-loop-spec.md`(T0追加), `CLAUDE.md`(方針節追加), `improvement-roadmap.md`(原則改定+cycle10), `packages/web/src/api/ogp.ts`, `packages/web/src/api/ogp.test.ts`, `task.md`。memory: `autonomous-improvement-loop.md` / `MEMORY.md`。
- 次に気になること: ①**Runable 本番に未反映の改善が多数たまっている**（本ログ 122行〜: グレイン/Lightbox/AVIF 等）。秋さんの手動再デプロイが律速。②AVIF/WebP(`IMAGE_FORMAT_NEGOTIATION=1`)は本番ON検証待ち（-77%）。③次の安全な1件候補: og:image:width/height・manifest・theme-color・alt フォールバック小改善。

### cycle 11 (06-15) — theme-color サーバ側注入

- 実装: `ogp.ts` で `<meta name="theme-color">` を `settings.themeBg`（未設定時 `#f7f7f7`）で setAttr 置換。index.html の静的 `#f7f7f7` のままだと、ダークテーマ設定時に初回サーバ描画でモバイルのステータスバーが白→JS実行後に黒へ切替わるチラつきが出る。これを pre-JS 窓で解消（`provider.tsx`:147 のクライアント同期を補完。重複メタは作らない）。回帰テスト3件追加。
- 検証: `bun run deploy` 通過（`tsc -b` + **74テスト[+3]** + `vite build` + 5ページ smoke 200）。ZIP更新（`...-20260615-084855.zip`）。**Runable 再デプロイは秋さん手動（未done）**。
- 触ったファイル: `packages/web/src/api/ogp.ts`, `packages/web/src/api/ogp.test.ts`, `improvement-roadmap.md`, `task.md`。
- 次候補: og:image:alt（共有画像のa11y）/ og:image:width=1200 / manifest。

### cycle 12 (06-15・秋さん明示タスク) — 白画面(CDN汚染)恒久対策を現行デプロイ方式へ

- 受領仕様: `content.md`（Cloudflare エッジが壊れた gzip を1年キャッシュ→特定回線のみ真っ白）。3対策(A:vite資産名タグ / B:HTML no-store+CDN-Cache-Control / C:BUILD_ID)。
- **重複チェック**: B は `server.ts:237-239` に**既実装**（2026-06-13 対応）、C も基盤既存（`ogp.ts` BUILD_ID + `server.ts:145` X-Build。値が古いだけ）。**未実装は A のみ**。
- 実装:
  - `packages/web/vite.config.ts`: `entryFileNames`/`chunkFileNames`/`assetFileNames` に `-${process.env.BUILD_TAG || "b"}` 接尾辞。内容不変の vendor チャンクも毎ビルドで URL が変わり、エッジの汚染キャッシュを物理回避（実証: react-vendor のハッシュ不変でもタグでURL変化）。
  - `scripts/deploy.sh`: **1ビルド=1タイムスタンプを自動付与**。`BUILD_TAG=$(date +%Y%m%d-%H%M%S)` を生成→ `ogp.ts` の BUILD_ID をその値に置換（BSD/GNU 両対応の temp 経由 sed）→ `BUILD_TAG=… bun run build` で全資産名に注入→ **資産名にタグが入ったか検証**（無ければ ZIP 更新せず exit）。スモークに **X-Build==BUILD_TAG 検証 + HTML 参照 /assets/\*.js|css を全て200検証**（白画面の直接原因を出荷前に検出）を追加。末尾に **Publish 後の本番チェック手順**（x-build / cf-cache-status / gzip汚染）を表示。
  - `ogp.ts`: BUILD_ID のコメントを「deploy.sh が自動スタンプ・手動bump不要」に更新（値は deploy.sh が上書き）。
- **方針整合**: 仕様書の pm2 再起動 / サンドボックス内ビルドは**採らない**。Mac 側ビルド→dist 同梱 ZIP を Runable が配信するだけ、という現行方式に全てを寄せ、秋さんは手動コマンド/ファイル編集が一切不要。
- 検証: `bun run deploy` 通過（BUILD_TAG=20260615-121245、アセット名・X-Build 一致、**74テスト**、5ページ+参照アセット全200）。ZIP更新（`...-20260615-121257.zip`）。**本番反映は秋さんの Runable Publish 待ち**。
- 触ったファイル: `packages/web/vite.config.ts`, `packages/web/src/api/ogp.ts`, `scripts/deploy.sh`, `improvement-roadmap.md`, `task.md`。

### cycle 13 (06-15・緊急) — 本番「新サーバ×古dist」不整合の調査とビルド整合ガード

- 症状(秋さん報告): 本番 X-Build=20260615-121245(新) なのに HTML 参照が `index-B0gIOhPX.js`(タグ無し=cycle12以前の旧ビルド)。サーバ新×dist旧。
- **調査結果**: cycle12 で作った root ZIP は**完全整合**だった（index.html 参照=同梱資産=全て `-20260615-121245` タグ付き、ogp BUILD_ID も一致）。**`B0gIOhPX` は私のローカル・ZIP のどこにも存在しない**＝旧 vite.config(タグ無し)時代の古い成果物。よって不整合は**ZIP 側でなく Runable が古い dist を配信**している疑いが濃厚（`ecosystem.cjs` の既知issue「boot ビルド失敗→月単位で古い dist 配信」の再来か、永続dist/キャッシュ）。
- **恒久ガードを deploy.sh に追加**（出荷物が二度と不整合にならないように）:
  - ① ビルド前に `rm -rf packages/web/dist`（クリーンビルド。emptyOutDir 任せにせず旧タグ無し資産の混入を物理的に断つ）。
  - ② 検証2: `dist/index.html` 参照の全 `/assets/` が dist に実在＋タグ付きか（index.html と資産が別ビルドならここで落ちる）。
  - ③ 検証3: **ZIP 成果物そのもの**を展開し、同梱 index.html の参照⇔同梱資産が完全一致＋タグ付きか（不一致なら ZIP を破棄して exit）。
- **本番側診断を ecosystem.cjs に追加**: 起動時に `BUILD_ID` と dist/index.html の参照資産をログ出力し、不一致なら「⚠ STALE dist?」を警告。Runable ログだけで server×dist 不一致を即特定可能に。
- クリーン再ビルド: `bun run deploy` 通過、新 **BUILD_TAG=20260615-123147**。最終検証: 同梱 js/css=19/タグ付き=19、index.html 参照5件すべて同梱、B0gIOhPX 混入ゼロ。ZIP 更新済み。
- **秋さんへの次アクション**: この新 ZIP を Runable に Publish → `curl -sI https://akieguchi.com/ | grep -i x-build` が `20260615-123147` を返し、HTML 参照資産が `-20260615-123147` タグ付きで 200 か確認。もし X-Build だけ新しく資産が旧タグ無しのままなら **Runable 側の dist 保持/キャッシュが原因**確定（ecosystem ログの STALE 警告で判別）→ Runable の完全再デプロイ/キャッシュクリアが必要。
- 触ったファイル: `scripts/deploy.sh`, `ecosystem.config.cjs`, `packages/web/src/api/ogp.ts`(BUILD_ID 自動スタンプ), `task.md`。

## 追記 2026-06-18 — Codex 共通認識整理（Runable → Railway）

### 結論

- **現行の正本は Railway / git push デプロイ**。`CLAUDE.md` と `NIGHT-RUN-LOG.md` は 2026-06-16 の Runable → Railway 移行を前提に更新済み。
- **Runable ZIP 運用は legacy**。`RUNABLE_AI.md` / `scripts/deploy.sh` / `packages/web/website.config.json` は過去運用・事故調査の参照用として残っているが、通常の実装完了フローでは使わない。
- Claude Code / Codex は以後、作業前にこの Handoff と `CLAUDE.md` / `AGENTS.md` を読み、`tsc -b` + `bun run build` を確認してから `git push` でデプロイする。

### なぜ Railway 正本を推奨するか

- `CLAUDE.md` がすでに Railway 方針を明記しており、直近の夜間自走ログも `git push` デプロイで運用されている。
- コード側も `BUILD_ID` が `process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 8) ?? "dev"` に変更済みで、Railway の自動ビルド前提。
- Runable ZIP 用の `scripts/deploy.sh` は旧仕様の `BUILD_ID` 文字列置換と X-Build 検証に依存しており、現行 `ogp.ts` と噛み合わない。誤って使うと検証失敗または認識ズレを招く。
- Runable 由来の `ALLOWALL` / credentialed CORS 許可などは 6/17-18 の夜間ランで撤去済み。セキュリティ面も Railway 前提に寄っている。

### 今回 Codex が確認した状態

- `main` は `origin/main` と一致。HEAD: `9cb799c fix(profile): Statement の改行を段落単位に変更し自然な折り返しを実現`。
- 未コミット変更:
  - `packages/web/src/web/pages/admin.tsx`: BulkEdit 行の draft 同期と unmount 時 flush。未保存の debounce 中編集を捨てないための変更。
  - `claude-code-night-run.md`: 夜間自走指示の整理。Railway/git push 前提。
  - `AGENTS.md`: Codex が本追記と同時に Railway/git push 正本へ更新。
- 未追跡:
  - `TOMORROW-PLAN.md`: 6/17-18 夜間ラン後の優先プラン。技術より問い合わせ導線・写真 title・Search Console・シリーズ statement が高ROIという整理。
  - `spec-layout-expansion.md`: Claude Design 案の Home 3案 / Gallery 3案追加仕様。ただし参照先 `design-reference/Portfolio_Redesign_dc.html` は現ワークツリーに存在しないため、着手前に入手が必要。
  - 多数の `test-*.mjs` / `packages/web/test-*.mjs`: Playwright 監査・再現用の作業スクリプト。管理パスワードを含むものがあるため、コミット対象にするなら整理・秘匿確認が必要。

### 次に Claude Code / Codex がやるなら

- まず `git status --short` で未コミット変更の所有者を確認し、ユーザー変更を巻き戻さない。
- ドキュメント整合を続けるなら、`scripts/deploy.sh` と `package.json` の `deploy` スクリプトを legacy として退役させるか、Railway 用の検証スクリプトに作り替える。ただし通常作業では `git push` が正本。
- レイアウト拡張に入るなら、先に `design-reference/Portfolio_Redesign_dc.html` を配置してもらう。
- 管理画面改善なら、B2 写真検索が安全で効果が高い。A4 mobile-scale は settings 4箇所同期が必要で影響範囲が広め。

### 検証

- 今回は把握・ドキュメント更新のみ。`git diff --check` は更新前に問題なしを確認。
- 実装コードは触っていないため、ビルド・テストは未実行。

### 触ったファイル

- `AGENTS.md`
- `task.md`

## 追記 2026-06-18 — Claude Code 挙動安定化メモ（Codex 監査）

### 目的

最近の Claude Code が古い Runable/ZIP 前提と新しい Railway/git push 前提を混ぜて判断しやすくなっているため、Codex が「おかしい点」「踏みやすい地雷」「次に直すならここ」を整理した。Claude Code はこの節を読んでから作業すること。

### P0: すぐ共有すべき地雷

- **`bun run deploy` は現行フローでは使わない**。`package.json` にはまだ `"deploy": "bash scripts/deploy.sh"` が残っているが、`scripts/deploy.sh` は Runable ZIP 用の legacy 手順。現行 `ogp.ts` は `BUILD_ID = process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 8) ?? "dev"` なので、deploy.sh の「BUILD_ID 文字列を sed 置換して X-Build と一致確認する」前提と噛み合わない。
- **`scripts/deploy.sh` は実行すると失敗する可能性が高い**。sed は現行 `BUILD_ID` 行を置換できず、ローカルサーバの X-Build は `dev` のまま、BUILD_TAG は timestamp なので smoke の X-Build 一致検証で落ちるはず。ZIP は更新しない設計だが、Claude がこれを正本として時間を溶かすのが危険。
- **`ecosystem.config.cjs` の診断は旧 literal BUILD_ID 前提**。`export const BUILD_ID = "..."` を regex で読むが、今は env 式なので `?` になる。Runable/PM2 をまだ使う場面では診断ログが信用できない。Railway の start command がこれを使っているかも要確認。
- **Railway の build では `BUILD_TAG` が入らない可能性がある**。`vite.config.ts` は `process.env.BUILD_TAG || "b"` なので、Railway が BUILD_TAG を渡していなければ全アセット名が `-b` suffix になる。直近 build でも `dist/assets/*-b.js/css` を確認。Cloudflare 汚染対策としての「毎ビルド URL 変更」は Railway では効いていない可能性がある。
- **`claude-code-night-run.md` の BUILD_ID 指示は古い**。`vite.config.ts define に __BUILD_ID__ を追加` と書いてあるが、実装済みの正解は `ogp.ts` の `RAILWAY_GIT_COMMIT_SHA` 化。二重実装しないこと。

### P1: 誤コミット・情報漏れの危険

- 未追跡の `test-*.mjs` / `packages/web/test-*.mjs` は scratch Playwright 監査スクリプト。`autumn00180` など管理パスワード文字列を含むものが複数ある。**`git add .` 厳禁**。必要ならパスワードを env 参照化してから正式な `tests/` 配下へ移す。
- `test-results/.last-run.json` は `"status": "failed"` だが `failedTests: []` の一時ファイル。コミット不要。
- `spec-layout-expansion.md` は `design-reference/Portfolio_Redesign_dc.html` を必須参照にしているが、そのファイルは現ワークツリーに存在しない。Claude が推測で実装し始めないよう注意。

### P2: ドキュメントの古い記述

- `proposals/09-modernization.md`、`improvement-roadmap.md`、`content.md`、`RUNABLE_AI.md`、`packages/web/website.config.json` には Runable 前提が残る。履歴資料として読むのはよいが、現在の運用手順として採用しない。
- `task.md` の古い節にも Runable 再デプロイ待ち、ALLOWALL 許容、`bun run deploy` ゲートなどが残っている。末尾の 2026-06-18 Handoff を優先する。
- `packages/web/src/api/index.ts` のコメントに「behind Runable's proxy」「Flip ... on Runable」などが残る。コード挙動は概ね問題ないが、コメントは Railway へ読み替える必要がある。

### P3: 次に直すならおすすめ順

1. `package.json` の `deploy` を無効化または `deploy:runable:legacy` に退避し、Claude が誤って使えないようにする。
2. Railway 側で per-build asset tag が必要なら、`BUILD_TAG` を Railway build command で渡すか、Vite 側で commit SHA / timestamp を自動取得する。不要なら `BUILD_TAG` コメントを現状に合わせて整理する。
3. `ecosystem.config.cjs` の Runable/PM2 診断を legacy 化するか、Railway start command で使うなら `BUILD_ID` env 式に対応させる。
4. scratch Playwright `.mjs` を削除・ignore・正式テスト化のどれかに整理する。管理パスワード直書きは消す。
5. `content.md` / `RUNABLE_AI.md` / `proposals/09-modernization.md` の先頭に「legacy / historical」と明記する。

### 検証

- `cd packages/web && bun run build` 成功（tsc -b + vite build、1838 modules）。
- `cd packages/web && bun test ./src` 成功（74 pass / 0 fail / 4907 expect）。
- build 出力で `dist/assets/*-b.js/css` を確認。これは `BUILD_TAG` 未指定時の現行挙動。

### 触ったファイル

- `CLAUDE.md`
- `task.md`

## 追記 2026-06-18 — Codex: Gallery Lightbox flicker 修正

### 症状

- `/gallery` で写真をクリックしても拡大表示されず、黒い Lightbox が一瞬ちらつくだけで閉じる。
- Claude Code に修正依頼済みだったが、ユーザー環境では未解消。

### 原因

- `Lightbox.tsx` は開くときに `history.pushState({ lightbox: true }, "")`、閉じるときに cleanup で `history.back()` を呼ぶ。
- React StrictMode / dev 実行では effect が `setup → cleanup → setup` と replay されるため、**実際にはまだ開いている最中なのに cleanup の `history.back()` が同期実行される**。
- その `popstate` が `onClose` を呼び、結果として「開いた直後に閉じる」= flicker になる。特に dev server / StrictMode / start command のズレがある環境で再現しやすい。

### 修正

- `packages/web/src/web/components/Lightbox.tsx`
  - history push を `historyPushedRef` で1回だけにした。
  - cleanup の `history.back()` を `setTimeout(0)` へ遅延し、StrictMode replay の次 setup が来たら timer を cancel するようにした。
  - 本当に unmount されたときだけ履歴を戻し、scroll restore もそのタイミングで行う。
- `packages/web/src/web/test/pages.render.test.tsx`
  - `Lightbox` mount 時に StrictMode replay で `history.back()` が走らないことを検証。
  - `PhotoGallery` の実タイルクリックで `<dialog>` が残ることを検証（実症状に近い回帰テスト）。

### Claude Code への注意

- この修正は「history cleanup を同期で戻さない」ことが肝。`return () => { if (history.state?.lightbox) history.back(); }` の形に戻すと再発する。
- Gallery クリック不具合を見るときは `Lightbox` 単体ではなく、`PhotoGallery` の tile click → portal `<dialog>` まで確認すること。
- sandbox の localhost 接続制限で Codex 側では Playwright 実ブラウザ確認はできなかったが、jsdom + StrictMode の再発テストで flicker 条件を固定している。

### 検証

- `cd packages/web && bun test ./src/web/test/pages.render.test.tsx` 成功（18 pass）。
- `cd packages/web && bun run build` 成功（tsc -b + vite build）。
- `cd packages/web && bun test ./src` 成功（75 pass / 0 fail / 4914 expect）。
- `cd packages/web && bun run lint` 成功。
- `git diff --check` 成功。

### 触ったファイル

- `packages/web/src/web/components/Lightbox.tsx`
- `packages/web/src/web/test/pages.render.test.tsx`
- `task.md`

## 追記 2026-06-18 — Codex/Claude 連絡用 agmsg 導入

### 状態

- Codex が `agmsg` をインストール済み。インストール先はユーザーホーム配下で、リポジトリのアプリコードには触れていない。
  - shared skill: `~/.agents/skills/agmsg/`
  - Claude command: `~/.claude/commands/agmsg.md`
  - Codex writable roots: `~/.codex/config.toml` に `~/.agents/skills/agmsg/db` と `~/.agents/skills/agmsg/teams` を追加
- installed version: `02db087`
- `sqlite3` は `/usr/bin/sqlite3` で利用可能。

### 初回セットアップ

- Claude Code / Codex を再起動してから使う。
- Claude Code 側: `/agmsg`
- Codex 側: `$agmsg`
- 推奨チーム名: `eguchi-portfolio`
- 推奨エージェント名:
  - Claude Code: `claude-driver`
  - Codex: `codex-reviewer`
- 推奨 delivery mode:
  - Claude Code: `monitor`（または不安定なら `both`）
  - Codex: `turn`（Codex は monitor 非対応）

### 運用ルール案

- Claude Code は実装ドライバー、Codex はレビュー・難所相談・リリース前 sanity check を基本役割にする。
- Claude から Codex に送るレビュー依頼には、目的・触ったファイル・懸念点・実行済み検証を含める。
- Codex から Claude への返答は P0/P1/P2 と結論を先に書く。
- commit / push は原則どちらか一方が担当し、同じ変更を二人で同時に触らない。

## 追記 2026-06-18 — Codex: 管理画面 Photo 検索 + カメラ/レンズコピペ

### 実装

- 管理画面 Library の写真検索は既存の `searchQuery` 実装を確認。タイトル・ファイル名・カメラ・レンズ・説明・meta を横断検索する状態になっている。
- `packages/web/src/web/pages/admin.tsx` にカメラ/レンズ情報のコピー/貼り付けを追加。
  - Inspector の Camera/Lens 下に Copy / Paste ボタンを追加。
  - Bulk Edit Table の各行 Camera セルにも Copy / Paste アイコンを追加。
  - コピー形式は `Camera: ...` / `Lens: ...` の2行。
  - 貼り付けはラベル付き形式、タブ区切り、2行テキストを受け付ける。
- Bulk Edit Table 側では、貼り付けた camera/lens を既存の debounce save に乗せて保存する。

### 注意

- `admin.tsx` には作業前から BulkEditRow の draft 同期 / unmount flush 変更が入っていた。今回の実装はその変更を前提に足しているため、戻さないこと。
- まだ commit / push はしていない。ワークツリーには別件の未コミット変更がある。

### 検証

- `cd packages/web && bun run build` 成功。
- `cd packages/web && bun test ./src/web/test/pages.render.test.tsx` 成功（18 pass）。
- `cd packages/web && bun run lint` 成功。
- `cd packages/web && bun test ./src` 成功（75 pass / 0 fail / 4914 expect）。
- `git diff --check` 成功。

### 触ったファイル

- `packages/web/src/web/pages/admin.tsx`
- `task.md`

## 追記 2026-06-19 — agmsg 自動相談運用を採用

### 決定

- Claude Code / Codex のどちらかを固定窓口にしない。ユーザーが話している方をそのタスクの主担当にする。
- agmsg は「常時会議」ではなく、主担当AIが必要時だけ相手へ短く相談するために使う。
- 相談トリガー:
  - 設計判断が2択以上で迷う
  - 同じバグ修正を2回試して解決しない
  - DB / auth / deploy / settings / 画像処理など高リスク箇所を触る
  - commit / push 前に高リスク差分のレビューが必要
- 相談は1セッション最大3回を目安にする。
- 相談文には `目的` / `制約` / `触ったファイル` / `検証` / `返答形式` を含め、相手には「実装なし、P0/P1中心、短く」と依頼する。
- delivery mode は Claude Code `monitor`、Codex `turn` を基本にする。消費を抑えたい時は一時的に `off`。

### 反映

- `AGENTS.md` に Claude Code / Codex 共通の agmsg 運用ルールを追加。
- `CLAUDE.md` の「Codex との並行運用ルール」を更新。

### 触ったファイル

- `AGENTS.md`
- `CLAUDE.md`
- `task.md`

## 追記 2026-06-19 — Codex 用ローカルユーザー文脈メモ

### 実施

- ユーザー希望により、Codex が秋さんの作業スタイル・サイト文脈・Claude/Codex運用を継続して参照できるローカルメモを作成。
- 保存先: `.codex/USER_CONTEXT.md`
  - `.codex/` は `.gitignore` 済みのためコミット対象外。
  - 秘密情報・トークン・パスワード・不要な個人情報は書かない方針。
- `AGENTS.md` に「存在すれば `.codex/USER_CONTEXT.md` を読む」旨を追記。
- Claude Code へ agmsg で「Claude が持つ非秘密のユーザー文脈を Codex に引き継いでほしい」と依頼し、返信内容のうち非秘密・作業上有用な文脈を `.codex/USER_CONTEXT.md` に反映済み。
  - 追加反映: 短く結果先出しの報告、絵文字なし、1サイクル1改善、`tsc -b` 優先、Ivy's House 別リポジトリと混同しない、ギャラリーレイアウト種別など。

### 注意

- Claude から追加返信が来た場合は、事実ベースかつ非秘密の内容だけ `.codex/USER_CONTEXT.md` に追記する。
- `.codex/USER_CONTEXT.md` は gitignore 対象なので、他環境へ共有したい場合はユーザー確認のうえ、公開してよい範囲に要約して `AGENTS.md` 等へ移す。

### 触ったファイル

- `AGENTS.md`
- `.codex/USER_CONTEXT.md`
- `task.md`

## 追記 2026-06-19 — Codex: Runable deploy script を legacy 退避

### 実施

- 旧 Runable ZIP 用の root `package.json` script を `deploy` から `deploy:runable:legacy` へリネーム。
- これにより、通常作業で `bun run deploy` を誤実行して旧 Runable フローへ入ることを防ぐ。
- Runable 復旧・検証が必要な場合だけ、現行 Railway 方針との整合を確認してから `bun run deploy:runable:legacy` を使う。
- `AGENTS.md` / `CLAUDE.md` の該当メモも退避後のコマンド名へ更新。

### 検証

- `bun run deploy` が `Script not found "deploy"` で止まることを確認。
- `cd packages/web && bun run build` 相当（workdir: `packages/web` で `bun run build`）成功。
- `git diff --check` 成功。

### 触ったファイル

- `package.json`
- `AGENTS.md`
- `CLAUDE.md`
- `task.md`

## 追記 2026-06-19 — Codex: layout expansion Phase 1（Gallery 3 layouts）

### 実施

- 秋さん提供の参照HTML `/Users/chiaki/Downloads/ポートフォリオサイトの改善/Portfolio Redesign.dc.html` を確認し、まず影響範囲の小さい Gallery 側3レイアウトを追加。
- `PhotoGallery` に以下3種を追加:
  - `clean-grid`: 4列（mobile 2列）/ 2px gap / 正方形 crop / 装飾なしの contact sheet 風
  - `masonry`: 3列（mobile 2列）/ 8px gap / 写真の縦横比維持 / quiet hover title
  - `large-format`: 2列（mobile 1列）/ 大判表示 / 常時 title + `Film/Digital — year` caption
- 管理画面の Settings（Gallery / Series / Top Works）と Series 個別設定の layout 選択肢へ、上記3種を追加。
- レンダリングテストの対象レイアウトを 6 種から 9 種へ拡張。
- `AGENTS.md` / `CLAUDE.md` / `.codex/USER_CONTEXT.md` のギャラリーレイアウト数メモを 9 種へ更新。

### 判断

- Home layout 3種は、hero/nav/section rhythm まで触る可能性があり変更範囲が大きいので今回は未実装。次フェーズで mockup と現行Top構造を見ながら分けて進める。
- 新しい settings key は追加していない。既存の `galleryLayout` / `seriesLayout` / `topWorksLayout` の値を増やしただけなので、settings-preview 台帳や API default の追加更新は不要。
- agmsg で Claude Code に方針レビューを依頼。Claude から P0 指摘なし、settings key を増やすなら同期注意という返答。今回は key 追加なしとして整理済み。

### 検証

- `cd packages/web && bun x tsc -b` 成功。
- `cd packages/web && bun run build` 成功（script 内で `tsc -b && vite build` 実行）。
- `cd packages/web && bun test ./src` 成功（75 pass / 0 fail）。
- `cd packages/web && bun run lint` 成功。
- `git diff --check` 成功。
- ローカル dev server `/gallery` を browser で確認。写真 445 件表示、コンソール error なし。

### 触ったファイル

- `packages/web/src/web/components/PhotoGallery.tsx`
- `packages/web/src/web/styles.css`
- `packages/web/src/web/pages/admin.tsx`
- `packages/web/src/web/components/PhotoGallery.render.test.tsx`
- `AGENTS.md`
- `CLAUDE.md`
- `.codex/USER_CONTEXT.md`
- `task.md`

## 追記 2026-06-19 — Codex + Claude: layout expansion 後の全体デバッグ

### 実施

- Codex が layout expansion Phase 1 push 後の締めデバッグを実施。
- agmsg で Claude Code (`claude-driver`) に別視点レビューを依頼。
  - Claude 回答: P0/P1 なし。
  - P2 メモ: `large-format` の年表示に使う `shotAt` が `/api/photos` レスポンスに含まれるか確認。
- Codex が API 実装と実レスポンスを確認し、`shotAt` はローカル/本番ともに含まれていることを確認済み。

### 検証

- `cd packages/web && bun x tsc -b` 成功。
- `cd packages/web && bun run build` 成功。
- `cd packages/web && bun test ./src` 成功（75 pass / 0 fail）。
- `cd packages/web && bun run lint` 成功。
- `git diff --check` 成功。
- ローカル `http://127.0.0.1:5173` で smoke:
  - `/`, `/gallery`, `/series`, `/about`, `/contact`, `/admin/login`
  - `/gallery` は写真 445 件、broken card 0、console error 0。
  - Lightbox は写真クリックで `dialog[open]` になり、画像表示あり。
- 本番 `https://akieguchi.com` で smoke:
  - `/`, `/gallery`, `/series`, `/about`, `/contact`
  - `/gallery` は写真 445 件、broken card 0、console error 0。
  - Lightbox は写真クリックで `dialog[open]` になり、画像表示あり。
  - `/api/photos` は 445 件、`shotAt` / `filmType` / `camera` / `lens` / `width` / `height` を含む。

### 結論

- 今日の変更に対する P0/P1 は見つからず。
- Claude の P2 懸念も実レスポンス確認で問題なし。
- 未追跡だった `TOMORROW-PLAN.md` / `spec-layout-expansion.md` を整理。
  - `TOMORROW-PLAN.md` は作業メモとして `.codex/TOMORROW-PLAN.md` へ退避（gitignore対象、未commit）。
  - `spec-layout-expansion.md` は Phase 1 完了 / Phase 2-3 未実装が分かる公開仕様書として更新。

### 触ったファイル

- `task.md`

## 追記 2026-06-26 — Codex: `/service` への控えめな導線追加

### 目的

秋さん依頼「購入サイトのレベルを上げて、扱いやすくしたい。今は自分でURLを打たないといけない」に対応。
ただし「あんま目立たないように」という追加方針に合わせ、強い購入CTAではなく通常導線の中に控えめに入れる。

### 対応

- `Layout` に `/service` へのリンクを追加。
  - デスクトップ / モバイルの通常ナビに `Service` を追加。
  - フッターには薄い `Portfolio site` リンクを追加。
- 配布先の写真家サイトに秋さんの販売導線が勝手に出ないよう、表示条件を `akieguchi.com` のみへ限定。
  - `siteUrl` が `akieguchi.com` の場合、または閲覧中ホストが `akieguchi.com` の場合だけ表示。
  - 空 settings / localhost / 配布テンプレート初期状態では非表示。
- 回帰テストを追加。
  - 空 settings では `/service` リンクが出ない。
  - `siteUrl: "https://akieguchi.com"` では `Service` / `Portfolio site` が出る。

### 検証

- `cd packages/web && bun x tsc -b` 成功。
- `cd packages/web && bun test ./src/web/test/pages.render.test.tsx` 成功（23 pass）。
- `cd packages/web && bun test ./src` 成功（173 pass / 0 fail）。
  - 既存の `PhotoGallery.render.test.tsx` 由来の React `act(...)` warning は継続。
- `cd packages/web && bun run build` 成功。
- `git diff --check` 成功。

### 触ったファイル

- `packages/web/src/web/components/Layout.tsx`
- `packages/web/src/web/test/pages.render.test.tsx`
- `task.md`

## 追記 2026-06-19 — Codex + Claude: 配布化 v0 方針と P0 下地

### 実施

- 秋さんの「他の人にも使えるように配布したい」という相談を受け、まず SaaS ではなく「写真家ごとに専用 Railway/Turso/R2 環境を作るテンプレート配布」を初手方針として整理。
- `DISTRIBUTION.md` を新規追加し、以下を明文化:
  - v0: Template + Setup Guide
  - v0.5: Concierge Setup
  - SaaS は別プロジェクトとして後回し
  - 写真家本人 / セットアップ担当 / 開発AI の3者それぞれの使いやすさ
  - 完成度を損なわない原則
  - P0/P1/P2、Phase 1〜5、Template v0 の境界線
- `README.md` を古い `sandbox-app-template` 内容から、現在の写真家ポートフォリオ / Railway / Turso / R2 前提の入口へ更新。
- `.env.template` を現行コードに合わせて整理:
  - `WEBSITE_URL`, `BETTER_AUTH_SECRET`, `AI_GATEWAY_*`, `AUTUMN_SECRET_KEY` など未使用・誤誘導になりやすい項目を削除。
  - `SITE_URL`, `PORT`, `DEFAULT_*`, `ALLOWED_ORIGINS`, `GA_MEASUREMENT_ID` を追加。
  - 未設定時の症状をコメントで追記。
- 配布化 P0 の下地として `packages/web/src/api/site-defaults.ts` を追加。
  - API settings default / OGP / JSON-LD の名前・説明文 fallback を env-configurable に整理。
  - CORS を localhost + `SITE_URL` / `DEFAULT_SITE_URL` / `ALLOWED_ORIGINS` から判定する形へ変更。
  - GA4 は `GA_MEASUREMENT_ID` 指定時のみ注入。空指定なら無効化。`akieguchi.com` だけ既存 GA ID の互換 fallback を残し、本番 analytics が突然消えないようにした。
- `packages/web/src/api/site-defaults.test.ts` を追加し、CORS と GA fallback の振る舞いをテスト化。

### Claude 相談

- agmsg で Claude Code (`claude-driver`) に3回相談。
- Claude 回答要約:
  - fork → Railway/Turso/R2 テンプレート化は妥当。SaaS より前に正本整理が先。
  - P0 は OGP/SEO 固有名、空DB起動確認、R2/DB/env 設定漏れ時の導入UX。
  - 完成度を損なうリスクは R2 未設定、migrate 未実行、OGP 固有名残留、ADMIN_PASSWORD 未設定、Railway env 漏れ。
  - Template v0 の境界は「秋さんが今使っているものが、そのまま別人に動く状態で渡せるか」まで。マルチユーザーや自動セットアップは後回し。
- Claude 指摘を `DISTRIBUTION.md` と `site-defaults` 実装へ反映済み。
- push 前レビューも依頼し、Claude から「P0なし。pushOK。akieguchi.com本番への影響なし（fallback維持・env未設定=従来動作）」の返答。
- P1メモとして、`www` / apex 両方を使う配布先では `ALLOWED_ORIGINS` 追記が必要な可能性があるとの指摘があり、`.env.template` と `DISTRIBUTION.md` に補足済み。

### 残り

- `packages/web/index.html` の静的 fallback meta はまだ江口秋 / `akieguchi.com` のまま。サーバ側 OGP 注入前の静的プレビュー対策として次の P0。
- `packages/web/src/api/site-defaults.ts` には `akieguchi.com` 互換 fallback を残している。テンプレート正式リリース時は Railway 本番 env を確認したうえで中立 fallback へ切り替えるか、テンプレート branch で分離する。
- root `package.json` の `sandbox-app-template`、`packages/web/package.json` の `@template/web` は未変更。
- 空DB / 新規 Turso での起動確認は未実施。
- 作業前から未追跡だった `site-analysis-2026-06.md` は触っていない。

### 検証

- `cd packages/web && bun x tsc -b` 成功。
- `cd packages/web && bun test ./src/api` 成功（39 pass / 0 fail）。
- `cd packages/web && bun test ./src` 成功（80 pass / 0 fail）。
- `cd packages/web && bun run build` 成功。
- `cd packages/web && bun run lint` 成功。
- `git diff --check` 成功。

### 触ったファイル

- `README.md`
- `.env.template`
- `DISTRIBUTION.md`
- `packages/web/src/api/site-defaults.ts`
- `packages/web/src/api/site-defaults.test.ts`
- `packages/web/src/api/index.ts`
- `packages/web/src/api/ogp.ts`
- `task.md`

## 追記 2026-06-19 — Codex: 配布化 P0 静的 meta 安全化 + 受け取り手順

### 実施

- 前回残り P0 だった `packages/web/index.html` の静的 fallback meta から、江口秋 / `akieguchi.com` 固有値を削除。
  - `<title>` / description / author / canonical / OGP / Twitter fallback を generic な `Photography Portfolio` / `https://example.com/` に変更。
  - 実デプロイ時は Bun server の OGP injection が settings で置き換える前提。静的previewやserver injection前のHTMLでも本番固有値が漏れない状態にした。
- `packages/web/src/api/static-template.test.ts` を追加。
  - `index.html` に 江口秋 / Aki Eguchi / `akieguchi.com` / `G-NKECCDLXYD` が戻ったらテストで落ちる。
- `docs/recipient-setup.md` を追加。
  - 配布する側: repository copy、Turso、R2、Railway、env、`bun run db:push`、build/push、本番確認。
  - 受け取る側: admin login、site identity、profile、contact、photos、layout、公開前チェック。
  - 推奨配布形態として、非エンジニア向けは Concierge setup、自力で触れる人向けは Template copy と整理。
- `README.md` から実務手順 guide へリンク追加。
- `DISTRIBUTION.md` の P0/P1 進捗を更新。

### 検証

- `cd packages/web && bun test ./src/api` 成功（40 pass / 0 fail）。
- `cd packages/web && bun x tsc -b` 成功。
- `cd packages/web && bun run build` 成功。
  - 一度 `canonical href="/"` で Vite が directory read して build 失敗。`https://example.com/` に修正して成功。
- `cd packages/web && bun test ./src` 成功（81 pass / 0 fail）。
- `cd packages/web && bun run lint` 成功。
- `git diff --check` 成功。

### Claude 相談

- agmsg で Claude Code (`claude-driver`) に push 前 P0/P1 レビュー依頼済み。
- Claude 返答: P0なし、pushOK、akieguchi.com本番への影響なし。
- 良い点として、`static-template.test` が固有値リグレッション防止として機能していること、`og:image` をルート相対にした判断は現サーバ構成では問題ないことを確認。
- P1メモ: 将来静的エクスポート対応をするなら、injectOgp が走らないケースに備えて `og:image` の絶対URL化を再検討。

### 残り

- `packages/web/src/api/site-defaults.ts` には `akieguchi.com` 互換 fallback が残っている。テンプレート正式リリース時は本番 env を確認して中立 fallback へ切り替えるか、template branch で分ける。
- root `package.json` の `sandbox-app-template`、`packages/web/package.json` の `@template/web` は未変更。
- 空DB / 新規 Turso での起動確認は未実施。
- 作業前から未追跡だった `site-analysis-2026-06.md` は触っていない。

### 触ったファイル

- `packages/web/index.html`
- `packages/web/src/api/static-template.test.ts`
- `docs/recipient-setup.md`
- `README.md`
- `DISTRIBUTION.md`
- `task.md`

## 追記 2026-06-19 — Codex: Admin はじめにタブ + 用語の言い換え

### 実施

- 秋さんから「repo ってなに？専門用語を使いすぎるとわからない」と指摘あり。
- 管理画面に `はじめに` タブを追加。
  - 初期タブを `はじめに` に変更。
  - 公開までに必要な項目をチェックリスト化:
    - サイトの名前
    - プロフィール
    - 連絡先
    - 写真
    - 公開する写真
    - トップ写真
  - 公開前にできれば確認する項目として、公開URL / 写真の分類 / 見え方を表示。
  - `GitHub` / `Railway` / `Turso` / `R2` / `repo` / `環境変数` / `deploy` / `OGP` を、管理画面内で平易な言葉に言い換え。
- `docs/recipient-setup.md` も専門語だけにならないよう更新。
  - `repository` を「サイトのファイル一式」と説明。
  - Turso は「設定の保存場所」、R2 は「写真の保存場所」、Railway は「サイトの公開場所」と説明。
- `README.md` も repository / Turso / R2 の説明を補足。
- `packages/web/src/web/test/pages.render.test.tsx` に、認証済み admin で `公開までにやること` と `repo` 説明が出ることを追加確認。

### 検証

- `cd packages/web && bun test ./src/web/test/pages.render.test.tsx` 成功（18 pass / 0 fail）。
- `cd packages/web && bun x tsc -b` 成功。
- `cd packages/web && bun test ./src` 成功（81 pass / 0 fail）。
- `cd packages/web && bun run build` 成功。
- `cd packages/web && bun run lint` 成功。
- `git diff --check` 成功。
- ローカル Vite server を起動し、Playwright で `/admin` を API 仮応答つき表示:
  - `公開までにやること` 表示あり。
  - `はじめに` タブ表示あり。
  - `サイトのファイル一式` の説明あり。
  - 1280px 幅で横はみ出しなし。

### Claude 相談

- agmsg で Claude Code (`claude-driver`) に push 前 P0/P1 レビュー依頼済み。
- Claude 返答: P0なし、pushOK。
- 良い点として、チェックリスト項目が API データから動的判定されていること、`isFilled()` guard、タブ直接ジャンプの UX が確認された。
- P1確認:
  - デフォルトタブを `gallery` から `setup` に変更したため、秋さんの既存ブラウザでは sessionStorage の `admin:tab` があればそのまま。別ブラウザやストレージクリア後は `はじめに` が初期表示になる。
  - `contactEmail` / `formspreeUrl` は `/api/settings` レスポンスに含まれていることを確認済み（`packages/web/src/api/index.ts`）。

### 残り

- root `package.json` の `sandbox-app-template`、`packages/web/package.json` の `@template/web` は未変更。
- 空DB / 新規 Turso での起動確認は未実施。
- 作業前から未追跡だった `site-analysis-2026-06.md` は触っていない。

### 触ったファイル

- `packages/web/src/web/pages/admin.tsx`
- `packages/web/src/web/test/pages.render.test.tsx`
- `docs/recipient-setup.md`
- `README.md`
- `task.md`

## 追記 2026-06-19 — Codex + Claude: 配布導線の2層化と固有名フォールバック追加修正

### 実施

- 秋さんから「専門用語が多い。もっとやりやすく、わかりやすくできないか」と相談あり。
- agmsg で Claude Code (`claude-driver`) に深めの方針相談。
- Claude 返答要約:
  - v0.5 Concierge 方式を先行するのが正解。
  - 写真家本人に GitHub / Railway / Turso / R2 / 環境変数を説明しない。
  - セットアップ担当者が裏側を作り、本人にはサイトURL・管理画面URL/パスワード・短い説明だけ渡す。
  - 既存 `docs/recipient-setup.md` は「本人向け」と「セットアップ担当者向け」が混ざっていて混乱源。
- `docs/setup-guide.md` を新設。
  - セットアップ担当者向けに、Railway / Turso / R2 / env / db:push / 公開前チェック / 本人への手渡し物を整理。
- `docs/photographer-guide.md` を新設。
  - 写真家本人向けに、管理画面URLを開く → `はじめに` タブから始める、だけに絞った短いガイドにした。
- `docs/recipient-setup.md` は旧名の案内ページに変更。
  - セットアップ担当者は `setup-guide.md`、写真家本人は `photographer-guide.md` へ誘導。
- `README.md` / `DISTRIBUTION.md` を2層導線に更新。
  - 写真家本人に渡すものは原則「サイトURL / 管理画面URLとパスワード / photographer-guide」の3つだけと明記。
  - `repository` などの表現を「サイトのファイル一式」に寄せ、用語メモを追加。
- 公開ページのクライアント側 fallback を中立化。
  - `packages/web/src/web/lib/site-fallbacks.ts` を追加。
  - settings 読み込み前や空状態で、Top / Layout / Profile が `江口秋` / `Aki Eguchi` に戻らないようにした。
  - 管理画面 Settings / Profile の placeholder も `Photographer Name` / `https://example.com` へ変更。
- `pages.render.test.tsx` に空状態の公開ページが本番固有名へ fallback しない回帰テストを追加。

### 検証

- `cd packages/web && bun test ./src/web/test/pages.render.test.tsx` 成功（19 pass / 0 fail）。
- `cd packages/web && bun x tsc -b` 成功。
- `cd packages/web && bun test ./src` 成功（82 pass / 0 fail）。
- `cd packages/web && bun run lint` 成功。
- `cd packages/web && bun run build` 成功。
- `git diff --check` 成功。
- 本番 `https://akieguchi.com/api/settings` を確認。
  - `siteName` / `profileName` などは DB 側に入っている。
  - `siteUrl` は空。現状の canonical / OGP の URL は Railway `SITE_URL` またはサーバー側 fallback に依存している可能性がある。

### 残り

- `packages/web/src/api/site-defaults.ts` のサーバー側互換 fallback には、まだ `akieguchi.com` / `江口秋` / GA fallback が残っている。
  - 今すぐ中立化すると、Railway `SITE_URL` が未設定だった場合に本番 SEO URL が変わるリスクがあるため今回は触らない。
  - 次にやるなら、Railway に `SITE_URL=https://akieguchi.com` が入っていること、または admin の `siteUrl` を保存することを確認してから中立化する。
- root `package.json` の `sandbox-app-template`、`packages/web/package.json` の `@template/web` は未変更。
- 空DB / 新規 Turso での起動確認は未実施。
- 作業前から未追跡だった `site-analysis-2026-06.md` は触っていない。

### 触ったファイル

- `README.md`
- `DISTRIBUTION.md`
- `docs/setup-guide.md`
- `docs/photographer-guide.md`
- `docs/recipient-setup.md`
- `packages/web/src/web/lib/site-fallbacks.ts`
- `packages/web/src/web/components/Layout.tsx`
- `packages/web/src/web/hooks/usePageTitle.ts`
- `packages/web/src/web/pages/admin.tsx`
- `packages/web/src/web/pages/profile.tsx`
- `packages/web/src/web/pages/top.tsx`
- `packages/web/src/web/test/pages.render.test.tsx`
- `task.md`

## 追記 2026-06-20 — Codex: サーバー側 fallback の配布向け中立化

### 実施

- 秋さんから、前回残した「サーバー側 fallback に `akieguchi.com` / `江口秋` が残る」件について「どうにかならんの？」と指摘あり。
- 結論: どうにかできる。Railway env を直接触らず、コード側で安全に解決。
- `packages/web/src/api/site-defaults.ts`
  - `DEFAULT_SITE_URL` を `https://example.com` に変更。
  - API settings の最終 fallback を `Photographer Name` / `Photography portfolio.` に変更。
  - CORS は generic fallback URL を許可しないようにし、設定済み `SITE_URL` / `DEFAULT_SITE_URL` / `ALLOWED_ORIGINS` だけ許可。
  - `www` / non-`www` 補完を `akieguchi.com` 専用から任意ドメイン向けに一般化。
- `packages/web/src/api/ogp.ts`
  - `siteUrlFrom(settings, fallbackOrigin)` に拡張。
  - 解決順を `admin siteUrl` → `SITE_URL` env → request public origin → `https://example.com` に変更。
  - OGP / canonical / JSON-LD が request public origin を使えるようにした。
- `packages/web/src/server.ts`
  - `x-forwarded-host` / `host` と `x-forwarded-proto` から public origin を作る `publicOriginFromRequest()` を追加。
  - HTML OGP injection / sitemap / robots に同じ public origin を渡すよう変更。
- `DISTRIBUTION.md` の P0 状態を更新。
- 本番反映後の確認で、DBに `siteNameEn` / `siteDescription` が保存されていないため、JSON-LD と meta description に generic fallback が出ることを発見。
  - 追加修正として、保存済みの `siteName` / `profileName` から英語名 fallback と説明文 fallback を派生する `displayNameFrom()` / `displayNameEnFrom()` / `siteDescriptionFrom()` を追加。
  - 秋さん固有の固定文を戻さず、`江口 秋` が保存されていれば `江口 秋の写真ポートフォリオ。` のように自然な説明を作る形にした。

### Claude 相談

- agmsg で Claude Code (`claude-driver`) に P0/P1 レビュー依頼。
- Claude 返答:
  - 方向性OK。
  - P0注意は、`Origin` ヘッダーではなく `Host` / `x-forwarded-host` を使うこと。
  - sitemap / robots も同じ基準にすること。
- 今回実装は `x-forwarded-host` / `host` を使い、sitemap / robots にも反映済み。

### 検証

- `cd packages/web && bun test ./src/api/site-defaults.test.ts ./src/api/ogp.test.ts` 成功（31 pass / 0 fail）。
- `cd packages/web && bun x tsc -b` 成功。
- `cd packages/web && bun test ./src` 成功（86 pass / 0 fail）。
- `cd packages/web && bun run lint` 成功。
- `cd packages/web && bun run build` 成功。
- `git diff --check` 成功。

### 残り

- GA4 の `akieguchi.com` fallback は、Railway に `GA_MEASUREMENT_ID` が入っているか確認できていないため残した。
  - 今消すと本番のアクセス解析が止まる可能性がある。
  - きれいに消すには Railway 側へ `GA_MEASUREMENT_ID=G-NKECCDLXYD` を入れてから、コード fallback を削除する。
- root `package.json` の `sandbox-app-template`、`packages/web/package.json` の `@template/web` は未変更。
- 空DB / 新規 Turso での起動確認は未実施。
- 作業前から未追跡だった `site-analysis-2026-06.md` は触っていない。

### 触ったファイル

- `DISTRIBUTION.md`
- `packages/web/src/api/site-defaults.ts`
- `packages/web/src/api/site-defaults.test.ts`
- `packages/web/src/api/ogp.ts`
- `packages/web/src/api/ogp.test.ts`
- `packages/web/src/server.ts`
- `task.md`

## 追記 2026-06-20 — Codex + Claude: Railway All-in-One 配布版の実験開始

### 実施

- 秋さんから「こっちで用意することが多すぎる。配布ではなく個人取引になってしまう」と相談あり。
- 方針を「秋さん本番は現行 Railway + Turso + R2 のまま」「配布版だけ Railway Template + PostgreSQL + Railway Storage へ寄せる」に整理。
- 実験用ブランチ `codex/railway-all-in-one-experiment` を作成。
- `docs/railway-all-in-one-experiment.md` を追加。
  - クオリティを落とさずにRailway一本化できる見込み、壊れやすい箇所、役割分担、次の実験を記録。
- PostgreSQL 用の Drizzle schema を別ファイルで追加。
  - `packages/web/src/api/database/schema.postgres.ts`
  - 既存 `schema.ts` はTurso本番用として未変更。
- PostgreSQL 用の Drizzle config と生成 migration を追加。
  - `packages/web/drizzle.postgres.config.ts`
  - `packages/web/drizzle-postgres/0000_worried_sentry.sql`
- Bun 本体の `SQL` と Drizzle `bun-sql` で、追加パッケージなしにPostgreSQL接続入口を作成できることを確認。
  - `packages/web/src/api/database/postgres.ts`
- Storage client を S3 互換前提へ少し一般化。
  - `S3_REGION` / `S3_FORCE_PATH_STYLE` を追加。
  - 既定値は現行R2本番の挙動を変えない。
- `db.run(...)` 直呼びの並び替えSQLを `executeRaw(...)` に寄せた。
  - 現行Tursoでは `run`、PostgreSQLでは `execute` を使えるようにするため。
- 管理画面 `はじめに` の用語を、GitHub/Turso/R2 などの固有サービス名から「公開場所」「データの保存場所」「写真の保存場所」へ寄せた。

### Claude 相談

- agmsg で Claude Code (`claude-driver`) に P0/P1 レビュー依頼。
- Claude 返答:
  - 配布版だけ Railway All-in-One にする方針でよい。
  - P0: `db.run()` はPostgreSQL側に無いので `execute` へ逃がす必要あり。
  - P0: `schema.ts` は SQLite/Turso 前提なので配布版では pg-core 化が必要。
  - P0: Storage は `forcePathStyle` が必要になる可能性あり。
  - 良い点: 画像処理はアプリ側の `sharp` が担っているため、保存先変更だけで品質を落とす必要は低い。

### 検証

- `cd packages/web && bunx drizzle-kit generate --config=drizzle.postgres.config.ts` 成功。
- `cd packages/web && DATABASE_URL=postgres://user:pass@localhost:5432/db bun -e 'const m = await import("./src/api/database/postgres.ts"); console.log(Boolean(m.db), typeof m.withRetry);'` 成功。
- `cd packages/web && bunx tsc --noEmit --target ES2022 --lib ES2023 --module ESNext --moduleResolution bundler --strict --skipLibCheck src/api/database/schema.postgres.ts src/api/database/postgres.ts drizzle.postgres.config.ts` 成功。
- `cd packages/web && bun x tsc -b` 成功。
- `cd packages/web && bun test ./src` 成功（86 pass / 0 fail）。
- `cd packages/web && bun run build` 成功。
- `cd packages/web && bun run lint` 成功。
- `git diff --check` 成功。

### 残り

- PostgreSQL の実DBにはまだ接続していない。
  - 次は空の Railway PostgreSQL かローカルPostgreSQLに schema を流し、`/api/settings` / `/api/photos` / `/admin/login` を確認する。
- Railway Storage Bucket の実物検証は未実施。
  - upload / image proxy / resize / delete / cache を写真1枚で確認する。
- 配布用テンプレートでは、`schema.postgres.ts` / `postgres.ts` を実際の `schema.ts` / `database/index.ts` に切り替える必要がある。
- 秋さん本番へのデプロイはしていない。実験ブランチ上の作業。
- 作業前から未追跡だった `site-analysis-2026-06.md` は触っていない。

### 触ったファイル

- `.env.template`
- `docs/railway-all-in-one-experiment.md`
- `packages/web/drizzle-postgres/0000_worried_sentry.sql`
- `packages/web/drizzle-postgres/meta/0000_snapshot.json`
- `packages/web/drizzle-postgres/meta/_journal.json`
- `packages/web/drizzle.postgres.config.ts`
- `packages/web/src/api/database/postgres.ts`
- `packages/web/src/api/database/schema.postgres.ts`
- `packages/web/src/api/index.ts`
- `packages/web/src/web/pages/admin.tsx`
- `task.md`

## 追記 2026-06-20 — Claude: Railway All-in-One 配布版 DB/Storage プロバイダ切替 + 実環境 e2e

### 実施

- 配布版の最後の未配線を解消。`api/index.ts` と `server.ts` が `schema`（テーブル定義）を
  sqlite-core のままハードコード参照していたため、`db` を pg に替えても schema が sqlite で
  実行時に boolean/timestamp 型不一致になる状態だった。
- `DATABASE_PROVIDER` 環境変数で **db / withRetry / schema を一括切替**する方式に変更。
  - 未設定 → 従来の Turso/libSQL を動的 import（postgres.ts は一切ロードされない＝本番完全不変）。
  - `=postgres` → `postgres.ts` + `schema.postgres` を選択。
  - 旧 `database/index.ts` の libsql 実装は `database/libsql.ts` へ退避し、`index.ts` を切替境界に。
  - 列名は両 schema で一致するため、クエリビルダ向けには libsql 側の型へ cast で統一。
- `drizzle.postgres.config.ts` に欠けていた `dbCredentials.url`（env の DATABASE_URL）を追記。

### 検証（実 Railway PostgreSQL + Storage、public proxy 経由）

- Storage（S3互換）: PUT/GET/DELETE 往復バイト一致、`forcePathStyle=true` で動作。
- migration: 生成 SQL を bun:sql で直接適用（drizzle-kit は pg driver 別途要求のため、
  bun-sql 無依存方針を維持）。9文/9文適用、6テーブル作成確認。
- API e2e 9/9 pass: settings / photos(空) / login / upload(storage) /
  photos INSERT・RETURNING(id=1, sortOrder=MAX+1 相関サブクエリ可) /
  timestamp 往復(createdAt 正しい ISO) / 一覧反映 / reorder(CASE SQL が executeRaw→db.execute(pg)で200) /
  削除+purge。
- 本番(turso/デフォルト)回帰: `tsc -b` exit0 / `bun test ./src` 86 pass・0 fail 維持 / `bun run build` 成功。

### 接続の学び（配布 doc へ反映推奨）

- ローカル/外部からの検証は Railway の **public URL**（`*.proxy.rlwy.net:PORT`）が必要。
  内部 host（`*.railway.internal`）はこの Mac から到達不可。デプロイ後の Railway 内部は internal で OK。
- 今回 `sslmode=require` は不要だった（public proxy で接続成功）。

### 残り

- 画像 PROXY + sharp リサイズの実 Storage 経由スポット確認（raw GET と sharp は個別に検証済みのため間接的に担保）。
- Railway Template 化（`railway.json` + Deploy on Railway ボタン）。
- 配布 doc に DATABASE_PUBLIC_URL 注記と、schema 2本（`schema.ts` / `schema.postgres.ts`）同期ルールの明文化。
- 本番へのデプロイはしていない。実験ブランチ上の作業。`site-analysis-2026-06.md` は未追跡のまま不触。

### 触ったファイル

- `packages/web/src/api/database/index.ts`（切替境界へ書き換え）
- `packages/web/src/api/database/libsql.ts`（新規・旧 index.ts の libsql 実装を退避）
- `packages/web/src/api/index.ts`（schema import を ./database 経由へ）
- `packages/web/src/server.ts`（schema import を ./api/database 経由へ）
- `packages/web/drizzle.postgres.config.ts`（dbCredentials 追記）
- `task.md`

## 追記 2026-06-20 — Claude: Railway Template 化（railway.json + Deploy ボタン）

### 実施

- `railway.json`（リポジトリ root）を追加。Nixpacks + Bun。
  - build: `bun install && bun run build`（= turbo build → tsc -b && vite build）
  - start: `bun packages/web/src/server.ts`（server.ts は import.meta.dir で dist 解決＝cwd 非依存）
  - healthcheck: `/`（空/未migration DB でも server が getSettings の例外を握って index.html を 200 で返す）
  - restart: ON_FAILURE / 10 retries
- `README.md` に「Deploy on Railway (distribution template)」節を追加。
  - Deploy ボタン（テンプレ id は `<YOUR_TEMPLATE_ID>` プレースホルダ。dashboard で template 公開後に差し替える maintainer 注記つき）。
  - テンプレ変数表（`DATABASE_PROVIDER=postgres` / `S3_FORCE_PATH_STYLE=true` 等）。
  - 一度だけの migration 手順。
  - `DATABASE_URL`(internal) vs `DATABASE_PUBLIC_URL`(`*.proxy.rlwy.net`) の注意書き。SSL 時は `?sslmode=require`。

### 検証

- railway.json valid JSON 確認。
- buildCommand 実走: root `bun run build`（turbo build）成功、`packages/web/dist/index.html` 生成確認。
- startCommand 実走: repo root から `bun packages/web/src/server.ts` 起動 → `GET /` 200、dist が import.meta.dir で解決されることを確認。
- ビルドツール（vite/tsc/turbo 等）は devDependencies だが、`bun install` は NODE_ENV に関係なく devDeps を入れるため本番ビルドと同条件で問題なし。

### 残り

- Railway dashboard での template 公開（plugins=PostgreSQL+Storage、変数設定）→ `<YOUR_TEMPLATE_ID>` 差し替え（秋さん/セットアップ担当の手作業）。
- 配布 doc（DISTRIBUTION.md / docs）への DATABASE_PUBLIC_URL・schema2本同期ルールの本反映。
- migration の初回自動適用は未対応（現状は手動1回）。turnkey 化するなら release/pre-deploy フックを検討。
- push はしていない。experiment ブランチにローカル commit のみ。

### 触ったファイル

- `railway.json`（新規）
- `README.md`
- `task.md`

## 追記 2026-06-20 — Claude: 配布版の起動時 自動マイグレーション

### 実施

- `packages/web/src/api/database/migrate.ts`（新規）に `runStartupMigrations()` を追加。
  - `DATABASE_PROVIDER !== "postgres"` なら即 return（本番 turso は完全 no-op）。
  - postgres 時のみ `drizzle-orm/bun-sql/migrator` を動的 import し、`packages/web/drizzle-postgres`
    の migration を適用。`import.meta.dir` 基準でフォルダ解決（cwd 非依存）。
  - drizzle migrator は `drizzle.__drizzle_migrations` で適用済みを追跡＝再起動/再デプロイで
    何度呼んでも安全（idempotent）。
  - 失敗時は原因・対処（DATABASE_URL 到達性 / PostgreSQL plugin / README 参照）を明示ログして
    例外を投げ直す。
- `server.ts`: `Bun.serve` 前に `try { await runStartupMigrations(); } catch { process.exit(1); }`。
  → 配布版は受け取った人が手で db:push / migrate を打たずに起動できる。失敗時はサーバを
  起動せず loud に落ち、Railway が前バージョンを維持（壊れた新版がトラフィックを受けない）。

### 検証（Railway テスト project、実 PostgreSQL）

- 空 DB（`DROP SCHEMA public CASCADE` で再現）から `DATABASE_PROVIDER=postgres` 起動
  → `[migrate] applying...` → `[migrate] up to date` → 6テーブル作成 → `GET /` 200 /
  `GET /api/settings` 134キー返却。
- 再起動（populated DB）→ 「up to date」・`already exists` エラーなし＝idempotency OK。
  追跡表 `drizzle.__drizzle_migrations` 生成確認。
- 到達不可 DB → exit code 1・サーバ listening せず・[migrate] の明示ログ出力（失敗が loud）。
- 本番パス（DATABASE_PROVIDER 未設定）→ 起動ログに `[migrate]` 0行＝no-op、影響なし。
- 本番回帰: `tsc -b` / `bun test ./src` 86 pass。

### 残り

- ② 配布ドキュメント整備（DISTRIBUTION.md / docs に自動マイグレーション挙動・DATABASE_PUBLIC_URL・
  schema2本同期ルールを反映）。README の「One-time database setup」は自動化済みのため文言更新余地あり。
- ① Railway dashboard で template 公開 → `<YOUR_TEMPLATE_ID>` 差し替え（手作業）。
- push はしていない。experiment ブランチにローカル commit のみ。

### 触ったファイル

- `packages/web/src/api/database/migrate.ts`（新規）
- `packages/web/src/server.ts`
- `task.md`

## 追記 2026-06-20 — Claude: 配布ドキュメント整備（自動migration / DATABASE_PUBLIC_URL / schema 2本同期）

### 実施

- `README.md`「One-time database setup」→「Database setup — automatic」に更新。
  起動時自動適用・idempotent・失敗時 loud・本番 no-op を明記。手動 apply は fallback として残置。
- `DISTRIBUTION.md` に「Railway All-in-One Template — Maintenance Notes」節を追加。
  自動migration挙動 / `DATABASE_URL` vs `DATABASE_PUBLIC_URL` / **schema 2本同期ルール**
  （schema.ts↔schema.postgres.ts、両 config で generate、`./database` 経由 import）を表つきで明文化。
- `docs/setup-guide.md`: 冒頭に「Railway 一本化（推奨・新）/ Turso+R2（従来）」の2方式注記。
  「Database schema を反映する」節に、Railway/PostgreSQL は起動時自動適用で db:push 不要と追記。
- `CLAUDE.md` / `AGENTS.md` の §0 必須ルールに「DB schema は2ファイル同期必須」を追加
  （PostgreSQL 側漏れは配布版だけ壊し本番で気づけない、を明記）。

### 検証

- 参照パス実在確認: `packages/web/drizzle/`（turso）/ `packages/web/drizzle-postgres/`（pg）両方存在。
- ドキュメントのみの変更（コード不変）。

### 残り

- ① Railway dashboard で template 公開 → README の `<YOUR_TEMPLATE_ID>` 差し替え（秋さん手作業）。
- push はしていない。experiment ブランチにローカル commit のみ。

### 触ったファイル

- `README.md` / `DISTRIBUTION.md` / `docs/setup-guide.md` / `CLAUDE.md` / `AGENTS.md` / `task.md`

## 追記 2026-06-20 — Claude: Railway build の Node 18 EOL 恒久対応

### 背景

- Railway の template deploy で build image が失敗。ログに「Node.js 18.x has reached
  End-Of-Life」。Nixpacks のデフォルト Node が 18 系で、ビルド環境の Node 指定問題
  （DB/Bucket は無関係）。アプリ実行は Bun だが、Nixpacks がビルド時に Node を用意する。

### 対応

- 暫定（秋さん側・即時）: Railway Variables に `NIXPACKS_NODE_VERSION=22` を追加して再 Deploy。
- 恒久（コミット）: root `package.json` に `"engines": { "node": "22.x" }` を追加。
  Nixpacks は engines.node を読んで Node バージョンを決めるため、テンプレ利用者が
  変数を手入力しなくて済む。Bun 版は既存 `packageManager: bun@1.3.5` で固定済み。
- ランタイム不変: 起動は `bun packages/web/src/server.ts` のまま。engines.node はビルド時
  Node のみに影響し、アプリ挙動は変わらない。本番は experiment ブランチ未マージのため影響なし
  （将来 main へ入っても Node 22 ビルドは安全方向）。

### 検証

- `package.json` JSON valid、engines 反映確認。
- `bun install` engines.node を許容（エラーなし）。`bun run build` 成功。
- 実ビルド検証は Railway 再ビルドが必要（push 後）。失敗が続く場合は `.nvmrc`/`nixpacks.toml`
  へエスカレーション予定。

### 残り

- push は秋さん確認後。push 後に Railway 再ビルドで Node 22 が効くか確認 →
  効けば暫定変数 `NIXPACKS_NODE_VERSION` は不要。
- ① template 公開 → README `<YOUR_TEMPLATE_ID>` 差し替え。

### 触ったファイル

- `package.json`（engines.node 追加）
- `task.md`

## 追記 2026-06-20 — Claude: Railway healthcheck を /api/health に変更

### 背景

- Node22修正で Build/Deploy は成功。次に Network > Healthcheck failure で落ちた。
- railway.json は healthcheckPath: "/"。`/` は index.html 読込 + getSettings(DB) + OGP 注入が
  絡み、初回起動の healthcheck には重く失敗しやすい。

### 対応

- `railway.json` の healthcheckPath を `/` → `/api/health` に変更。
- `/api/health`（`api/index.ts:248`、Hono basePath='api'）は `{status:'ok', build}` を 200 で返す
  DB非依存の軽量エンドポイント。Railway docs の「healthcheck は軽い200エンドポイント推奨」に合致。

### 検証

- ローカル起動で `GET /api/health` → 200 `{"status":"ok","build":"dev"}` を DB非依存(file::memory:)で確認。
- `/health`(basePathなし)は SPA フォールバックHTMLの200なので不採用、正は `/api/health`。
- railway.json JSON valid。

### 残り

- push 後に Railway 再デプロイで healthcheck 通過を確認。
- ① template 公開 → README `<YOUR_TEMPLATE_ID>` 差し替え。

### 触ったファイル

- `railway.json`（healthcheckPath）
- `task.md`

## 追記 2026-06-20 — Codex: Railway 起動時 migration の診断ログ強化 + retry

### 背景

- Railway template deploy は Build/Deploy まで成功し、Network > Healthcheck で失敗。
- Details/Diagnosis と Deploy Logs では、サーバ起動前の `runStartupMigrations()` が
  `CREATE SCHEMA IF NOT EXISTS "drizzle"` で失敗しており、`/api/health` に届く前に
  サーバが起動していないことを確認。
- ローカルでは Railway と同じ start command（`bun packages/web/src/server.ts`）を
  `packages/web/.env.railway-test.local` で実行し、migration 完了 → `GET /api/health` 200 /
  `GET /` 200 を確認。コードの基本起動パスは通っている。

### 対応

- `packages/web/src/api/database/migrate.ts` に秘密を出さない `DATABASE_URL` 判定ログを追加。
  - `*.railway.internal`（Railway private）
  - `*.proxy.rlwy.net`（Railway public TCP proxy）
  - sslmode の有無
    をパスワードなしで判別できる。
- migration 失敗時に `err.cause` / `code` / `syscall` などの原因情報もログに出すよう変更。
  これで DNS / timeout / auth / permission のどこで落ちているか次回ログから判別可能。
- Railway の Postgres 起動待ち・一時的な接続揺れに備え、起動時 migration に短い retry を追加。
  本番(turso)は `DATABASE_PROVIDER !== "postgres"` で引き続き完全 no-op。
- Railway 再デプロイ後の新ログで `DATABASE_URL target: *.railway.internal` かつ
  `cause 1: code=ERR_POSTGRES_CONNECTION_CLOSED` を確認。変数の有無ではなく、Bun SQL が
  Railway 内部Postgresへ SSL 指定なしで接続して閉じられている可能性が高い。
- `packages/web/src/api/database/postgres.ts` で Railway PostgreSQL URL
  (`*.railway.internal` / `*.proxy.rlwy.net`) かつ `sslmode` 未指定の場合、
  アプリ側で `sslmode=require` を自動付与するよう追加。

### 検証

- `cd packages/web && bun x tsc -b` 成功。
- `cd packages/web && bun test ./src` 86 pass / 0 fail。
- `cd packages/web && bun run build` 成功。
- `PORT=4389 bun --env-file=packages/web/.env.railway-test.local packages/web/src/server.ts`
  → `[migrate] DATABASE_URL target: *.proxy.rlwy.net ...` → up to date → server listen。
- `GET /api/health` 200 / `GET /` 200。
- SSL 自動付与後、再度 `tsc -b` / `bun test ./src` 86 pass / `bun run build` /
  ローカル起動（`PORT=4390 ...`）→ `GET /api/health` 200 / `GET /` 200 を確認。

### 残り

- experiment ブランチに push 後、Railway 再デプロイで新ログを確認。
- もし `DATABASE_URL target` が `*.railway.internal` で内部接続が失敗する場合は、
  Railway private network 側の問題として、暫定的に `DATABASE_URL=${{Postgres.DATABASE_PUBLIC_URL}}`
  を試す判断もあり。

### 触ったファイル

- `packages/web/src/api/database/migrate.ts`
- `packages/web/src/api/database/postgres.ts`
- `task.md`

## 追記 2026-06-20 — Codex: PostgreSQL driver を `pg` に切替（Railway 内部接続対策）

### 背景

- `0e76be6`（Bun SQL に `sslmode=require` を付ける修正）でも Railway の
  `@template/web` は失敗。GitHub status で最新 commit の Railway deploy failure を確認。
- 失敗箇所は引き続き起動時 migration 前後で、`/api/health` に届く前に server が起動していない。
- Railway docs では private networking が IPv6/dual-stack 前提で、ライブラリ側設定が必要な
  ケースがある。Bun SQL は Railway の `*.railway.internal` との相性が不明で、テンプレ配布の
  「押すだけ」体験にはリスクが残る。
- Claude に agmsg で相談。Claude は「まず `DATABASE_PUBLIC_URL` に寄せる案」を推奨。
  Codex 側では、人間の変数差し替えを増やさないため、まず DB driver をより実績のある
  `pg`（node-postgres）へ切り替える方針で実装。

### 対応

- PostgreSQL provider を `drizzle-orm/bun-sql` → `drizzle-orm/node-postgres` + `pg` に変更。
- startup migration も `drizzle-orm/node-postgres/migrator` に変更。
- Railway PostgreSQL host（`*.railway.internal` / `*.proxy.rlwy.net`）では `pg` の TLS 設定を
  アプリ側で付与（`ssl: { rejectUnauthorized: false }`）。
- `pg` は connection string に `sslmode=require` 等が入っていると、config 側の `ssl` object を
  上書きして `SELF_SIGNED_CERT_IN_CHAIN` になるため、Railway host では `sslmode` / `sslcert` /
  `sslkey` / `sslrootcert` query を削除してから Pool を作る。
- `pg` / `@types/pg` を追加。
- 本番(turso)は `DATABASE_PROVIDER !== "postgres"` で `postgres.ts` をロードしないため不変。

### 検証

- `cd packages/web && bun x tsc -b` 成功。
- `cd packages/web && bun test ./src` 86 pass / 0 fail。
- `cd packages/web && bun run build` 成功。
- `git diff --check` 成功。
- 実 Railway テストDB（`packages/web/.env.railway-test.local`、公開 TCP proxy）で起動:
  `PORT=4391 bun --env-file=packages/web/.env.railway-test.local packages/web/src/server.ts`
  → `[database] Railway PostgreSQL URL detected; using TLS for pg connection.`
  → `[migrate] PostgreSQL schema is up to date.`
  → `Web server listening on http://localhost:4391`
- `GET /api/health` 200 / `GET /` 200 / `GET /api/settings` 200 を確認。

### 残り

- experiment ブランチへ push 後、Railway で `*.railway.internal` の実デプロイ確認。
- まだ内部URLで落ちる場合は、Claude案どおり `DATABASE_URL=${{Postgres.DATABASE_PUBLIC_URL}}`
  をテンプレ推奨に切り替える（写真家1人分のポートフォリオなら latency/egress の影響は小さい）。

### 触ったファイル

- `packages/web/src/api/database/postgres.ts`
- `packages/web/src/api/database/migrate.ts`
- `packages/web/package.json`
- `bun.lock`
- `task.md`

## 追記 2026-06-20 — Codex: 配布版 DB URL 方針を `DATABASE_PUBLIC_URL` 優先に変更

### 背景

- `0355431`（PostgreSQL driver を `pg` に切替）を experiment ブランチへ push したが、
  Railway の実デプロイは引き続き失敗。GitHub commit status で failure を確認。
- つまり `*.railway.internal` の内部URLは、Bun SQL だけでなく `pg` でも今回の
  template project では安定しない。配布版で受け取る人にここをデバッグさせるのは不適切。
- Claude の提案どおり、実DB e2eで既に通っている Railway public TCP proxy
  (`DATABASE_PUBLIC_URL`, `*.proxy.rlwy.net:PORT`) を配布版の優先ルートにする。

### 対応

- `postgres.ts` は `DATABASE_PUBLIC_URL` が存在すれば `DATABASE_URL` より優先して使う。
  `DATABASE_URL` は後方互換の fallback として残す。
- `migrate.ts` のログも実際に使う DB target（public / private）を表示するよう変更。
- README / DISTRIBUTION.md のテンプレ変数説明を、`DATABASE_PUBLIC_URL` 優先に更新。

### 判断

- これはサイト品質・画質・管理画面品質には影響しない。DBの接続経路だけの変更。
- 写真家1人分のポートフォリオでは public TCP proxy の latency/egress は小さく、
  「ボタンで配布できる」わかりやすさを優先する。

### 残り

- この変更を push 後、Railway service の Variables に
  `DATABASE_PUBLIC_URL=${{Postgres.DATABASE_PUBLIC_URL}}` が入っていれば自動でそちらを使う。
- 現在の service に `DATABASE_PUBLIC_URL` が未設定なら、秋さん側で Variables に追加して
  Redeploy が必要（`DATABASE_URL` を消す必要はない）。

### 触ったファイル

- `packages/web/src/api/database/postgres.ts`
- `packages/web/src/api/database/migrate.ts`
- `README.md`
- `DISTRIBUTION.md`
- `task.md`

## 追記 2026-06-20 — Codex: admin login 後に reload しないと入れないバグ修正

### 背景

- 正しい `ADMIN_PASSWORD` を入れても、ログイン直後に `/admin` へ入れず、ページ reload 後だけ
  入れる既存バグが本番・配布版の両方で発生。
- 原因は frontend 側の `["admin-me"]` query cache。`AdminPage` は `useQuery(["admin-me"])` で
  `/api/admin/me` を見て、未認証なら `/admin/login` へ戻す。QueryClient の `staleTime` が
  60秒なので、ログイン前に取得した `{ authenticated: false }` が fresh のまま残ると、
  ログイン成功直後の `navigate("/admin")` で古い false を読んで戻される。
- reload すると in-memory cache が消え、cookie 付きで `/api/admin/me` を再取得するため入れる。

### 対応

- `packages/web/src/web/pages/admin-login.tsx`:
  login 成功時に `qc.setQueryData(["admin-me"], { authenticated: true })` してから
  `invalidateQueries(["admin-me"])` → `/admin` へ遷移。
- `packages/web/src/web/test/pages.render.test.tsx`:
  失敗再発防止として、未ログイン cache が残っていても login 成功後に `admin-me` が
  `{ authenticated: true }` へ更新されるテストを追加。
- Claude に agmsg 相談済み。原因仮説・修正方針とも承認。

### 検証

- `cd packages/web && bun x tsc -b` 成功。
- `cd packages/web && bun test ./src` 87 pass / 0 fail。
- `cd packages/web && bun run build` 成功。
- `git diff --check` 成功。

### 反映方針

- まず `main` に commit/push して本番 `akieguchi.com` へ反映。
- 同じ commit を `codex/railway-all-in-one-experiment` へ cherry-pick して配布版にも反映。

### 触ったファイル

- `packages/web/src/web/pages/admin-login.tsx`
- `packages/web/src/web/test/pages.render.test.tsx`
- `task.md`

## 追記 2026-06-22 — Claude: 配布版整備（P0〜P2 ドキュメント + /service 案内・購入ページ）

### 背景

Cowork からの引き継ぎで Railway Template 配布の整備を実施。受け取る写真家が「迷わない」ことを
最優先に、ドキュメント整備・管理画面の配布版対応・サイト内の案内/購入ページを作成。
Codex(`codex-reviewer`) と agmsg でレビューを回しながら 1タスクずつ進めた。

### やったこと（すべて `main` に push・本番反映済み）

- **P0-1 ADMIN_PASSWORD 固定値排除**: コードは元々 `process.env.ADMIN_PASSWORD` 参照でデフォルト
  無し（`test-pass` 不在）を確認。未設定時は login 無効＋500。README の Template variables 表で
  「必須・初期値なし」明記＋保守者ノート追加（Railway template composer で初期値/`secret()` を
  使わない）。⚠ Railway 側テンプレ変数の初期値削除は秋さん手動が必要（repo からは不可、
  `railway.json` 再追加は本番保護で不可）。
- **P0-2 `docs/post-deploy-guide.md` 新規**: 非エンジニア写真家向けの公開手順
  （Deploy→ADMIN_PASSWORD→Generate Domain→`/admin/login`→アップロード、つまずき表つき）。
- **P1-3 管理画面「はじめに」配布版対応**: `SetupTab` を5ステップ（サイト名→プロフィール→写真1枚
  →トップ写真→公開確認）に再編。完了 or 「閉じる」で1行バーに畳む（本番 akieguchi.com は
  元々完了→畳まれるだけで無害）。frontのみ・`sessionStorage`、DB/API/auth/settings 不変。
- **P1-4 `docs/sales-page.md`**: 販売・紹介1枚。料金は Cowork 確定（自分で ¥10,000 / おまかせ
  ¥30,000 / 月額なし）。
- **P2-5 `docs/setup-guide.md`**: 方法1=Railway テンプレ（推奨）を先頭、方法2=Turso+R2 を代替で温存。
- **P2-6 `docs/faq.md` / P2-7 `docs/distribution-ideas.md`**（便利化アイデア優先度表）。
- **`/service` ルート追加（案内・購入ページ）**: `packages/web/src/web/pages/service.tsx`。料金2カード
  ＋購入ボタン（Stripe Payment Link 仮: `STRIPE_SELF` / `STRIPE_CONCIERGE` 定数）。仮の間はメール
  申込にフォールバック＋「オンライン決済準備中」表示、実 https に差し替えると自動で Stripe 決済に
  切替（`STRIPE_LIVE` 判定）。`/service` 専用 OGP（og:title=「写真家のためのポートフォリオサイト」、
  og:image=`/og-service.jpg`）、`KNOWN_ROUTES`＋sitemap に追加（indexable）。ナビ未追加（URL直可）。
- **`public/og-service.jpg`（1200x630）** を sharp で生成（`scripts/gen-og-service.mjs`）。Railway
  Template Image URL 用にも流用可。
- **`docs/sns-announcement.md`**（IG/X 告知下書き）、**`docs/purchase-thankyou.md`**（決済後メール
  A=自分で / B=おまかせ）、**`docs/order-handling.md`**（秋くん用 申込対応 runbook）。

### 検証

- `tsc -b`=0、`bun run build` 成功、`bun test ./src` 87 pass / 0 fail（回帰なし）。
- `injectOgp` 実行で `/service` の title / og:title / og:image / desc / indexable を確認。
- 本番（build `ad776a5a`）: `/service`=200、`/og-service.jpg`=200、og:title 確認。P1-3 反映後も
  `/admin/login`=200、`/`=200 確認。

### 残り（秋さん側・repo ではできない）

1. **Stripe**: アカウント作成→Payment Link 2本（自分で/おまかせ）発行→ `/service` の
   `STRIPE_SELF` / `STRIPE_CONCIERGE` を実URLに差し替え（これだけでオンライン決済が有効化、
   「準備中」表示も自動で消える）。
2. **Railway Template Editor（cool-wide）**: Variables → `ADMIN_PASSWORD` の初期値（`test-pass` 等）
   を削除・必須入力のまま。任意で各変数に説明文。Template Image URL に `og-service.jpg` を設定。

### 次に再開するとき

秋さんが Stripe リンクか Railway 設定を終えたら小さく再開。便利化アイデア
（`docs/distribution-ideas.md`）着手なら、demo URL より「初回ウィザード / 『はじめに』の実運用確認」
が効果大（Codex 評）。ただし、まず販売導線を実際に1回通す方が価値が高い。

### 触ったファイル

- `packages/web/src/web/pages/service.tsx`（新規）, `packages/web/src/web/app.tsx`
- `packages/web/src/api/ogp.ts`, `packages/web/src/server.ts`
- `packages/web/public/og-service.jpg`（新規）, `packages/web/scripts/gen-og-service.mjs`（新規）
- `README.md`
- `docs/`: `post-deploy-guide.md`, `sales-page.md`, `setup-guide.md`, `faq.md`,
  `distribution-ideas.md`, `sns-announcement.md`, `purchase-thankyou.md`, `order-handling.md`
- `task.md`

## 追記 2026-06-22 — Claude: Stripe Payment Link を /service に組み込み（オンライン決済 有効化）

### 目的

仮値だった `/service` の購入ボタンを、実際の Stripe Payment Link（公開リンク）に差し替え、
オンライン決済を有効化する。あわせて販売導線ドキュメントが「Stripe が来た後」の運用に
追いついているか点検する。

### やったこと（`main` に push 予定）

- **Stripe URL 組み込み**（`packages/web/src/web/pages/service.tsx`）:
  - `STRIPE_SELF` = `https://buy.stripe.com/8x25kDdou8xldeEfHqgrS00`（自分で立てる / ¥10,000）
  - `STRIPE_CONCIERGE` = `https://buy.stripe.com/aFa14n0BIcNB0rScvegrS01`（おまかせ設定 / ¥30,000）
  - 両方 https になったため `STRIPE_LIVE` が true に。2つのボタンは Stripe Checkout を
    新規タブで開き（`target="_blank"` + `rel="noopener noreferrer"`）、ラベルは
    「このプランを申し込む」のまま。メールフォールバックは無効化、ページ下部の文言は
    「お支払いのあと…手順書/ご案内をお送りします」に自動で切替（「準備中」表示は消える）。
  - コメントも「placeholder」→「live・公開リンク・秘密鍵を入れない」旨に更新。
  - **公開リンクのみ。Stripe の秘密鍵 / Webhook secret / ダッシュボードURL は一切入れていない。**
- **`docs/order-handling.md`**: Stripe を「将来」扱いから「有効化済み（2026-06-22〜）」に更新。
  申し込み経路を「Stripe決済 / メール / SNS」に修正。入金確認は Stripe ダッシュボードで、
  決済後ページ/確認メールに purchase-thankyou.md の A・B を入れる案内（任意）を明記。

### 検証

- `bun run --cwd packages/web build`（= `tsc -b && vite build`）成功・型エラー0。
- `bun test ./src` = **88 pass / 0 fail**（回帰なし。OGP/sitemap の `/service` 含む）。
- `git diff --check` = クリーン。
- ルーティング・OGP・sitemap は既に `/service` を整合的に扱っており変更不要
  （`app.tsx` / `api/ogp.ts` `KNOWN_ROUTES` / `server.ts` paths）。
- ※ Stripe リンクへの実HTTPアクセス確認は本runの権限制約で未実施。URL は正規の
  `buy.stripe.com/...` 形式。秋さん側で各ボタンを1回ずつ押して Stripe Checkout が
  開くこと（実決済はしない）を確認推奨。

### 残り（秋さん側・repo ではできない）

1. **/service の本番動作確認**: push 後数分で各ボタンが正しい Stripe Checkout を開くか実機確認。
2. **Stripe 決済後ページ / 確認メール**: `docs/purchase-thankyou.md` の A（自分で）/ B（おまかせ）を
   各 Payment Link の確認ページ or メールに設定（任意だが一次返信が自動化されて楽）。
3. **Railway Template Editor（cool-wide）**: `ADMIN_PASSWORD` 初期値削除・Template Image URL 設定
   （前回 Handoff の残件のまま）。

### 触ったファイル

- `packages/web/src/web/pages/service.tsx`
- `docs/order-handling.md`
- `task.md`

## 追記 2026-06-22 — Codex: AGENTS.md §0 invariants 追記

### 目的

秋さん依頼により、今後の Claude Code / Codex 作業で守るべき invariants と
`ivys-house` とのリポジトリ境界を `AGENTS.md` に明示した。

### 対応

- `AGENTS.md` に `§0 invariants` を追加。
  - `withRetry`
  - 3-place settings sync
  - `assertOk()`
  - `Content-Encoding` 手動設定禁止
  - HTML `Cache-Control: no-store`
  - 現行スタック / デプロイ構成
- `eguchi-portfolio-app` と `ivys-house` のコード混在禁止を明記。
- 既存のスタック / Railway デプロイ表記を GitHub auto-deploy 前提に更新。

### 検証

- `git diff --check -- AGENTS.md task.md` 成功。

### 触ったファイル

- `AGENTS.md`
- `task.md`

## 追記 2026-06-25 — Codex: 管理画面 settings / 公開サイト連動デバッグ

### 目的

秋さん依頼「管理画面の項目すべてとサイトの連動をすべてデバッグして」に対応。
settings 台帳・API default・Provider / iframe live preview・公開ページ消費・admin mutation 後の
再取得を横断確認し、実際にズレる経路を修正した。

### 対応

- `settings-preview.ts` の台帳を API `GET /settings` が返す全 settings キーへ拡張。
  - サイト名 / ナビ文言 / Contact 文言 / Profile・SNS / CTA / note / print / SEO 系なども
    iframe preview の TanStack Query cache に入るようにした。
- `settings-preview.test.ts` に同期ガードを追加。
  - 台帳 → API default
  - API default → preview payload
  - admin で編集している settings キー → preview 台帳
- `Provider` の preview-message 受信で、CSS 変数系だけでなく React render 系の文言・toggle も
  同じ payload から反映するようにした。
- `gallerySortOrder` / `seriesSortOrder` は保存前 preview でも見た目が変わるよう、
  client 側にも `sortPhotosBySetting()` を追加して Top / Gallery / Series detail に接続。
- 写真の削除 / 復元 / 完全削除 / 更新時、Hero / Series 側の query cache も invalidate するよう補強。
  ヒーロー選択中・シリーズ表紙中の写真を触った後に管理画面と公開表示がズレる経路を潰した。
- 公開ページ / 管理画面 query の response body 読み取りを `jsonOrThrow()` / `assertOk()` 経由へ整理。
- `pages.render.test.tsx` に、preview message 後に Layout の nav / footer 文言が即時反映される
  回帰テストを追加。
- 既存 Lightbox テストは実装どおり close callback が 300ms 後に走るため、待機してから検証する形へ調整。

### 検証

- `cd packages/web && bun x tsc -b` 成功。
- `cd packages/web && bun test ./src` 成功（166 pass / 0 fail）。
  - 既存の `PhotoGallery.render.test.tsx` 由来の React `act(...)` warning は出るが失敗なし。
- `cd packages/web && bun run build` 成功。
- `git diff --check` 成功。

### 未実施 / 注意

- localhost dev server によるブラウザ実機確認は未実施。
  - sandbox で `listen EPERM 127.0.0.1:5173`。
  - 権限昇格は Codex 使用上限のため拒否され、迂回はしていない。
- settings 高影響差分のため agmsg で Claude Code へ P0/P1 レビュー依頼を送ろうとしたが、
  sandbox では agmsg SQLite が readonly、権限昇格も同じ使用上限で拒否されたため未送信。
- 既存の未コミット変更が多数あるため、今回 Codex は commit / push していない。

### 触ったファイル

- `packages/web/src/web/lib/settings-preview.ts`
- `packages/web/src/web/lib/settings-preview.test.ts`
- `packages/web/src/web/lib/api.ts`
- `packages/web/src/web/lib/photo-sort.ts`
- `packages/web/src/web/lib/photo-sort.test.ts`
- `packages/web/src/web/components/provider.tsx`
- `packages/web/src/web/components/Layout.tsx`
- `packages/web/src/web/components/SeriesGrid.tsx`
- `packages/web/src/web/components/PhotoGallery.tsx`
- `packages/web/src/web/components/InquiryCta.tsx`
- `packages/web/src/web/hooks/usePageTitle.ts`
- `packages/web/src/web/pages/admin.tsx`
- `packages/web/src/web/pages/top.tsx`
- `packages/web/src/web/pages/gallery.tsx`
- `packages/web/src/web/pages/series-detail.tsx`
- `packages/web/src/web/pages/series.tsx`
- `packages/web/src/web/pages/profile.tsx`
- `packages/web/src/web/pages/contact.tsx`
- `packages/web/src/web/test/pages.render.test.tsx`
- `task.md`

## 追記 2026-06-25 — Codex: 管理画面 v3 仕様ドラフト作成

### 目的

秋さん依頼「管理画面で写真の向きを変えられるようにしたい。加えて調整できることを増やし、既存項目を使いやすくしたい。まず仕様書を作って Claude に検討してもらう」に対応。

### 対応

- `admin-enhancement-spec-v3-draft.md` を新規作成。
  - 写真ごとの `rotationDeg`（0/90/180/270）を中心に、非破壊で向きを変える方針を整理。
  - 90/270度時の縦横比入れ替え、画像プロキシ `rot` query、srcset / Lightbox / Hero / Series cover 反映漏れ防止を明記。
  - 管理画面 Inspector「見え方」セクション、Library クイック回転、一括回転、`focalX/Y` による見せる中心、使用状況 badge、Settings の使いやすさ改善案を整理。
  - Claude Code へのレビュー依頼ポイント（proxy方式、DBカラム名、`focalX/Y` 同時導入可否、公開側反映漏れ、query invalidation）を末尾に記載。
- `AGENTS.md` の仕様書一覧に v3 ドラフトを追加。

### 検証

- Markdown / docs 変更のみ。実装・型チェック・ビルドは未実施。

### 触ったファイル

- `admin-enhancement-spec-v3-draft.md`
- `AGENTS.md`
- `task.md`

## 追記 2026-06-25 — Codex: Claude Codeレビュー反映

### 目的

agmsg 経由で Claude Code から `admin-enhancement-spec-v3-draft.md` の P0/P1 レビューが返ったため、実装前に落としやすい指摘を仕様書へ反映した。

### 対応

- `admin-enhancement-spec-v3-draft.md` に「Claude Codeレビュー結果（2026-06-25）」を追加。
- P0として以下を明記。
  - `photoWithThumbs()` の `thumbUrl` / `mediumUrl` は事前生成済み R2 URL であり、`rotationDeg != 0` の写真ではプロキシ `rot` を通らない。
  - 画像プロキシ cache key に `rot` を含めないと、回転違いが同じキャッシュに混在する。
- P1として以下を明記。
  - OGP / server-side hero preload に hero photo の `rotationDeg` を渡す。
  - `srcSetFor(url, preset)` は `rotationDeg` 渡し忘れが起きやすいため、写真オブジェクト渡し helper へ寄せる。
  - `focalX/Y` は schema だけ V3-1 で追加し、UI / object-position 配線は V3-4 以降へ分けるのを推奨。

### 検証

- Markdown 差分チェックのみ実施。実装・型チェック・ビルドはこの時点では未実施。

### 触ったファイル

- `admin-enhancement-spec-v3-draft.md`
- `task.md`

## 追記 2026-06-25 — Codex: 管理画面 v3 V3-1 土台実装

### 目的

秋さん依頼「codexで実装しよう。困ったらclaudeに聞いて」に対応し、
`admin-enhancement-spec-v3-draft.md` の V3-1（土台）を実装。
管理画面UIの回転ボタンはまだ作らず、写真ごとの向き情報をDB/API/画像配信/公開表示へ通す基盤を先に作った。

### 対応

- `photos` に `rotationDeg` / `focalX` / `focalY` を追加。
  - `schema.ts`（Turso/libSQL）と `schema.postgres.ts`（PostgreSQL配布版）の両方を更新。
  - Turso 起動時補完 `ensureTursoColumns()` にも3カラムを追加。
  - `drizzle/0004_flowery_bloodstorm.sql` と `drizzle-postgres/0001_woozy_chronomancer.sql` を生成。
- 共通画像URL helper `src/shared/image-url.ts` を追加。
  - `rot` query の付与、回転値バリデーション、90/270度時の縦横比入れ替えを共通化。
  - 単体テスト `src/shared/image-url.test.ts` を追加。
- 画像プロキシ `/api/images/:key` が `rot=0|90|180|270` を受け取り、cache key に `rot` を含めるようにした。
  - `w` なしでも `rot` がある場合は sharp を通して回転後の画像を返す。
- `photoWithThumbs()` を `rotationDeg` 対応。
  - 回転ありの写真は `thumbUrl` / `mediumUrl` を R2直URLではなく proxy + `rot` 付きURLへ切り替える。
- `PATCH /admin/photos/:id` と batch API に `rotationDeg` / `focalX` / `focalY` の土台を追加。
  - batch: `rotate_left` / `rotate_right` / `reset_rotation` / `reset_focal_point`。
- 公開側の主要表示経路を回転対応helperへ接続。
  - `PhotoGallery` / `Lightbox` / `Top` Hero / `SeriesGrid` / `Picture`。
  - `PhotoGallery` は 90/270度で `aspect-ratio` と width/height 属性を入れ替える。
  - `Lightbox` の preloading / grid thumb / full quality / zoom 画像も `rotationDeg` を通す。
- OGP / server-side preload を回転対応。
  - home hero OGP / hero preload に `rotationDeg` を渡す。
  - series cover OGP / JSON-LD image に `imageRotationDeg` を渡す。
  - gallery preload も `rot` 付きURLを生成する。

### DB反映

- `cd packages/web && bun run db:push` は最初、Drizzle が既存474件への NOT NULL カラム追加を
  対話確認しようとして非TTYで停止。
- 代わりに libSQL へ存在確認つきSQLで以下3カラムを安全に追加。
  - `rotation_deg integer NOT NULL DEFAULT 0`
  - `focal_x integer NOT NULL DEFAULT 50`
  - `focal_y integer NOT NULL DEFAULT 50`
- その後 `cd packages/web && bun run db:push` を再実行し、`No changes detected` を確認済み。

### 検証

- `cd packages/web && bun test ./src/shared/image-url.test.ts` 成功（3 pass）。
- `cd packages/web && bun x tsc -b` 成功。
- `cd packages/web && bun test ./src` 成功（169 pass / 0 fail）。
  - 既存の `PhotoGallery.render.test.tsx` 由来の React `act(...)` warning は継続。
- `cd packages/web && bun run build` 成功。
- `git diff --check` 成功。

### 注意 / 未実装

- 管理画面の回転UI（Inspector「見え方」セクション、Library quick rotate）は未実装。次は V3-2。
- `focalX/Y` は DB/API 土台のみ。object-position UI配線は Claude レビューどおり後続推奨。
- commit / push は未実施。既存の未コミット変更・未追跡ファイルがあるため、範囲確認してから行うこと。

### 触ったファイル

- `packages/web/src/shared/image-url.ts`
- `packages/web/src/shared/image-url.test.ts`
- `packages/web/src/api/database/schema.ts`
- `packages/web/src/api/database/schema.postgres.ts`
- `packages/web/src/api/database/migrate.ts`
- `packages/web/drizzle/0004_flowery_bloodstorm.sql`
- `packages/web/drizzle/meta/0004_snapshot.json`
- `packages/web/drizzle/meta/_journal.json`
- `packages/web/drizzle-postgres/0001_woozy_chronomancer.sql`
- `packages/web/drizzle-postgres/meta/0001_snapshot.json`
- `packages/web/drizzle-postgres/meta/_journal.json`
- `packages/web/src/api/index.ts`
- `packages/web/src/api/ogp.ts`
- `packages/web/src/server.ts`
- `packages/web/src/web/lib/picture.ts`
- `packages/web/src/web/components/PhotoGallery.tsx`
- `packages/web/src/web/components/Lightbox.tsx`
- `packages/web/src/web/components/Picture.tsx`
- `packages/web/src/web/components/SeriesGrid.tsx`
- `packages/web/src/web/pages/top.tsx`
- `packages/web/src/web/pages/admin.tsx`
- `packages/web/src/web/test/pages.render.test.tsx`
- `task.md`

## 追記 2026-06-25 — Codex: 管理画面 v3 V3-2 回転UI実装

### 目的

V3-1で追加した `rotationDeg` 土台を、管理画面から実際に操作できるようにする。

### 対応

- Library インスペクタに「向き」セクションを追加。
  - 左90° / 0° / 90° / 180° / 270° / 右90° を操作可能。
  - インスペクタ上のプレビューは保存前の `editForm.rotationDeg` を即時反映。
  - Save で `PATCH /admin/photos/:id` に `rotationDeg` を保存。
- Library グリッドの写真タイルにクイック回転ボタンを追加。
  - hover / touch 表示で左90°・右90°を即保存。
  - 保存後は `photos` / `series` / `hero-photos` / `admin-hero-photos` を invalidate。
- 複数選択ツールバーに一括回転を追加。
  - `rotate_left` / `rotate_right` / `reset_rotation` を batch API へ接続。
- admin 内の写真サムネイルURLを `srcFor` helper 経由に統一。
  - Library / Trash / Quick Preview / Bulk table / Hero / Series / Top works picker で `rotationDeg` を反映。
- 共通 helper `rotateRotationDeg()` を追加。
  - 左回転 `0° → 270°` の wraparound を単体テストで固定。

### 検証

- `cd packages/web && bun x tsc -b` 成功。
- `cd packages/web && bun test ./src` 成功（170 pass / 0 fail）。
  - 既存の `PhotoGallery.render.test.tsx` 由来の React `act(...)` warning は継続。
- `cd packages/web && bun run build` 成功。
- `git diff --check` 成功。

### 注意 / 未実装

- dev server / ブラウザ実機での管理画面クリック確認は未実施。
- `focalX/Y` はまだUI未接続。V3-4以降で object-position / focal point UI を入れる想定。
- commit / push は未実施。既存未コミット差分が多いため、範囲確認後に行うこと。

### 触ったファイル

- `packages/web/src/shared/image-url.ts`
- `packages/web/src/shared/image-url.test.ts`
- `packages/web/src/web/lib/picture.ts`
- `packages/web/src/web/pages/admin.tsx`
- `task.md`

## 追記 2026-06-25 — Codex: 管理画面 v3 V3-3/V3-4 focal point 実装

### 目的

V3-1でDB/API土台だけ入れていた `focalX` / `focalY` を、公開サイトと管理画面の切り抜き表示へ接続する。
あわせて、V3-3「公開サイト全反映」として Top 系レイアウトに残っていた古い画像URL直書きを helper 経由へ寄せた。

### 対応

- 共通 helper に focal point 正規化を追加。
  - `normalizeFocalPoint()` / `objectPositionFromFocal()` を追加。
  - `focalX/Y` を `0% 0%`〜`100% 100%` の `object-position` に変換。
  - invalid / 未設定は `50% 50%` にフォールバック。
- 公開側の crop 表示に `focalX/Y` を反映。
  - `PhotoGallery` の全タイル画像に `object-position` を適用。
  - `SeriesGrid` のシリーズ表紙に `coverFocalX/Y` を適用。
  - Top の Hero / quiet-grid / editorial / immersive の crop 表示に focal point を適用。
- Top 内に残っていた古い `photo.url?w=...` 直書きを `srcFor()` / `srcSetFor()` へ置換。
  - Top Works 系の一部レイアウトでも `rotationDeg` が反映されるようになった。
- 管理画面 Inspector に「見せる中心」UIを追加。
  - 9点プリセット（左上 / 上 / 右上 / 左 / 中央 / 右 / 左下 / 下 / 右下）。
  - 小さな正方形 crop preview 上で、保存前の `rotationDeg` と `focalX/Y` を即時反映。
  - Save で `PATCH /admin/photos/:id` に `focalX/Y` を保存。
- 一括操作ツールバーに「見せる中心を中央へ戻す」ボタンを追加。
  - 既存 batch API の `reset_focal_point` に接続。
- 管理画面内サムネイルにも focal point を反映。
  - Library / Trash / Bulk table / Hero / Series / Top works picker。
- 回帰テストを追加。
  - `PhotoGallery.render.test.tsx` で `focalX/Y` が `object-position` に反映されることを確認。
  - `image-url.test.ts` で focal point の clamp / fallback を確認。

### 検証

- `cd packages/web && bun x tsc -b` 成功。
- `cd packages/web && bun test ./src` 成功（172 pass / 0 fail）。
  - 既存の `PhotoGallery.render.test.tsx` 由来の React `act(...)` warning は継続。
- `cd packages/web && bun run build` 成功。
- `git diff --check` 成功。

### 注意 / 未実装

- dev server / ブラウザ実機での管理画面クリック確認は未実施。
- focal point は9点プリセットのみ。ドラッグで任意位置を選ぶUIは未実装。
- Lightbox は全体表示（contain）なので `focalX/Y` は意図的に反映しない。
- commit / push は未実施。既存未コミット差分が多いため、範囲確認後に行うこと。

### 触ったファイル

- `packages/web/src/shared/image-url.ts`
- `packages/web/src/shared/image-url.test.ts`
- `packages/web/src/web/lib/picture.ts`
- `packages/web/src/web/components/PhotoGallery.tsx`
- `packages/web/src/web/components/PhotoGallery.render.test.tsx`
- `packages/web/src/web/components/SeriesGrid.tsx`
- `packages/web/src/web/pages/top.tsx`
- `packages/web/src/web/pages/admin.tsx`
- `task.md`

## 追記 2026-06-26 — Codex: 管理画面 v3 V3-4 回転ショートカット

### 目的

V3-2で入れた回転操作を、Library のキーボード操作からも使えるようにする。
仕様書チェック項目「ショートカット一覧に新規操作が載る」に対応。

### 対応

- Library 画面で `[` / `]` ショートカットを追加。
  - `[` = 選択写真を左90°回転。
  - `]` = 選択写真を右90°回転。
  - 入力欄 / textarea / select フォーカス中は無効。
  - 複数選択中は既存 batch API の `rotate_left` / `rotate_right` を使う。
  - 選択が無く keyboard cursor だけある場合は単体 quick rotate を使う。
- batch operation の union 型を `BatchPhotoOperation` として切り出し、ショートカット側からも同じ operation 名を使えるよう整理。
- キーボードショートカット一覧に `[ / ]` を追記。

### 検証

- `cd packages/web && bun x tsc -b` 成功。
- `cd packages/web && bun test ./src` 成功（172 pass / 0 fail）。
  - 既存の `PhotoGallery.render.test.tsx` 由来の React `act(...)` warning は継続。
- `cd packages/web && bun run build` 成功。
- `git diff --check` 成功。

### 注意 / 未実装

- dev server / ブラウザ実機でのショートカット確認は未実施。
- commit / push は未実施。既存未コミット差分が多いため、範囲確認後に行うこと。

### 触ったファイル

- `packages/web/src/web/pages/admin.tsx`
- `task.md`

## 追記 2026-06-26 — Codex: 本番デバッグ + 配布用ブランチ反映

### 目的

秋さん依頼「今のメインサイトをデバッグして、配布用（販売用）のサブサイトに現状を反映させたい」に対応。
本番 `akieguchi.com` の現在の動作を確認し、配布用 Railway template ブランチ
`codex/railway-all-in-one-experiment` が `main` より古い状態で止まっていないかを確認した。

### 本番確認

- `https://akieguchi.com/api/health` は 200。build は `3d05b86a`。
- `/api/settings` は 200 で、江口秋 / Aki Eguchi の本番 settings を返している。
- `/api/photos` は 200 で、公開写真 445 件を返している。`rotationDeg` / `focalX` / `focalY` / `thumbUrl` / `mediumUrl` も含まれている。
- `/api/categories` は 200。
- ブラウザで `/`, `/gallery`, `/series`, `/about`, `/contact`, `/service` を確認。
  - 致命的な白画面・画像破損は確認されず。
  - `/gallery` は初期ロード直後に一瞬だけ generic fallback 表示に見えるが、数秒待つと `Gallery`、フィルタ、24枚の初期画像が正常表示された。
  - `/contact` も数秒待つと本番 settings が反映され、フォームが正常表示された。
  - `/service` は Stripe Payment Link 2本へリンクされていることを確認。決済クリックは未実行。
- `/gallery` の写真をクリックして Lightbox を開き、次の写真へ進めることを確認。
  - 1枚目: medium 画像まで読み込み完了。
  - 2枚目: counter が `2 / 24` へ進み、medium 画像が読み込み完了。

### 配布用ブランチ確認

- `codex/railway-all-in-one-experiment` は `main` の祖先で、独自の未反映 commit はなかった。
- `main` には配布版に必要な PostgreSQL schema / migration / service page / Railway template docs / 最新の画像回転・focal point 対応がすでに含まれている。
- そのため、配布用ブランチは merge conflict なしの fast-forward で `main` に追従できる状態だった。
- `main` を `7058b95` まで push 後、`codex/railway-all-in-one-experiment` も同じ `7058b95` へ fast-forward して push 済み。

### 検証

- `cd packages/web && bun x tsc -b` 成功。
- `cd packages/web && bun test ./src/shared/image-url.test.ts ./src/api/site-defaults.test.ts ./src/api/static-template.test.ts` 成功（13 pass）。
- `cd packages/web && bun test ./src` 成功（172 pass / 0 fail）。
  - 既存の `PhotoGallery.render.test.tsx` 由来の React `act(...)` warning は継続。
- `cd packages/web && bun run build` 成功。

### 注意

- 本番の `/gallery` / `/contact` はデータ取得完了後は正常。初期ロード中の generic fallback 表示は残るため、気になる場合はサーバ注入済み meta から初期クライアント表示を作るなど、別タスクで改善候補。
- `main` push 後に `/api/health` を2回確認したが、確認時点の本番 build は `3d05b86a` のまま。今回のアプリ本体はすでに `3d05b86a` として本番で動作確認済みで、`7058b95` は記録追記のみ。
- `claude-code-luxury-feel-prompt.md` は未追跡のまま残っており、今回の反映対象には含めない。

### 触ったファイル

- `task.md`

## 追記 2026-06-27 — Codex: MacBook / Mac mini 2台運用手順

### 目的

秋さん依頼「プロジェクトをMacBookとMac miniで共通して作業できるようにするにはどうしたらいいか」に対応。
Claude Code にも agmsg で意見を依頼し、採用可の返答を受領。

### 対応

- 2台運用の方針を `docs/two-mac-workflow.md` として追加。
  - GitHub をコード正本にする。
  - Railway は `git push` から auto-deploy。
  - Turso / R2 をデータ正本にする。
  - `.env` は各Macに置き、秘密情報はGitに入れない。
  - iCloud / Dropbox でリポジトリ丸ごと同期しない。
- `README.md` の Local Setup から2台運用ドキュメントへリンクを追加。
- `AGENTS.md` にAI向けの2台運用ルールを追記。
- Claude Code の助言を受け、`.env` 管理を楽にする選択肢として 1Password CLI / Railway CLI をドキュメントへ追記。

### 検証

- ドキュメントのみの変更。
- `git diff --check -- README.md AGENTS.md docs/two-mac-workflow.md task.md` 成功。

### 注意

- Claude Code からは「採用可。iCloud/Dropbox排除は正解。P0注意点は `.env` の2台同期で、1Password CLI または Railway CLI を使うと楽」と返答あり。
- `.env` の実値は扱っていない。

### 触ったファイル

- `README.md`
- `docs/two-mac-workflow.md`
- `AGENTS.md`
- `task.md`

## 追記 2026-06-27 — Codex: `/service` 完成版調整 + Runable要素除去

### 目的

秋さん依頼「serviceページに書いてあること（あとデザイン）を完成版に仕上げたい。
独自ドメイン対応って書いてあるけどそうなの？」に対応。
あわせて「Runableのやつが表示されてるので、Runable要素をなくす」方針を反映。

### 対応

- `/service` の構成を、ヒーロー → サイト表示イメージ → 想定読者 → できること → 料金 → 始め方 → FAQ → Contact に再編。
- デザインを写真家サイト寄りの静かな編集調に調整。
  - 罫線中心、カード感を抑えた料金表、サイトプレビュー風のビジュアルを追加。
  - デスクトップ / モバイルで横はみ出しが出ないよう確認。
- 独自ドメイン表記を正確化。
  - 「接続できる作り」であり、ドメイン取得費・更新費は料金に含まないことをFAQと料金注記に明記。
  - おまかせ設定では接続作業まで対応、自分で立てる場合は手順案内、という表現に整理。
- `/service` の見える文言から Railway などの基盤名を外し、「公開場所の実費」に言い換え。
- Runable / AI テンプレート由来に見えていた `public/og-image.jpg` を写真ポートフォリオ用の静かなOG画像に差し替え。
- `scripts/gen-og-service.mjs` を更新し、`og-service.jpg` と `og-image.jpg` の両方を生成するようにした。
- 未使用の `packages/web/vite/plugins/runable-analytics-plugin.ts` を削除。
- 管理画面に残っていた Runable バッジ前提コメントを削除。

### 検証

- `cd packages/web && bun x tsc -b` 成功。
- `cd packages/web && bun run build` 成功。
- `cd packages/web && bun test ./src/web/test/pages.render.test.tsx` 成功（23 pass）。
- `cd packages/web && bun test ./src/api/ogp.test.ts` 成功（28 pass）。
- `cd packages/web && bun test ./src` 成功（173 pass / 0 fail）。
  - 既存の `PhotoGallery.render.test.tsx` 由来の React `act(...)` warning は継続。
- `git diff --check` 成功。
- ローカル `http://127.0.0.1:5173/service` をブラウザ確認。
  - デスクトップ: 本文に Runable / Railway / AI 系文言なし。
  - モバイル幅 390px: 横はみ出しなし、Runable / Railway 文言なし。
- `public/og-image.jpg` / `public/og-service.jpg` を目視確認。

### 注意

- `claude-code-luxury-feel-prompt.md` は未追跡のまま残っており、今回の対象外。
- push 後、本番でSNSプレビューを確認する場合は各SNS側のOGキャッシュが残る可能性あり。

### 触ったファイル

- `packages/web/src/web/pages/service.tsx`
- `packages/web/public/og-image.jpg`
- `packages/web/public/og-service.jpg`
- `packages/web/scripts/gen-og-service.mjs`
- `packages/web/src/web/pages/admin.tsx`
- `packages/web/vite/plugins/runable-analytics-plugin.ts`
- `task.md`

## 追記 2026-06-27 — Codex: `/service` 実例・管理画面訴求の再調整

### 目的

秋さん依頼「謎の空白グリッドをなくす」「ポートフォリオサイト内なら例はそこで見れるのでは」「管理画面をもっとアピールしたい」に対応。
Claude Code に agmsg でデザインレビューも依頼し、P0/P1の短い指摘を反映。

### 対応

- ヒーロー直下の空グリッド風プレビューを廃止し、公開写真APIから取得した実写真で「このサイト自体が、そのまま実例です」と見せる構成に変更。
  - `/gallery` / `/about` / `/contact` への導線を置き、実際の公開状態をそのまま見られるようにした。
- 管理画面セクションを追加し、写真管理・S/M/Lサイズ指定・プロフィール/連絡先/SNS・見た目調整がブラウザからできることを明示。
  - 実写真を使った管理画面プレビューを配置。
  - ロード中や写真0枚時に空白のプレビュー枠だけ出ないよう、写真がある時だけ表示。
- ヒーロー本文とページ内ナビに管理画面の価値を追加。
- Pricingの主従を少しだけ強め、販売色が強くなりすぎない範囲で「Start here」とprimary枠を追加。

### Claude Code 相談メモ

- P0: APIロード中に `photos=[]` のまま AdminPreview の大きな空白枠が出る点を先に直すべき、という指摘。
- P1: 管理画面プレビューはアクティブ行や操作感を少し足すと伝わりやすい、Pricingの階層差も薄い、という指摘。
- 反映: 空枠ガード、サイドメニューのアクティブ表現、Live previewラベル、Pricingの控えめな主従を追加。

### 検証

- `cd packages/web && bun x tsc -b` 成功。
- `cd packages/web && bun run build` 成功。
- `cd packages/web && bun test ./src/web/test/pages.render.test.tsx` 成功（23 pass）。
- `cd packages/web && bun test ./src` 成功（173 pass / 0 fail）。
  - 既存の `PhotoGallery.render.test.tsx` 由来の React `act(...)` warning は継続。
- `git diff --check` 成功。
- ローカル `http://127.0.0.1:5173/service` を Playwright で確認。
  - デスクトップ / モバイルとも横はみ出しなし。
  - Runable / Railway / AI 文言なし。
  - 実例写真5枚、管理画面プレビュー写真3枚が表示。
  - 管理画面プレビューは写真読み込み後に表示され、空白枠だけの状態を避ける。

### 注意

- `claude-code-luxury-feel-prompt.md` は未追跡のまま残っており、今回の対象外。

### 触ったファイル

- `packages/web/src/web/pages/service.tsx`
- `task.md`

## 追記 2026-06-27 — Codex: `/service` 実態に合わせた説明へ再修正

### 目的

秋さん指摘「Live example と Admin が実際のサイトに即していない」「S/M/L が同じサイズで、注目する理由がわからない」「購入後に何が起きるのか」に対応。

### 対応

- `/service` の `Live example` 風セクションを、実ページに即した `Actual site` セクションへ変更。
  - 作った風の見本ではなく、`/gallery` / `/about` / `/contact` を実際に見られる導線として提示。
  - 写真は「掲載写真の一部」として控えめに残し、実際のページ構造を見に行く流れにした。
- 管理画面の疑似スクリーンショット風 UI を削除。
  - 「管理画面で編集する内容」→「公開サイトのどこに反映されるか」の対応表に変更。
  - 管理画面自体は購入者だけが使う場所で、公開サイトには見えないことを明記。
- S/M/L の訴求を弱め、「写真の大きさ調整は強弱をつけるための機能。覚える必要はない」と説明に整理。
- `After purchase` セクションを追加。
  - Stripe 決済後、自動でサイトが完成するわけではないことを明記。
  - 決済確認 → 自分で立てる場合の手順書/立ち上げ用リンク → おまかせ設定の場合のヒアリング/受け渡し、の流れを追加。
- `docs/sales-page.md` も同じ方針に合わせて、S/M/L 強調を弱め、購入後フローを追記。

### 検証

- `cd packages/web && bun x tsc -b` 成功。
- `cd packages/web && bun run build` 成功。
- `cd packages/web && bun test ./src/web/test/pages.render.test.tsx` 成功（23 pass）。
- `cd packages/web && bun test ./src` 成功（173 pass / 0 fail）。
  - 既存の `PhotoGallery.render.test.tsx` 由来の React `act(...)` warning は継続。
- `git diff --check` 成功。
- ローカル `http://127.0.0.1:5173/service` を Playwright で確認。
  - デスクトップ / モバイルとも横はみ出しなし。
  - Runable / Railway 文言なし。
  - 古い `Live example` / `Live preview` / `How it starts` 表現なし。
  - `Actual site` / `Admin` / `After purchase` の各セクション表示を確認。

### 注意

- `claude-code-luxury-feel-prompt.md` は未追跡のまま残っており、今回の対象外。

### 触ったファイル

- `packages/web/src/web/pages/service.tsx`
- `docs/sales-page.md`
- `task.md`

## 2026-06-27 — /service ページ バグ修正

### 目的

`/service` ページの表示バグ・導線バグ・配布版漏れを修正し、販売ページとして破綻なく読める状態にする。

### 再現した不具合

1. **Sticky CTA バーが初期読み込み時に表示される (P0)**
   IntersectionObserver が sentinel（pricing セクション直後の 0px 要素）を「非交差」と判定し、ページ読み込み直後に sticky バーが表示されてしまう。sentinel はまだビューポート下方にあるが、Observer は「上方に通過した」と「まだ到達していない」を区別できていなかった。

2. **Nested `<main>` 要素 (P1)**
   ServicePage が `<main>` を使用。Layout が `<main id="main-content">` でラップするため、HTML5 違反のネスト `<main>` が発生。他の全ページは `<section>` を使用。

3. **配布版での /service ルートアクセス可能 (P1)**
   ナビリンクは `shouldShowServiceLink` で非表示にしているが、URL 直打ちで akieguchi 固有情報（メール、Stripe リンク、SNS、"akieguchi.com" テキスト）が配布版でも閲覧可能だった。

### 修正内容

1. **StickyCtaBar observer 修正**: `entry.boundingClientRect.top < 0` チェックを追加。sentinel がビューポート上方（ユーザーが pricing を通過した状態）のときのみバーを表示。

2. **`<main>` → `<section>` に変更**: 他ページと同一パターンに統一。

3. **`isServiceHost()` ガード追加**: `window.location.hostname` が akieguchi.com / localhost / 127.0.0.1 以外の場合、コンポーネントが `null` を返す。React hooks は条件分岐の前に呼び出し済み。

### 触ったファイル

- `packages/web/src/web/pages/service.tsx`
- `task.md`

### 検証コマンドと結果

- `bunx tsc -b` → 成功
- `bun run build` → 成功
- `bun test ./src` → 173 テスト全パス
- `bun run lint` → Lightbox.tsx の既存エラー（今回の変更と無関係）
- `git diff --check` → whitespace 問題なし

### ブラウザ確認した viewport

- Desktop 1440x900: 全セクション表示正常、左ナビ表示、リンク正常
- Tablet 768x1024: 左ナビ表示、レスポンシブ正常
- Mobile 375x812: 初期表示で sticky バー非表示確認、スクロール後に正しく表示確認
- 横スクロールなし（desktop/mobile 両方で確認）
- Stripe Payment Link の href 2本とも正しい URL を確認
- 全リンク先を Playwright で抽出・確認

### Codex レビュー

- agmsg で codex-reviewer にレビュー依頼 → P1 残指摘を受領
- 指摘内容: クライアント側ガードだけではサーバー側 OGP/sitemap が配布版でも `/service` を公開
- 追加修正 (efbcc8a):
  - `ogp.ts`: `isServiceSiteUrl()` ヘルパー追加。SERVICE_OG は akieguchi.com のみ適用、他ホストでは noindex
  - `server.ts`: sitemap から `/service` を非 akieguchi ホストで除外
  - `ogp.test.ts`: テスト更新 + 非 akieguchi noindex テスト追加（174 テスト全パス）

### 追加で触ったファイル

- `packages/web/src/api/ogp.ts`
- `packages/web/src/api/ogp.test.ts`
- `packages/web/src/server.ts`

### Commit

- `86dcd63` — クライアント側修正（sticky CTA、nested main、distribution guard）
- `efbcc8a` — サーバー側修正（OGP/sitemap ホストゲート）

### 未解決・今後確認すべき点

- P2: 配布版で `/service` にアクセスすると service.tsx チャンクがダウンロードされる（Stripe URL 等が JS ソース内に含まれる）。ルートレベルでの lazy-load ガードが理想だが、Stripe Payment Link は公開 URL のため実害は低い。
- `claude-code-luxury-feel-prompt.md` と `service.tsx.handoff.md` は未追跡のまま（今回の対象外）。

## 追記 2026-06-27 — Codex: `/service` 文字かぶり修正 + 改善案反映

### 目的

秋さん指摘「文字が写真にガンかぶりしてる」に対応し、あわせて Claude Design の改善案から
ファーストビュー、ページ長、CTA、料金導線の優先度を整理する。

### 再現した不具合

- 本番 `https://akieguchi.com/service` の desktop 1440px で、ヒーロー左の縦写真が想定高さを超えて下の
  `Actual site` セクションまで突き抜け、見出し・本文・リンク文字の上に重なっていた。
- Playwright の DOM overlap 検査でも desktop で複数のテキスト/画像交差を検出。

### 修正内容

- `HeroShowcase` のグリッドを `overflow-hidden` / `h-full` / `min-h-0` / `grid-rows-3` で固定高さ内に閉じ込め、
  縦長画像の intrinsic size でセクション外へ伸びないようにした。
- ヒーロー内に「料金を見る」「実例を見る」の静かなCTAを追加。
- `For photographers` と `What you get` を2カラムのコンパクトな1セクションへ統合。
- `Pricing` を `Admin` 詳細より前に移動し、完成イメージ → 料金 → 詳細確認の順に読みやすくした。
- `pages.render.test.tsx` の public page smoke に `service` を追加。

### 触ったファイル

- `packages/web/src/web/pages/service.tsx`
- `packages/web/src/web/test/pages.render.test.tsx`
- `task.md`

### 検証

- `cd packages/web && bun x tsc -b` 成功。
- `cd packages/web && bun test ./src/web/test/pages.render.test.tsx` 成功（24 pass / 0 fail）。
- `cd packages/web && bun run build` 成功。
- `cd packages/web && bun test ./src` 成功（175 pass / 0 fail）。
- `git diff --check` 成功。
- `cd packages/web && bun run lint` は既存の `Lightbox.tsx` `jsx-a11y(prefer-tag-over-role)` で失敗。今回差分外。
- ローカル `http://127.0.0.1:5175/service` を Playwright で確認。
  - desktop 1440x1100 / tablet 768x1024 / mobile 390x1200。
  - テキストと画像の重なり検出 0。
  - 横スクロールなし。
  - Stripe Payment Link 2本の href 維持。

### 注意

- `chatgpt-handoff.md`、`claude-code-luxury-feel-prompt.md`、
  `packages/web/src/web/pages/service.tsx.handoff.md` は未追跡のまま。今回の対象外。

## 追記 2026-06-29 — Codex: Library媒体フィルター追加

### 目的

フィルム運用で、Digital / Film / 媒体未設定の写真をすぐ絞り込めるようにする。

### 修正内容

- Library フィルターに `媒体: All` select を追加。
- `filmType === "デジタル"` を Digital、その他の `filmType` 入力ありを Film、空を `媒体なし` として分類。
- フィルター状態の保持、`すべて解除`、stale 値正規化、並び替え保存ロックに媒体フィルターを接続。
- Admin render テストに媒体フィルター表示と stale `filterMedium` の正規化確認を追加。

### 検証

- `cd packages/web && bun x tsc -b` 成功。
- `bun test ./packages/web/src/web/test/pages.render.test.tsx` 成功（27 pass / 0 fail）。
- `cd packages/web && bun run build` 成功。
- `cd packages/web && bun test ./src` 成功（188 pass / 0 fail）。

### 注意

- `chatgpt-handoff.md`、`claude-code-luxury-feel-prompt.md`、
  `packages/web/src/web/pages/service.tsx.handoff.md` は未追跡のまま。今回の対象外。

## 追記 2026-06-29 — Codex: PhotoGalleryテストのact warning解消

### 目的

全体テストで毎回出ていた React `act(...)` warning を消し、今後のテスト失敗や新しい warning を見つけやすくする。

### 修正内容

- `PhotoGallery.render.test.tsx` の `root.unmount()` を `act()` で包むように変更。
- 対象テスト単体と全体テストで、既存の `act(...)` warning が出ないことを確認。

### 検証

- `bun test ./packages/web/src/web/components/PhotoGallery.render.test.tsx` 成功（4 pass / 0 fail、warningなし）。
- `cd packages/web && bun x tsc -b` 成功。
- `cd packages/web && bun run build` 成功。
- `cd packages/web && bun test ./src` 成功（188 pass / 0 fail、warningなし）。

### 注意

- `chatgpt-handoff.md`、`claude-code-luxury-feel-prompt.md`、
  `packages/web/src/web/pages/service.tsx.handoff.md` は未追跡のまま。今回の対象外。

## 追記 2026-06-29 — Codex: Library表示設定の正規化

### 目的

保存済みのサムネイルサイズやアップロード媒体設定が壊れた値になった時に、Library の表示崩れや Film/Digital 未選択状態を防ぐ。

### 修正内容

- `admin:thumbSize` が数値でない場合は `180`、範囲外の場合は range と同じ `80〜300` にクランプ。
- `admin:uploadMedium` が `digital` / `film` 以外の場合、`digital` に戻す。
- stale filter 回帰テストに `thumbSize=9999` と `uploadMedium="slide"` を追加。

### 検証

- `cd packages/web && bun x tsc -b` 成功。
- `bun test ./packages/web/src/web/test/pages.render.test.tsx` 成功（27 pass / 0 fail）。
- `cd packages/web && bun run build` 成功。
- `cd packages/web && bun test ./src` 成功（188 pass / 0 fail、既存のReact act warningは継続）。

### 注意

- `chatgpt-handoff.md`、`claude-code-luxury-feel-prompt.md`、
  `packages/web/src/web/pages/service.tsx.handoff.md` は未追跡のまま。今回の対象外。

## 追記 2026-06-29 — Codex: stale Libraryソート値の正規化

### 目的

古い/不正な `admin:librarySort` が sessionStorage に残った時に、存在しない並び替え状態のまま `この並びを保存` が出るリスクを防ぐ。

### 修正内容

- Library の保存済み表示ソート値が既知の選択肢に含まれない場合、`manual` へ戻す。
- stale filter 回帰テストに `admin:librarySort = "random-old"` を追加し、`manual` へ戻ることを確認。

### 検証

- `cd packages/web && bun x tsc -b` 成功。
- `bun test ./packages/web/src/web/test/pages.render.test.tsx` 成功（27 pass / 0 fail）。
- `cd packages/web && bun run build` 成功。
- `cd packages/web && bun test ./src` 成功（188 pass / 0 fail、既存のReact act warningは継続）。

### 注意

- `chatgpt-handoff.md`、`claude-code-luxury-feel-prompt.md`、
  `packages/web/src/web/pages/service.tsx.handoff.md` は未追跡のまま。今回の対象外。

## 追記 2026-06-29 — Codex: stale Libraryフィルター値の正規化

### 目的

Library フィルター状態を保持するようにしたことで、削除済みカテゴリや古い不正値が sessionStorage に残った場合に、写真一覧が空になったり並び替えがロックされたりするリスクを防ぐ。

### 修正内容

- 保存済みカテゴリが存在しない場合、カテゴリ/写真データの読み込み後に `all` へ戻す。
- 保存済みシリーズIDが取得済みシリーズ一覧に存在しない場合、`all` へ戻す。
- サイズ、向き、公開状態、最近追加フィルターが未知値だった場合、`all` へ戻す。
- 回帰テストとして、stale な `admin:filterCat` / `admin:filterSize` / `admin:filterPublished` が自動で `all` に戻ることを追加。

### 検証

- `cd packages/web && bun x tsc -b` 成功。
- `bun test ./packages/web/src/web/test/pages.render.test.tsx` 成功（27 pass / 0 fail）。
- `cd packages/web && bun run build` 成功。
- `cd packages/web && bun test ./src` 成功（188 pass / 0 fail、既存のReact act warningは継続）。

### 注意

- `chatgpt-handoff.md`、`claude-code-luxury-feel-prompt.md`、
  `packages/web/src/web/pages/service.tsx.handoff.md` は未追跡のまま。今回の対象外。

## 追記 2026-06-29 — Codex: stale Smart Albumフィルター解除

### 目的

Library フィルター状態を保持するようにしたことで、削除済み/存在しない Smart Album ID が残った場合に、見えないフィルターとして並び替えをロックするリスクを防ぐ。

### 修正内容

- `settingsData` 読み込み後、保存済み `activeAlbumId` が `smartAlbums` に存在しない場合は自動で `null` に戻す。
- 存在しない Smart Album 選択が残っても、Library が通常状態へ戻るようにした。

### 検証

- `cd packages/web && bun x tsc -b` 成功。
- `bun test ./packages/web/src/web/test/pages.render.test.tsx` 成功（26 pass / 0 fail）。
- `cd packages/web && bun run build` 成功。
- `cd packages/web && bun test ./src` 成功（187 pass / 0 fail、既存のReact act warningは継続）。

### 注意

- `chatgpt-handoff.md`、`claude-code-luxury-feel-prompt.md`、
  `packages/web/src/web/pages/service.tsx.handoff.md` は未追跡のまま。今回の対象外。

## 追記 2026-06-29 — Codex: Library検索でフィルム名を対象化

### 目的

フィルム写真の管理で、Kodak / Portra などのフィルム名から写真を探せるようにする。

### 修正内容

- Library のフリーテキスト検索対象に `filmType` を追加。
- 検索プレースホルダーを `検索（タイトル・機材・フィルム・ファイル名）` に更新。

### 検証

- `cd packages/web && bun x tsc -b` 成功。
- `bun test ./packages/web/src/web/test/pages.render.test.tsx` 成功（26 pass / 0 fail）。
- `cd packages/web && bun run build` 成功。
- `cd packages/web && bun test ./src` 成功（187 pass / 0 fail、既存のReact act warningは継続）。

### 注意

- `chatgpt-handoff.md`、`claude-code-luxury-feel-prompt.md`、
  `packages/web/src/web/pages/service.tsx.handoff.md` は未追跡のまま。今回の対象外。

## 追記 2026-06-29 — Codex: Libraryフィルター状態の保持

### 目的

admin で別タブへ移動したり開き直したりした時に、Library の検索・絞り込み状態が毎回消えないようにする。

### 修正内容

- Library の検索文字列、カテゴリ、シリーズ、サイズ、向き、Featured、公開状態、最近追加、日付なし、機材なし、Smart Album 選択を `sessionStorage` に保持。
- `すべて解除` はこれまで通り全フィルターを初期値へ戻し、保存された状態も更新される。
- 長期的に残って写真が見えない混乱を避けるため、保存先は `localStorage` ではなく作業セッション内の `sessionStorage` にした。

### 検証

- `cd packages/web && bun x tsc -b` 成功。
- `bun test ./packages/web/src/web/test/pages.render.test.tsx` 成功（26 pass / 0 fail）。
- `cd packages/web && bun run build` 成功。
- `cd packages/web && bun test ./src` 成功（187 pass / 0 fail、既存のReact act warningは継続）。

### 注意

- `chatgpt-handoff.md`、`claude-code-luxury-feel-prompt.md`、
  `packages/web/src/web/pages/service.tsx.handoff.md` は未追跡のまま。今回の対象外。

## 追記 2026-06-29 — Codex: Libraryスクロール保存の軽量化

### 目的

Library のスクロール位置保存で、スクロールイベントごとに同期的な localStorage 書き込みが走らないようにする。

### 修正内容

- スクロール位置保存を `requestAnimationFrame` でまとめるように変更。
- アンマウント時に未完了の rAF をキャンセル。
- 復元処理の挙動は維持し、保存頻度だけを軽くした。

### 検証

- `cd packages/web && bun x tsc -b` 成功。
- `bun test ./packages/web/src/web/test/pages.render.test.tsx` 成功（26 pass / 0 fail）。
- `cd packages/web && bun run build` 成功。
- `cd packages/web && bun test ./src` 成功（187 pass / 0 fail、既存のReact act warningは継続）。

### 注意

- `chatgpt-handoff.md`、`claude-code-luxury-feel-prompt.md`、
  `packages/web/src/web/pages/service.tsx.handoff.md` は未追跡のまま。今回の対象外。

## 追記 2026-06-29 — Codex: admin保存タブ値のフォールバック

### 目的

過去のタブ構成変更や壊れた localStorage により、admin が存在しないタブ値を復元して空画面になるリスクを防ぐ。

### 修正内容

- admin の有効タブ一覧を `ADMIN_TAB_KEYS` として定義。
- 保存済み `admin:tab` が未知の値だった場合、`gallery` に自動で戻す。
- 回帰テストとして、`localStorage.admin:tab = "old-tab"` でも Library が表示されることを確認。

### 検証

- `cd packages/web && bun x tsc -b` 成功。
- `bun test ./packages/web/src/web/test/pages.render.test.tsx` 成功（26 pass / 0 fail）。
- `cd packages/web && bun run build` 成功。
- `cd packages/web && bun test ./src` 成功（187 pass / 0 fail、既存のReact act warningは継続）。

### 注意

- `chatgpt-handoff.md`、`claude-code-luxury-feel-prompt.md`、
  `packages/web/src/web/pages/service.tsx.handoff.md` は未追跡のまま。今回の対象外。

## 追記 2026-06-29 — Codex: 管理画面Libraryのスクロール位置復元

### 目的

写真一覧を深い位置まで見ていたあとに admin を開き直しても、毎回先頭から探し直さなくて済むようにする。

### 修正内容

- Library のスクロール位置を `localStorage` の `admin:libraryScrollTop` に保存。
- 写真一覧が読み込まれたあと、保存済みスクロール位置へ1回だけ復元。
- 写真枚数や画面サイズが変わっても、最大スクロール位置を超えないようにクランプ。

### 検証

- `cd packages/web && bun x tsc -b` 成功。
- `bun test ./packages/web/src/web/test/pages.render.test.tsx` 成功（25 pass / 0 fail）。
- `cd packages/web && bun run build` 成功。
- `cd packages/web && bun test ./src` 成功（186 pass / 0 fail、既存のReact act warningは継続）。

### 注意

- `chatgpt-handoff.md`、`claude-code-luxury-feel-prompt.md`、
  `packages/web/src/web/pages/service.tsx.handoff.md` は未追跡のまま。今回の対象外。

## 追記 2026-06-29 — Codex: 管理画面の機材未入力フィルター

### 目的

フィルム写真などで EXIF から機材情報を入れない運用でも、あとからカメラ/レンズ未入力の写真を探しやすくする。

### 修正内容

- Library フィルターに `機材なし (N)` ボタンを追加。
- `camera` と `lens` がどちらも未入力の写真だけに絞り込めるようにした。
- `すべて解除` と並び替え保存ロックの判定にも、このフィルター状態を反映。
- Admin render テストに `機材なし` 表示確認を追加。

### 検証

- `bun test ./packages/web/src/web/test/pages.render.test.tsx` 成功（25 pass / 0 fail）。
- `cd packages/web && bun x tsc -b` 成功。
- `cd packages/web && bun run build` 成功。
- `cd packages/web && bun test ./src` 成功（186 pass / 0 fail、既存のReact act warningは継続）。

### 注意

- `chatgpt-handoff.md`、`claude-code-luxury-feel-prompt.md`、
  `packages/web/src/web/pages/service.tsx.handoff.md` は未追跡のまま。今回の対象外。

## 追記 2026-06-29 — Codex: 管理画面フィルター一括解除

### 目的

管理画面 Library の絞り込みを複数触ったあと、前の状態をひとつずつ戻さずに一覧へ復帰できるようにする。

### 修正内容

- Library ツールバーに、絞り込み中だけ表示される `すべて解除` ボタンを追加。
- 検索文字列、カテゴリ、シリーズ、サイズ、向き、Featured、公開状態、日付なし、最近追加、アルバム選択を一括で初期状態へ戻す。

### 検証

- `bun test ./packages/web/src/web/test/pages.render.test.tsx` 成功（25 pass / 0 fail）。
- `cd packages/web && bun x tsc -b` 成功。
- `cd packages/web && bun run build` 成功。
- `cd packages/web && bun test ./src` 成功（186 pass / 0 fail、既存のReact act warningは継続）。

### 注意

- `chatgpt-handoff.md`、`claude-code-luxury-feel-prompt.md`、
  `packages/web/src/web/pages/service.tsx.handoff.md` は未追跡のまま。今回の対象外。

## 追記 2026-06-28 — Codex: `/service` Claude Design 再改善

### 目的

Claude Design の追加レビューを受け、`/service` を「何のサービスか一瞬で伝わる」「選択肢が多すぎない」
販売ページへさらに整える。前回修正で残った表示崩れリスクもあわせて確認する。

### 確認した課題

- ファーストビューに「料金を見る」「実例を見る」に加えて、EXAMPLE / PRICING / ADMIN / AFTER の
  セクションリンクが並び、CTA の選択肢が多かった。
- ヒーロービジュアルが作品写真の直置きで、完成するポートフォリオサイトのイメージとしては伝わりにくかった。
- `FOR PHOTOGRAPHERS` と `WHAT YOU GET` の左右項目数が合わず、課題と解決の対応関係が読み取りにくかった。
- `ADMIN` と `AFTER PURCHASE` が別セクションで、購入後の流れとしてはやや散っていた。
- 固定バーの `Plans` 表記が曖昧だった。

### 修正内容

- ヒーローのセクションリンクを削除し、CTA を「料金を見る」「実例を見る」の2つに整理。
- ヒーロー写真グリッドを、ブラウザウィンドウ風の「サイトプレビュー」へ変更。大きい写真は `mediumUrl` を優先。
- 実例セクションを、各ページへのテキストリンクだけでなく写真サムネイル付きの行に変更。
- `FOR PHOTOGRAPHERS` を `Need` / `Site` の対応表にして、3つの課題と3つの解決を横並びで読めるようにした。
- `ADMIN` と `AFTER PURCHASE` を `PurchaseDetails` に統合し、料金直下で「購入後の流れと管理画面」を開閉できるようにした。
- 実例下の「料金を見る」は塗りボタンに変更。
- 固定バーの `Plans` を「料金を見る」に変更し、初期表示では隠れ、ファーストビューを少し抜けると表示されるスクロール連動へ変更。

### 触ったファイル

- `packages/web/src/web/pages/service.tsx`
- `task.md`

### 検証

- `cd packages/web && bun x tsc -b` 成功。
- `cd packages/web && bun test ./src/web/test/pages.render.test.tsx` 成功（24 pass / 0 fail）。
- `cd packages/web && bun run build` 成功。
- `cd packages/web && bun test ./src` 成功（175 pass / 0 fail）。
- `git diff --check` 成功。
- `cd packages/web && bun run lint` は既存の `packages/web/src/web/components/Lightbox.tsx:1195`
  `jsx-a11y(prefer-tag-over-role)` で失敗。今回差分外。

### ブラウザ確認

- ローカル `http://127.0.0.1:5175/service` を Playwright で確認。
- Desktop 1440x1100 / Tablet 768x1024 / Mobile 390x1200。
- 初期表示で固定バー非表示、少しスクロール後に表示。
- 横スクロールなし。
- 初期表示のテキストと画像の重なり検出 0。
- console error なし。
- Stripe Payment Link 2本は既存 URL を維持。

### Codex レビュー

- 価格、Stripe URL、routing、settings、DB、OGP、sitemap は変更していないため agmsg レビューなし。

### 注意

- `chatgpt-handoff.md`、`claude-code-luxury-feel-prompt.md`、
  `packages/web/src/web/pages/service.tsx.handoff.md` は未追跡のまま。今回の対象外。
- commit hash は commit 作成後の最終報告に記載する。

## 追記 2026-06-28 — Codex: X/SNSカードのヒーロー写真表示を安定化

### 目的

X に `akieguchi.com` を貼った時、カード画像に HERO 写真が表示されずプレースホルダになる問題を直す。
あわせて配布版テンプレートにも同じ OGP 安定化を反映する。

### 本番で確認した事象

- 本番 HTML の `og:image` / `twitter:image` は HERO 写真を指していた。
- ただし URL は `/api/images/... ?w=1200&q=85` の動的変換画像で、実画像は 1200x960。
- `HEAD` では `content-length: 0` になっており、SNS クローラの事前確認で画像なし扱いになる可能性があった。

### 修正内容

- OGP/SNS 用の HERO 画像 URL を `1200x630` 固定の JPEG 変換に変更。
  - `w=1200&h=630&q=90&fmt=jpeg`
  - 回転指定 `rot` も維持。
- `og:image:secure_url`、`og:image:type`、`twitter:image:alt` を追加。
- HERO / profile 写真がない配布版の空サイトでも、`/og-image.jpg` を絶対 URL の OGP 画像として注入するようにした。
- 画像 API に `h` パラメータを追加し、`w+h` 指定時は `cover` で SNS 用比率に整えるようにした。
- `/api/images/*` を `GET` / `HEAD` 対応にし、`HEAD` でも実バイト長の `Content-Length` を返すようにした。

### 触ったファイル

- `packages/web/index.html`
- `packages/web/src/api/index.ts`
- `packages/web/src/api/ogp.ts`
- `packages/web/src/api/ogp.test.ts`
- `packages/web/src/api/security.ts`
- `packages/web/src/api/security.test.ts`
- `packages/web/src/api/static-template.test.ts`
- `packages/web/src/shared/image-url.ts`
- `packages/web/src/shared/image-url.test.ts`
- `task.md`

### 検証

- `cd packages/web && bun test ./src/api/security.test.ts ./src/api/ogp.test.ts ./src/api/static-template.test.ts ./src/shared/image-url.test.ts` 成功（79 pass / 0 fail）。
- `cd packages/web && bun x tsc -b` 成功。
- `cd packages/web && bun test ./src` 成功（178 pass / 0 fail）。
- `cd packages/web && bun run build` 成功。
- `git diff --check` 成功。
- ローカル本番サーバを実 DB/R2 付きで起動する検証は、起動時マイグレーションが実 DB に触れ得るため自動承認で停止。push 後に本番の `og:image` と画像ヘッダーで確認する。

### 注意

- 既に X に投稿済みの URL カードは X 側のキャッシュに残る場合がある。修正は新規投稿・再クロール後の表示改善が主目的。
- `chatgpt-handoff.md`、`claude-code-luxury-feel-prompt.md`、
  `packages/web/src/web/pages/service.tsx.handoff.md` は未追跡のまま。今回の対象外。

## 追記 2026-06-28 — Codex: `/service` 誤解されにくい販売文言へ調整

### 目的

価格は維持したまま、テンプレート販売・初期設定代行として誤解されにくい文言に整える。
特に「あなただけの」「ずっと無料」「月額なし」の強すぎる表現を避け、サポート範囲と外部費用を明確にする。

### 修正内容

- ヒーローコピーを「写真が主役になる、静かなポートフォリオサイト」に変更し、モバイルでも単語途中で割れない2行表示にした。
- `ACTUAL SITE` を「今見ているこのサイトが、公開後の見え方の実例です。」へ変更。
- `こんな悩み / このサイトなら` の本文をなめらかにし、自由度を広く誤解させる「見た目を調整」表現を削除。
- 料金カードの `RECOMMENDED` を `公開おまかせ`（¥30,000）側へ移動。
- `おまかせ設定` を `公開おまかせ` に変更。
- `ずっと無料`、`月額なし`、`困ったときは相談OK` を削除し、初回相談・公開後7日間の簡単な操作相談に範囲を明確化。
- 料金下の注意書きを、外部費用と個別カスタムの別途見積もりが分かる内容に変更。
- FAQ を、購入後の流れ、独自ドメイン、外部費用、更新範囲が伝わる回答に更新。

### 触ったファイル

- `packages/web/src/web/pages/service.tsx`
- `task.md`

### 検証

- `cd packages/web && bun x tsc -b` 成功。
- `cd packages/web && bun test ./src/web/test/pages.render.test.tsx` 成功（24 pass / 0 fail）。
- `cd packages/web && bun run build` 成功。
- `cd packages/web && bun test ./src` 成功（175 pass / 0 fail）。
- `git diff --check` 成功。
- `cd packages/web && bun run lint` は既存の `packages/web/src/web/components/Lightbox.tsx:1195`
  `jsx-a11y(prefer-tag-over-role)` で失敗。今回差分外。
- ローカル `http://127.0.0.1:5175/service` を Playwright で確認。
  - Desktop 1440x1100 / Mobile 390x1200。
  - `RECOMMENDED` が `公開おまかせ` 側に移動していることを確認。
  - `あなただけの` / `ずっと無料` / `月額なし` / `おまかせ設定` が消えていることを確認。
  - Stripe Payment Link 2本は既存 URL を維持。
  - 横スクロールなし。
  - 初期表示のテキストと画像の重なり検出 0。
  - console error なし。

### 注意

- `chatgpt-handoff.md`、`claude-code-luxury-feel-prompt.md`、
  `packages/web/src/web/pages/service.tsx.handoff.md` は未追跡のまま。今回の対象外。
- commit hash は commit 作成後の最終報告に記載する。

## 追記 2026-06-28 — Codex: `/service` コピー微調整

### 目的

Claude Design の最終レビューを受け、構成は維持したまま、説明的すぎる文言を写真家向けに少し近い言葉へ寄せる。

### 修正内容

- `ACTUAL SITE` の説明文を短くし、「このサイト自体が実例です。Gallery・About・Contact をそのまま確認できます。」へ変更。
- `FOR PHOTOGRAPHERS` 内の `Need` / `Site` ラベルを `こんな悩み` / `このサイトなら` に変更。
- `AFTER PURCHASE` の見出しを「購入後の流れ。」に絞り、本文をネガティブ始まりから「確認後、選んだプランに合わせて案内を送ります。」始まりに変更。
- ヒーローのブラウザモックアップと `ACTUAL SITE` の間隔を少し詰めた。

### 触ったファイル

- `packages/web/src/web/pages/service.tsx`
- `task.md`

### 検証

- `cd packages/web && bun x tsc -b` 成功。
- `cd packages/web && bun test ./src/web/test/pages.render.test.tsx` 成功（24 pass / 0 fail）。
- `cd packages/web && bun run build` 成功。
- `cd packages/web && bun test ./src` 成功（175 pass / 0 fail）。
- `git diff --check` 成功。
- `cd packages/web && bun run lint` は既存の `packages/web/src/web/components/Lightbox.tsx:1195`
  `jsx-a11y(prefer-tag-over-role)` で失敗。今回差分外。
- ローカル `http://127.0.0.1:5175/service` を Playwright で確認。
  - Desktop 1440x1100 / Mobile 390x1200。
  - 変更文言が反映され、古い「決済後すぐに自動発行」文言が消えていることを確認。
  - 横スクロールなし。
  - 初期表示のテキストと画像の重なり検出 0。
  - console error なし。

### 注意

- `chatgpt-handoff.md`、`claude-code-luxury-feel-prompt.md`、
  `packages/web/src/web/pages/service.tsx.handoff.md` は未追跡のまま。今回の対象外。
- commit hash は commit 作成後の最終報告に記載する。

## 追記 2026-06-28 — Codex: Railway一時クラッシュ後の画像変換安定化

### 目的

Railway の "Application failed to respond" が出た件について、再起動後の本番状態を確認し、直近の OGP 画像変更に伴う画像変換負荷の再発リスクを下げる。

### 調査結果

- 本番 `https://akieguchi.com/` と `/api/health` は再起動後 200。確認時の `X-Build` / health build は `886ae682`。
- 実OG画像URLへの `GET` と `HEAD` を同時に投げると、修正前の本番では両方 `X-Cache: MISS` になり、RSS が約177MBから約472MBまで急増した。
- 原因候補は、SNS/Instagram系クローラーが同じOG画像へ `HEAD` / `GET` を近接または同時に送り、同一の sharp 変換が複数回走ること。Railway CLI はこのMacに無く、クラッシュ時ログは未取得。

### 修正内容

- `packages/web/src/api/index.ts` の画像プロキシで、同じ `cacheKey` の変換中 Promise を `resizeInFlight` に集約。
- 変換中の同一リクエストは新しい sharp 変換を起動せず、既存の結果を待って `X-Cache: WAIT` として返すようにした。
- sharp 変換の同時実行数を `IMAGE_TRANSFORM_CONCURRENCY`（既定2、1〜4にクランプ）で制限。
- `/api/health` に `resizeInFlightEntries` / `activeImageTransforms` / `queuedImageTransforms` を追加し、再発時に状態を見られるようにした。

### 検証

- `cd packages/web && bun x tsc -b` 成功。
- `cd packages/web && bun test ./src/api/security.test.ts ./src/api/ogp.test.ts ./src/shared/image-url.test.ts` 成功（78 pass / 0 fail）。
- `cd packages/web && bun run build` 成功。
- ローカル本番サーバ `PORT=4317 bun --env-file=../../.env src/server.ts` で実R2画像のOG URLを確認。
  - 同時 `GET` / `HEAD`: 片方 `X-Cache: MISS`、片方 `X-Cache: WAIT`、RSS 約211MB。
  - 同一URL 6本同時: 1本 `MISS`、5本 `WAIT`、RSS 約212MB。
- `cd packages/web && bun test ./src` 成功（178 pass / 0 fail）。

### 注意

- `chatgpt-handoff.md`、`claude-code-luxury-feel-prompt.md`、
  `packages/web/src/web/pages/service.tsx.handoff.md` は未追跡のまま。今回の対象外。
- Railway のクラッシュ時ログは未取得のため、これはログ確定ではなく、再現性のある負荷兆候に基づく対策。

## 追記 2026-06-28 — Codex: Google Analyticsタグ復旧

### 目的

Google Analytics にアクセスが表示されない件を確認し、本番HTMLから消えていたGA4タグを復旧する。

### 調査結果

- 本番 `https://akieguchi.com/` のHTMLに `gtag` / `googletagmanager` / `G-NKECCDLXYD` が出ていなかった。
- `packages/web/src/api/ogp.ts` は `gaMeasurementIdForSite(siteUrl)` が値を返す場合のみGA4タグを注入する。
- `packages/web/src/api/site-defaults.ts` は `GA_MEASUREMENT_ID` 環境変数だけを見る実装になっており、`task.md` に残っていた `akieguchi.com` 用 fallback 方針とズレていた。
- 既存のGA4 Measurement ID は過去ログ通り `G-NKECCDLXYD`。

### 修正内容

- `GA_MEASUREMENT_ID` が未設定で、site URL が `https://akieguchi.com` の場合だけ `G-NKECCDLXYD` へfallbackするように復旧。
- 明示的に `GA_MEASUREMENT_ID=""` を入れたテンプレート環境ではGAを無効化できる挙動を維持。
- `site-defaults.test.ts` に akieguchi.com fallback のテストを追加。

### 検証

- `cd packages/web && bun x tsc -b` 成功。
- `cd packages/web && bun test ./src/api/site-defaults.test.ts ./src/api/ogp.test.ts ./src/api/static-template.test.ts` 成功（40 pass / 0 fail）。
- `cd packages/web && bun run build` 成功。

### 注意

- 反映後に本番HTMLへ `https://www.googletagmanager.com/gtag/js?id=G-NKECCDLXYD` が戻っていることを確認する。
- GA画面への反映はリアルタイムでも遅延やフィルタの影響を受ける場合がある。

## 追記 2026-06-28 — Codex: 本番全体デバッグ2周と画像in-flight詰まり対策

### 目的

GA復旧・Railway OOM対策を含めて、本番サイト全体を2周デバッグし、再発リスクが残っている箇所を潰す。

### 1周目: 本番実動作チェック

- `https://akieguchi.com/` は `200`、`X-Build: 7ac0d6c7`。
- 本番HTMLにGA4タグ `G-NKECCDLXYD` が出ていることを確認。
- 主要ルート `/` / `/gallery` / `/series` / `/about` / `/profile` / `/contact` / `/service` / `/admin/login` / `/admin` はすべて `200`。
- API `/api/health` / `/api/settings` / `/api/photos` / `/api/hero-photos` / `/api/categories` / `/api/series` は `200`。
- `/api/admin/me` は未ログインで `{"authenticated":false}`。
- `/api/photos?all=1` は未ログインでも `200` だが、コード上はadminでない場合 `all` flagを無視し、実レスポンスも未公開0・削除0で公開一覧と同じだった。
- HTML参照アセット5件はすべて `200`。
- OGP画像とhero preload画像は `HEAD` / `GET` とも `200`、`Content-Length` あり。HEAD後のGETは `X-Cache: HIT`。
- Playwright mobileで `/` / `/gallery` / `/series` / `/about` / `/contact` / `/service` を確認。横スクロールなし、GAタグあり。

### 2周目: 再発リスク確認

- Playwright連続ページ移動時に、ブラウザが遅延画像を `ERR_ABORTED` するケースを確認。
- その後、本番healthで `activeImageTransforms=0` / `queuedImageTransforms=0` なのに `resizeInFlightEntries` が残る状態を確認。
- 画像自体は直接GETで `200`。破損ではなく、R2元画像取得またはvariant生成Promiseがタイムアウトなしで残るリスクと判断。

### 修正内容

- 画像変換の既定同時実行数を `2` から `1` に下げた。
  - 必要なら `IMAGE_TRANSFORM_CONCURRENCY=2` などで戻せる。
- R2元画像取得に `15s` timeoutを追加。
- 画像variant生成に `30s` timeoutを追加。
- 変換待ちキューをリクエストabortで取り除けるようにした。
- 同じvariantを待っているリクエストもabort時に待ち続けないようにした。
- `/api/health` に `origInFlightEntries` を追加。

### 検証

- `cd packages/web && bun x tsc -b` 成功。
- `cd packages/web && bun test ./src/api/security.test.ts ./src/api/ogp.test.ts ./src/api/site-defaults.test.ts ./src/shared/image-url.test.ts` 成功（86 pass / 0 fail）。
- `cd packages/web && bun run build` 成功。
- `cd packages/web && bun test ./src` 成功（179 pass / 0 fail）。
- `bunx oxlint packages/web/src/api/index.ts --deny-warnings --no-error-on-unmatched-pattern` をrepo rootから実行し成功。
- ローカル本番サーバ `PORT=4321 bun --env-file=../../.env src/server.ts` で確認。
  - OGP画像GET `200`。
  - Playwright連続ページ移動後も `resizeInFlightEntries=0` / `activeImageTransforms=0` / `queuedImageTransforms=0` に収束。

### 注意

- `chatgpt-handoff.md`、`claude-code-luxury-feel-prompt.md`、
  `packages/web/src/web/pages/service.tsx.handoff.md` は未追跡のまま。今回の対象外。
- 既存のReact test warning（`act(...)`）は出るが、テスト自体は成功。今回の対象外。

## 追記 2026-06-28 — Codex: 軽量化デバッグと不要API取得削減

### 目的

最適化・軽量化・無駄削減の観点で本番ネットワークとコードを確認し、不要なAPI取得を減らす。

### 調査結果

- 直接fetchでの本番APIサイズ:
  - `/api/settings`: 4,831 bytes
  - `/api/photos`: 348,666 bytes / 444 photos
  - `/api/hero-photos`: 1,570 bytes
  - `/api/categories`: 240 bytes
  - `/api/series`: 577 bytes
- Playwrightで初期表示ネットワークを確認したところ、`main.tsx` の全ページ共通prefetchにより、`/contact` など写真不要ページでも `/api/photos` 全量を取得していた。
- `/service` もプレビュー用に数枚しか使わないのに `/api/photos` 全量を取得していた。
- `/gallery` と `/` は写真一覧が実機能に必要なので全量取得を維持。

### 修正内容

- `main.tsx` のグローバルprefetchを削減。
  - `/api/photos` は初期URLが `/` または `/gallery` の時だけprefetch。
  - `/api/hero-photos` は初期URLが `/` の時だけprefetch。
  - `/api/categories` は初期URLが `/gallery` の時だけprefetch。
- `/api/photos?limit=N` を追加。既存の `/api/photos` デフォルト挙動は維持。
  - 公開側limitは最大60。
  - admin `all=1` 併用時は最大1000。
- `/service` は `queryKey: ["photos", "service-preview"]` で `/api/photos?limit=8` を使うように変更。

### ローカル本番サーバでの確認

- `PORT=4322 bun --env-file=../../.env src/server.ts` で確認。
- `/contact` 初期表示:
  - 変更後: `/api/settings` / `/api/series` / `/api/pricing` のみ。
  - `/api/photos` は消えた。
- `/service` 初期表示:
  - 変更後: `/api/photos?limit=8`。
  - payload: 7,020 bytes。
  - 全量 `/api/photos`: 348,666 bytes。
- `/gallery` 初期表示:
  - `/api/settings` / `/api/categories` / `/api/photos` / `/api/series`。
  - 写真一覧ページなので全量取得を維持。

### 検証

- `cd packages/web && bun x tsc -b` 成功。
- `cd packages/web && bun run build` 成功。
- `cd packages/web && bun test ./src/web/test/pages.render.test.tsx` 成功（24 pass / 0 fail）。
- `cd packages/web && bun test ./src` 成功（179 pass / 0 fail）。
- `bunx oxlint packages/web/src/api/index.ts packages/web/src/web/main.tsx packages/web/src/web/pages/service.tsx --deny-warnings --no-error-on-unmatched-pattern` をrepo rootから実行し成功。
- `git diff --check` 成功。

### 注意

- TopページはWorks/Lightbox/無限スクロールのため全量写真データをまだ使う。ここをさらに削るには、ページングAPIとTop/Galleryの追加読込設計が必要。
- `chatgpt-handoff.md`、`claude-code-luxury-feel-prompt.md`、
  `packages/web/src/web/pages/service.tsx.handoff.md` は未追跡のまま。今回の対象外。

## 追記 2026-06-28 — Codex: TOPランダム写真の白い待ち時間削減

### 目的

TOPを開いた時に、ランダム写真の読み込み待ちで白い時間が長くなる問題を改善する。

### 調査結果

- 本番設定は `heroMode=quiet-grid` / `topWorksMode=random` / `homeGalleryCount=12`。
- TOPのランダムWorksは、従来 `/api/photos` 全量（348,666 bytes / 444 photos）を取得してからクライアントでシャッフルしていた。
- HTML側では `/` にもギャラリー先頭8枚のpreloadが入っており、random Worksでは実際に表示されない写真を先に読み始める可能性があった。
- ヒーロー画像は `/api/images/photos/...w=1536` の変換画像を待っており、生成済み `mediumUrl` を使っていなかった。
- `quiet-grid` TOP専用Worksは `PhotoGallery` のLQIP経路を使わず、ランダムに選ばれた写真を `/api/images/photos/...w=800` で一斉に変換していた。

### 修正内容

- `/api/photos?order=random&limit=N` を追加。
  - `limit` 付きの時だけ `random()` 並びを許可し、全件ランダム取得は避ける。
- TOPでは `topWorksMode=random` の場合、`/api/photos?limit=48&order=random` を使うように変更。
  - 従来の全量348,666 bytesから、ローカル実測で37,788 bytesへ削減。
  - `main.tsx` の `/` 向け全量photos prefetchも停止。
- ヒーロー画像は生成済み `mediumUrl` がある場合、それを優先して表示。
- OGP/HTMLのTOPヒーローpreloadも `medium` URLに合わせ、二重ダウンロードを回避。
- `/` で `topWorksMode=random` の時は、ギャラリー先頭8枚のgrid preloadを出さない。
- `HomeQuietGrid` / `HomeEditorial` / `HomeImmersive` のTOP専用Works画像も、`thumbUrl` / `mediumUrl` を優先。
  - 現行本番設定の `quiet-grid` では初期画像リクエストが `thumbs/` 中心になることを確認。
- 回帰テストを追加: TOP random Worksが `/api/photos?limit=48&order=random` を使い、全量 `/api/photos` に戻らないことを検証。

### ローカル本番確認

- `PORT=4323 bun --env-file=../../.env src/server.ts` で確認。
- `/` HTML:
  - ヒーローpreloadは `/api/images/medium/1781326511791-_AK17487.webp`。
  - random時の不要なgrid preloadは出ていない。
- `/api/photos?limit=48&order=random`: 37,788 bytes。
- `/api/photos`: 348,666 bytes。
- Playwright mobile TOP:
  - APIは `/api/photos?limit=48&order=random`。
  - ヒーローは `/api/images/medium/...webp`。
  - Works初期画像は `/api/images/thumbs/...webp` 中心。
  - first visible image は complete=true / naturalWidth=1920。

### 検証

- `cd packages/web && bun x tsc -b` 成功。
- `cd packages/web && bun test ./src/web/test/pages.render.test.tsx` 成功（25 pass / 0 fail）。
- `cd packages/web && bun test ./src/api/ogp.test.ts ./src/api/security.test.ts` 成功（73 pass / 0 fail）。
- `cd packages/web && bun test ./src` 成功（180 pass / 0 fail、既存のReact act warningは継続）。
- `cd packages/web && bun run build` 成功。
- `bunx oxlint packages/web/src/api/index.ts packages/web/src/api/ogp.ts packages/web/src/server.ts packages/web/src/web/main.tsx packages/web/src/web/pages/top.tsx packages/web/src/web/test/pages.render.test.tsx --deny-warnings --no-error-on-unmatched-pattern` 成功。
- `git diff --check` 成功。

### 注意

- `topWorksMode=random` は初期ランダム候補を48件に制限する。TOPで全444件を延々スクロールするより初期表示速度を優先した判断。
- 全件閲覧は `/gallery` が担当する。
- `chatgpt-handoff.md`、`claude-code-luxury-feel-prompt.md`、
  `packages/web/src/web/pages/service.tsx.handoff.md` は未追跡のまま。今回の対象外。
