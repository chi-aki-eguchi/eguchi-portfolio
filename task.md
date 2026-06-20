# Task Log

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
  - `scripts/deploy.sh`: **1ビルド=1タイムスタンプを自動付与**。`BUILD_TAG=$(date +%Y%m%d-%H%M%S)` を生成→ `ogp.ts` の BUILD_ID をその値に置換（BSD/GNU 両対応の temp 経由 sed）→ `BUILD_TAG=… bun run build` で全資産名に注入→ **資産名にタグが入ったか検証**（無ければ ZIP 更新せず exit）。スモークに **X-Build==BUILD_TAG 検証 + HTML 参照 /assets/*.js|css を全て200検証**（白画面の直接原因を出荷前に検出）を追加。末尾に **Publish 後の本番チェック手順**（x-build / cf-cache-status / gzip汚染）を表示。
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
