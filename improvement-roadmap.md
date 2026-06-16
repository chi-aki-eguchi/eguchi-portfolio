# akieguchi.com 改善ロードマップ（自走ループ用・生きたドキュメント）

> Claude が継続モードで育てる作業台帳。毎サイクルここを更新し、安全な実装ギャップを潰し、
> 「秋さん待ち（content/外部アカウント）」と「実装キュー」を分けて管理する。
> 原則（2026-06-15 改定・`refine-and-loop-spec.md` T0）: **毎サイクル安全な1件を実装＋デプロイZIP更新。「変更なし」報告は避ける。** 起動はクレジットリセット駆動（固定時刻cron不可）。
> 大きい/risky な変更（要相談）は `proposals/` に企画書として蓄積し承認後に実装。安全・小は即実装。

## 企画書インデックス（proposals/）
- [#01 モバイル縮小率 `--mobile-scale`（A4）](proposals/01-mobile-scale.md) — 提案・承認待ち
- [#02 依頼導線／コンバージョン設計](proposals/02-inquiry-funnel.md) — **最優先・admin設定だけで点火可**
- [#03 ソーシャル成長 & リーチ拡大（X/IG/note）](proposals/03-social-reach.md) — 運用戦略
- [#04 マネタイズ設計](proposals/04-monetization.md) — 収益源7マップ＋着手順（受注→プリント→有料note/プリセット）
- [#05 画像SEO／alt運用](proposals/05-image-seo-alt.md) — 写真ごとtitleが alt/sitemap/caption の3箇所に波及する単一レバー
- [#06 Instagram運用プレイブック](proposals/06-instagram-playbook.md) — グリッド設計/リール/カルーセル→サイト誘導の実務
- [#07 メール購読／再訪設計](proposals/07-email-retention.md) — 自前リスト。外部サービス埋め込み推奨・送る意思が前提
- [#08 シリーズ物語化／編集設計](proposals/08-series-storytelling.md) — 器は実装済。statement/表紙/S・M・L/並びで“小さな写真集”に
- [#09 モダン化（2026最適化）](proposals/09-modernization.md) — **AVIF/WebP配信(実装済・要フラグON検証 -77%)** ＋ focus-visible強化(実装済) ＋ 残り提案

## 秋さんの判断待ち（各企画の確認事項・ここが進まないと先に進めない）
- **最優先・コード不要で今日効く**: #02 依頼導線の点火（CTA on / 撮影メニュー・目安料金・返信目安 / **formspree死活確認**）、#05 写真にtitle付与、#08 代表シリーズのstatement。
- **方針決め**: #01 モバイル縮小の既定値・方式、#03 SNS主軸、#04 やる収益源、#07 ニュースレターを送る意思の有無。
- **承認で実装企画化**: #05-B(alt/caption小コード)、#07-A(購読欄)。

最終更新: 2026-06-15（cycle 13・緊急）

---

## 結論（現状認識）
技術土台は**かなり強い**。監査49件 → 実バグ1件（修正済）。以下は調査で「既に実装済み」と確認:
GA4計測 / LQIP / JSON-LD(Person+ImageGallery+sameAs) / ページ別og:image / LCPヒーローpreload /
画像サイトマップ213 / 404 catch-all / 問い合わせフォールバック(email/SNS) + honeypot /
グローバル prefers-reduced-motion リセット / gzip撤去(真っ白対策) / canonical新ドメイン統一。

→ **伸びしろは「コードを足す」より「中身・発見・転換」**。私が自走で安全に出来る実装ギャップは限られる。

---

## A. 秋さん待ち（一番効く・私には出来ない / content・外部アカウント）
- [ ] **問い合わせ手段が本番で生きているか確認** — `formspreeUrl` か `contactEmail` のどちらかがDBに入っていないと contact が「準備中です。」表示。最優先で実機確認。
- [ ] **About ステートメント**（`profileStatement` 空）— 何を/なぜ撮るか。器は実装済み、文章だけ。
- [ ] **各シリーズの statement**（写真集の序文）— 1シリーズ2〜3文。
- [ ] **依頼導線**（`料金プラン`空 / `homeCtaEnabled` off）— 撮影内容・目安料金・返信目安。トップCTA on。
- [ ] **Search Console に sitemap 送信** — 画像213件が画像検索の入口に。
- [ ] **各写真の alt/meta を作品説明に** — admin の meta 運用。"Photograph" フォールバックでは画像SEO無価値。
- [ ] **note(Journal)定期更新** — RSS連携済み。更新が「生きてるサイト」シグナル。

## B. 実装キュー（私が自走で進める・優先度順）
- [ ] **A4 モバイル縮小 `--mobile-scale`**（未実装確認済）— ヒーロー名等がスマホではみ出す潜在リスク。
      要: settings-preview台帳 / API default / provider DB適用 / provider preview適用 / styles.css の @media calc / admin UI（4箇所同期+UI）。**やや大きいので着手前に秋さんへ一言。**
- [ ] **本物の blur-up LQIP** — 今は色ベタ枠。アップロード時に極小サムネ生成→ぼかしフェード。upload+serving に触るため中規模。
- [x] ~~ライトボックスに撮影情報(EXIF)~~ — **既に実装済み**（Lightbox.tsx:525 が camera·lens·filmType を表示。スキーマに camera/lens/filmType/shotAt あり、uploadでEXIF DateTimeOriginal→shotAt 取込済み D3/U2）。
- [ ] **撮影日(shotAt)をライトボックスに出すか（要相談・美的判断）** — データはあるが未表示。design-spec の timeless 志向と相談。出すなら年 or YYYY.MM の控えめ表示。**秋さん判断待ち**。
- [ ] **alt フォールバック改善（小）** — per-photo alt が無い時の既定を category 等で少しマシに（過度な重複altは避ける）。価値は限定的。
- [ ] **nav/footer/sns opacity の死にfallback整理（小・任意）** — :root が常勝なので視覚影響なし。一貫性のための掃除。

## C. 構想（大きめ・要相談）
- [ ] 言語切替（日/英）— About英語だけでも海外露出。
- [ ] シリーズの「物語化」を主役に。
- [ ] プリント/受注導線の強化（`printEnabled` 活用）。

## D. 調査で「既に良い」と確認（再着手不要）
404 / 問い合わせフォールバック / honeypot / reduced-motion / LQIPクラス / JSON-LD / og:image切替 /
LCP preload / 画像サイトマップ / GA4 / gzip撤去 / canonical統一。

---

## 変更ログ
- cycle 1 (06-14): TopWorks 重複ID dedupe 修正（top.tsx:269）。本ロードマップ作成。
  404・contact・reduced-motion は既実装と確認しアイデアから除外。
- cycle 2 (06-14): EXIF表示は既実装と確認（camera/lens/filmType、スキーマD3/U2 完備）→除外。
  **気づき: 思いつく機能のほぼ全てが実装済み。安全な自走コード改善は僅少。**
  → ループの主軸を「実装」から「深い分析＋承認待ち仕様（A項目の後押し / 大きめB の precise spec）」へ。
  次サイクル: 画像SEO（alt運用）と LCP/配信 を実測ベースで分析、または A4モバイル縮小の実装仕様を起こす。
- cycle 3 (06-14): **ルール変更（秋さん）— 実装せず企画書だけ / 間隔は約10分。**
  企画書 #01「モバイル縮小率 `--mobile-scale`」起案（proposals/01-mobile-scale.md・承認待ち）。
  次サイクル: 企画書 #02 候補 = 「依頼導線/コンバージョン設計」 or 「画像SEO（alt運用）」。
- cycle 4 (06-14): 企画書 #02「依頼導線/コンバージョン設計」起案（仕組みは実装済・点火は admin設定だけ）。
  秋さん追加依頼: **SNS(X/IG/note)成長・サイトのリーチ・マネタイズも考える**。
  → 企画書 #03「ソーシャル成長&リーチ拡大」起案。次サイクルで #04「マネタイズ設計」を起案。
- cycle 5 (06-14): 企画書 #04「マネタイズ設計」起案。秋さんの3テーマ（成長/リーチ/マネタイズ）+ サイト改善は
  企画書 #01〜#04 で一巡カバー。次サイクル以降の候補（より細かい・深掘り）:
  #05 画像SEO/alt運用（#B・一部コード）, #06 Instagram運用プレイブック, #07 メール購読/再訪設計,
  #08 シリーズ「物語化」編集設計。**実装はしない方針は継続。** 議題が薄くなったら間隔を延ばす。
- cycle 6 (06-14): 企画書 #05「画像SEO/alt運用」起案。核心: 写真ごとの title が alt/画像sitemap/captionの
  3箇所に波及する単一レバー（content とSEOが一致）。次サイクル: #06 Instagram運用プレイブック。
- cycle 7 (06-14): 企画書 #06「Instagram運用プレイブック」起案。次サイクル: #07 メール購読/再訪設計。
  残り候補が細粒度化してきた。#07・#08 まで出したら**間隔を延ばす/一旦まとめる**判断をする。
- cycle 8 (06-14): 企画書 #07「メール購読/再訪設計」起案（送る意思が前提・案A外部サービス推奨）。
  次サイクル: #08 シリーズ「物語化」編集設計（これで主要テーマ網羅）。**#08 後は間隔を 25-30分 に延長**し、
  秋さんの返答待ち/新規依頼を待つモードへ（薄い企画の量産を避ける）。
- cycle 9 (06-14): 企画書 #08「シリーズ物語化」起案。**主要テーマ(#01-08)を網羅し一巡完了。**
  これ以上の新規企画は細粒度で価値が薄まるため、**間隔を 30分に延長**し秋さんの判断待ちモードへ。
  判断事項を roadmap 上部に集約。1度だけ通知を送る（8企画 ready・全て要判断）。
  以降の tick は「新依頼が来ていないか確認 → 無ければ静かに再予約」を基本に。
- cycle 10 (06-15): **運用方針を改定（秋さん・`refine-and-loop-spec.md` T0）— 「企画書のみ」を終了し、毎サイクル安全な1件を実装＋ZIP更新する運用に戻す。起動はクレジットリセット駆動（固定時刻cron不可）。**
  実装: **WebSite JSON-LD ノード追加**（`ogp.ts` buildJsonLd）。@graph に Person/ImageGallery と並ぶ WebSite（url / name / alternateName / inLanguage:ja / description / publisher=Person）を追加し、ドメイン自体を検索エンジンの knowledge graph に認識させる。回帰テスト2件追加（`ogp.test.ts`）。追加のみ・視覚変化なし・巻き戻し不要。
  次サイクル候補（安全・小, #09由来）: og:image:width/height / manifest / theme-color / B項目の alt フォールバック小改善。
- cycle 11 (06-15): **theme-color サーバ側注入**（`ogp.ts`）。index.html の静的 `#f7f7f7` を `settings.themeBg` で setAttr 置換（重複なし）。ダークテーマ設定時、初回サーバ描画でモバイルのステータスバーが白く光り JS 実行後に黒へ切替わるチラつきを解消（`provider.tsx`:147 のクライアント同期を **pre-JS 窓**で補完）。回帰テスト3件。安全・小・巻き戻し不要。
  次サイクル候補: og:image:alt（共有画像のa11y・完結）/ og:image:width=1200 / manifest / theme-color は完了。
- cycle 12 (06-15・秋さん明示タスク): **白画面(CDN汚染)恒久対策を現行デプロイ方式に取込**（仕様 content.md）。
  重複チェック: 修正B（HTML no-store + CDN-Cache-Control）は `server.ts:237-239` に既実装、修正C（BUILD_ID/X-Build）も基盤既存（値が古いだけ）。**真の未実装は修正A のみ**。
  実装: ①`vite.config` の entry/chunk/assetFileNames に `BUILD_TAG` 接尾辞（内容不変の vendor も毎ビルドでURL変化→エッジ汚染を物理回避）②`deploy.sh` が **1ビルド=1タイムスタンプ**を自動生成し、全アセット名＋`ogp.ts` の BUILD_ID(X-Build) に同一値を刻む（秋さん手動操作ゼロ）③`deploy.sh` スモークに「X-Build一致＋HTML参照アセット全200」検証を追加（白画面の直接原因を出荷前に検出）④末尾に Publish 後の本番チェック手順を表示。Runable はサンドボックス再ビルド/pm2 を前提にせず dist 同梱を配信するだけ、という現行方式に整合。
  検証: `bun run deploy` 通過（BUILD_TAG=20260615-121245、アセット名・X-Build 一致、74テスト、5ページ+アセット200）。ZIP更新済み。**本番反映は秋さんの Runable Publish 待ち**。
- cycle 13 (06-15・緊急): 本番「新サーバ(X-Build=121245) × 古dist(タグ無し index-B0gIOhPX.js)」不整合を調査。**cycle12 の ZIP は完全整合で、B0gIOhPX は私の ZIP に不在**＝Runable が古い dist を配信している疑い。恒久ガードを `deploy.sh` に追加（クリーンビルド rm -rf dist / 検証2: dist自己整合 / 検証3: ZIP成果物の参照⇔同梱一致）、`ecosystem.cjs` に server×dist 不一致の起動時診断ログを追加。クリーン再ビルドで新 BUILD_TAG=20260615-123147 の整合 ZIP を作成（同梱js/css 19=タグ付き19）。**秋さんへ: 新ZIPを再Publish→x-build とアセットタグを確認。なお改善多数が本番未反映、Publish が律速**。
