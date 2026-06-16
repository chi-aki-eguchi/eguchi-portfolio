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
