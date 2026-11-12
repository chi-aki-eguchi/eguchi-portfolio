# 検索の現状確認と今回の改善（2026-11-11）

担当: Claude Code。基点 `origin/main` `f10903d`、worktree `/Users/chiaki/wt-seo-portfolio-20261111`（branch `claude/seo-20261111`）。
push と本番公開はオーナーが行う。ここは「調べて分かったこと・変えたこと・公開手順・公開後に見る所」。

## Search Console で確認したこと（2026-11-11、ドメインプロパティ akieguchi.com）

データは 2026-08-31〜11-08（3か月分はまだ無い）。クリック 45／表示 303／平均順位 8.7。
直近28日 8クリック・144表示、その前の28日 29クリック・112表示。数が小さく、増減を傾向とは言えない。
クリックのある検索語は「江口秋」4、「江口あき」1、「photo select」1。クリックはトップ 41・/about 4 にほぼ集まる。

### 未登録の24ページ

| 理由 | URL | 見立て |
|---|---|---|
| 検出・未登録（見つけたが未巡回）12 | `/portrait` `/life` `/info` `/series/sicf` `/series/stilllifekyoto` `/work/rintaro` `/terms` `/en/contact` と、`/tools/small-work/gallery.html` `/workroom/photo-files.html` `/workroom/print-budget.html` `/workroom/site-check.html` | **作品の入口3つ（Portrait・Life・Info）とシリーズ2件・仕事1件が、まだ一度も読まれていない。** いちばん直したい所 |
| クロール済み・未登録 1 | `/series/indigoblue` | 前回の巡回は 2026-06-19（旧公開先 runable.site の時期）。以後 読みに来ていない |
| noindex 8 | 体験版・見本（`*-trial` `*-demo` `*-sample`）と `/portfolio-kit/consult` | 意図どおり |
| リダイレクト 2・代替ページ 1 | `http://` 2件、`/?portfolio-kit-experience=1` | 意図どおり |

### Google が実際に読み込んだ結果（URL検査 → 公開URLをテスト、`/series/indigoblue`）

- 「URL は Google に登録できます」。パンくずの構造化データも検出。
- 描画後のHTML（約4万字）に、題（h1）、写真15枚（うち14枚に「indigo blueシリーズより、江口秋が2024年12月に撮影した写真」の説明文）、メニューと前後のシリーズへのリンクが入っている。
- **読める文は「14点／デジタル／2024年12月–2025年1月」と機材名だけ。** シリーズの紹介文が無い。

つまり、写真・題・リンクは Google に届いている。届いていないのは「言葉」と「読みに来るきっかけ」。
初期HTMLには `<noscript>` で題・説明・リンクが入っている（`spa-fallback.ts`）。Google は描画後のHTMLを使うので、
今回 SSR・プリレンダリングへの作り替えはしていない（効果の根拠が無く、開いた瞬間の見え方を壊す危険が大きい）。

### そのほか

- 旧公開先 `chi-aki-eguchi.runable.site` は 403。重複して出てはいない。`www.` は 301 で正式URLへ。
- 本番のシリーズ5件（Still,life京都・Ishigaki Island・indigo blue・SICF Fukuoka・Rintaro Otsuka）は、紹介文・副題が全部空（公開API で確認）。
- 「写真 ポートフォリオ 作り方」は順位 23.6・表示 24・クリック 0。ガイドは `/portfolio-kit` からだけ辿れる。

## 変えたこと

1. **英語ページの題を英語だけに。** `/en/about` `/en/contact` `/privacy/en` `/terms/en` は、日本語ページと一字一句同じ「About | 江口秋 | Aki Eguchi | 写真学生」だった。「About | Aki Eguchi」にする。サーバ（`api/ogp.ts`）と画面（`usePageTitle`）は同じ式（`shared/site-title.ts` の `composeEnglishPageTitle`）。
2. **トップと Works の写真に説明文。** トップに出る写真10枚はすべて `alt=""` だった。入口の2枚・下の組写真・Works の表紙に、ほかのページと同じ規則（`shared/photo-alt.ts`。題 → 読み上げ用の言葉 → 説明 → 撮影者と時期）で付ける。新しい言葉は作っていない。
3. **`/work` の説明文を `/series` と別の文に。** 設定の同じキーに相乗りしていて、2ページが同じ説明文だった。
4. **サイトマップの更新日。** `/portrait` `/life` はそのページの写真でいちばん新しい日、`/works` はサイト全体の最新日。根拠の無いページには今までどおり出さない。

### 変えなかったこと（理由つき）

- **制作サービス・道具への入口。** 「制作の案内は About の1か所だけ」（2026-10-07、`shared/service-visibility.ts`）のまま。トップや作品のページには足していない。フッターの「About →」から `/about` → Portfolio Kit・写真セレクト便へ辿れる。Info は依頼フォームを含むので、前からの決まり（Contact には出さない）に合わせて出していない。
- **肩書き。** 題は「写真学生」、構造化データと説明文は「写真家」。どちらを名乗るかはオーナーの言葉なので、そろえていない。
- **`/about` と `/info`、`/contact` と `/info`。** 中身が重なるが、`/about` は名前の検索で表示 113・順位 4.0 を持っている。今 正規URLを寄せると、その評価を捨てることになる。`/info` が読まれてから判断する。

## オーナーにしか書けない言葉（いちばん効く所）

シリーズのページが登録されない理由は、技術ではなく、読める文が無いこと。こちらで作品の意図を作文しない。

| どこに | 何を | 入れる所 |
|---|---|---|
| シリーズ5件 | 紹介文（2〜4文で足りる。どこで・何を・なぜ） | 管理画面 → シリーズ → 紹介文 |
| 代表作の写真 | 題か、読み上げ用の言葉（被写体・場所） | 管理画面 → 言葉を付ける（`/admin/words`） |
| 日藝祭の展示 | 題が「無題」のまま。作品名がそうなら そのままで良い | 管理画面 → ページの写真 → 展示 |

`still,lifeの権化`（note、2026-05-20）は Still,life京都 の材料になりそうだが、本人の確認なしに紹介文へ移していない。

## 検証（2026-11-11、手元）

- `bun run typecheck` 成功。`bun test`（api・shared・web）1,700件成功（新規4件。英語の題の期待値2件を、意図どおりの値へ更新）。
- `bun run lint` 成功。
- smoke（公開画面の5 spec: public-site・public-develop-structure・public-exhibition・public-photo-site・profile-aspect、Chromium と WebKit の PC・スマホ）548成功・120skip・失敗0。
- そのあと「見開きのトップ」の検査に、入口の写真と Works の表紙の説明文が空でないこと、`/en/about` の題が英語だけであることを足し、4環境で成功。
- **2026-11-11 追加検証**: `bun run check` 全体（スキーマ・移行・型・lint・単体・道具・smokeの守り・ビルド）が終了コード0。最後の wiki の鮮度確認は以前からある「67日前に確認」の注意を出すだけで、失敗ではない。smoke の管理画面側は実行していない（管理画面のコードは触っていない）。
- **本番の公開写真での確認**（`TRY_DESIGN=develop bun run try`。本番の公開GETだけを中継し、書き込みはしない）。`/` `/works` `/en/about` `/portrait` を PC 1440 とスマホ 390 で、本番（変更前）と並べて取得。
  - 写真の位置と大きさ、ページの高さ・幅は、4ページ×2幅とも変更前と完全に同じ。読み込めない写真 0、画面のエラー 0。
  - 空の説明文: トップ 10枚 → 0、Works 7枚 → 0。入った文は「江口秋撮影のフィルム写真（2025年10月スキャン）」「Ishigaki Islandシリーズより、江口秋撮影の写真」など、既存ページと同じ規則の文。
  - `/en/about` の題: 「About | 江口秋 | Aki Eguchi | 写真学生」→「About | Aki Eguchi」。
  - 画面: [トップ](evidence/seo-20261111/after__1440_top.jpg)、[Works PC](evidence/seo-20261111/after_works_1440_full.jpg)、[Works スマホ](evidence/seo-20261111/after_works_390_full.jpg)、[About 英語](evidence/seo-20261111/after_en_about_1440_full.jpg)。
- サーバが最初に返すHTMLの題・説明（`api/ogp.ts`）は単体テストで確認。本番での実物は公開後に見る。
- シリーズ紹介文の下書き: [series-statement-drafts-20261111.md](series-statement-drafts-20261111.md)（未確認の下書き。管理画面には入れていない）。

## 公開の手順（オーナー）

1. 作業フォルダから直接、早送りで main へ送る（元の `~/eguchi-portfolio-app` の未追跡ファイルには触らない）:
   `git -C ~/wt-seo-portfolio-20261111 fetch origin main` → `git -C ~/wt-seo-portfolio-20261111 push origin claude/seo-20261111:main`（Railway が反映）。
   2026-11-11 時点で `origin/main`（`f10903d`）の真上に載っており、競合は無い。main が進んでいたら push は拒否される（何も壊れない）。
   そのときは作業フォルダで `git rebase origin/main` → `bun run check` → もう一度 push。
2. `https://akieguchi.com/api/health` の build が新しくなったことを確認。
3. 本番で確認: `/en/about` のタブの題が「About | Aki Eguchi」。トップの写真を右クリック →「検証」で alt に文が入っている。`/sitemap.xml` の `/portrait` に `<lastmod>`。
4. Search Console → URL検査で、次の順に「インデックス登録をリクエスト」（1日10件ほどまで）: `/portrait` `/works` `/info` `/life` `/series/indigoblue` `/series/sicf` `/series/stilllifekyoto` `/work/rintaro` `/exhibition`。読める文があるページのほうが登録されやすいので、先に紹介文を入れられるなら入れてから。**リクエストしても登録は保証されない。**
5. Search Console → サイトマップ → `sitemap.xml` を再送信。

戻し方: 取り込んだコミットを `git revert` して push（DB・設定の変更は無い）。`docs/rollback-guide.md`。

## 公開後に見る所

登録されることを前提にしない。下の時期に実際の登録状況と表示回数を記録し、登録されないページは URL検査の理由（検出・未登録／クロール済み・未登録）を見て次の手を決める。

| いつ | どこ | 何を |
|---|---|---|
| 公開当日 | 本番 | 上の手順3 |
| 1〜2週間後 | Search Console → ページ →「検出・未登録」 | `/portrait` `/life` `/info` とシリーズが一覧から消えたか（今は12件。消えない物は理由を記録する） |
| 4週間後（12月上旬） | 検索パフォーマンス、28日比較、ページ別 | `/portrait` `/works` `/series/*` に表示が付いたか。`/en/about` の表示とクリック |
| 4週間後 | 検索パフォーマンス、検索タイプ「画像」 | 表示回数（今回 未取得。説明文を足した効果はここに出る） |
| 表示が付いてから | 同上 | `/about` と `/info` のどちらが名前の検索で出ているか → 正規URLを寄せるか判断 |

## 公開結果（2026-11-11）

- 公開: 2026-11-11 16:13 JST に `main` へ push（`f10903d` → `5d5e722`、早送りのみ）。16:15 JST に `/api/health` の build が `5d5e7226` に切り替わった。
- 本番での確認（計測用のGoogle通信は遮断した検査用ブラウザ）:
  - 最初に返るHTML: `/en/about` の題は「About | Aki Eguchi」、説明は英語。`/` `/works` `/portrait` `/work` `/work/rintaro` `/series/ishigakiisland` は題・説明・canonical・`index, follow` とも想定どおり。
  - 写真と alt: `/`（10枚）`/works`（7枚）`/en/about` `/portrait`（16枚）を PC 1440 とスマホ 390 で確認。空の alt 0、読めない写真 0、画像の失敗応答 0、横はみ出し 0、画面エラー 0。
  - サイトマップ: 51 URL、画像 239、`lastmod` は根拠のある 11 ページだけ。
- Search Console（申請したことと登録されたことは別。紹介文は未承認のまま入れていない）:
  - 申請して受理（優先クロール キューに追加）: `/portrait` `/works` `/info` `/life` `/series/sicf` `/series/stilllifekyoto` `/work/rintaro` `/exhibition`（以上、検出・未登録）、`/series/indigoblue`（クロール済み・未登録）、`/en/about`（登録済み。題を変えたので再クロール）。計10件。
  - `/series/ishigakiisland`: 登録済み。申請していない。
  - 未申請: `/work`（一覧の入口。1日の申請数を抑えるため見送り。次回の確認時に状態を見る）。
  - サイトマップ `sitemap.xml` を再送信 → 送信 2026-11-11・読み込み 2026-11-11・成功・51ページ。
- 同日 16:41〜16:46 JST に別作業（問い合わせ・Works への着地、`d6bb70a` `51182c2`）が main に入り、build は `d6bb70a8` になった。その後に取り直しても、題・alt・写真は上と同じ結果。
- 戻す場合: `git revert 5d5e722 5c574fe a802242` を push（DB・設定の変更なし。後から入った別作業は巻き戻さない）。

### 公開後に見る日（予定を書いただけ。自動監視は設定していない）

| 日付 | 見るもの |
|---|---|
| 2026-11-18〜11-25 | 申請した10件を URL検査で1件ずつ。登録済み／検出・未登録／クロール済み・未登録と最終クロール日を記録。クロール済み・未登録のままのシリーズは、紹介文（`series-statement-drafts-20261111.md`、本人確認待ち）を入れる判断材料にする。`/work` の状態も見る |
| 2026-12-09 | 検索パフォーマンスの28日比較（ページ別の表示回数とクリック、検索タイプ「画像」、`/en/about` の題の出方）。ページ → 未登録の件数（公開時 24）と内訳 |

## 公開後の確認手順と基準値（2026-11-11 夜に記録）

### 11月18〜25日: 登録状況

Search Console（`sc-domain:akieguchi.com`）の上の検索欄に下のURLを1件ずつ入れて URL検査し、「ページのインデックス登録」の文言と「前回のクロール」の日付を表に書く。申請したことと登録されたことは別に書く。

| URL | 11-11 の状態（申請前） | 11-11 の対応 |
|---|---|---|
| `https://akieguchi.com/portrait` | 検出・未登録 | 申請・受理 |
| `https://akieguchi.com/works` | 検出・未登録 | 申請・受理 |
| `https://akieguchi.com/info` | 検出・未登録 | 申請・受理 |
| `https://akieguchi.com/life` | 検出・未登録 | 申請・受理 |
| `https://akieguchi.com/exhibition` | 検出・未登録 | 申請・受理 |
| `https://akieguchi.com/series/sicf` | 検出・未登録 | 申請・受理 |
| `https://akieguchi.com/series/stilllifekyoto` | 検出・未登録 | 申請・受理 |
| `https://akieguchi.com/work/rintaro` | 検出・未登録 | 申請・受理 |
| `https://akieguchi.com/series/indigoblue` | クロール済み・未登録（前回 2026-06-19） | 申請・受理 |
| `https://akieguchi.com/en/about` | 登録済み | 再クロールを申請・受理 |
| `https://akieguchi.com/work` | 未検査 | 申請していない |
| `https://akieguchi.com/series/ishigakiisland` | 登録済み | 申請していない |

- 読み方: 「前回のクロール」が 11-11 以降で未登録のまま → 読んだうえで載せていない。シリーズなら紹介文（`series-statement-drafts-20261111.md`、本人確認待ち）を入れる判断材料にする。日付が古いまま → まだ読みに来ていない。もう1週間待つ。
- `/work` が未登録なら、このとき申請する。
- ページ → 「未登録」の件数と内訳も記録する。基準は 24件（検出・未登録 12、クロール済み・未登録 1 ほか）。
- サイトマップが「成功・51ページ」のままかを見る。

### 12月9日: 検索パフォーマンスの比較

- 比べる期間: 公開後 2026-11-11〜12-08 と、公開前 2026-10-14〜11-10（各28日）。数字は2日ほど遅れるので、12-07・12-08 が欠けていたら 12-11 に読み直す。
- 開き方: 検索パフォーマンス → 期間「カスタム」→「ページ」の表。画像は「検索タイプ」を「画像」に切り替える。

公開前 2026-10-14〜11-10 の基準値（ウェブ検索）:

| 対象 | クリック | 表示 | CTR | 平均順位 |
|---|---|---|---|---|
| サイト全体 | 6 | 139 | 4.3% | 11.3 |
| `/` | 5 | 68 | 7.4% | 4.7 |
| `/about` | 1 | 42 | 2.4% | 5.6 |
| `/series` | 0 | 28 | 0% | 6.5 |
| `/en/about` | 0 | 7 | 0% | 6.0 |
| `/portrait` `/works` `/info` `/life` `/exhibition` `/series/*` `/work/rintaro` | 表に出ていない（表示 0） | | | |

同じ期間の画像検索:

| 対象 | クリック | 表示 | 平均順位 |
|---|---|---|---|
| サイト全体 | 0 | 53 | 32 |
| `/about` | 0 | 23 | 14.0 |
| `/series` | 0 | 20 | 29.0 |
| `/workroom/announcement.html` | 0 | 14 | 59.4 |
| `/` | 0 | 11 | 30.5 |

- 見るところ: 申請した作品ページに表示が付いたか（今は0）。`/en/about` の表示とクリック、検索結果での題の出方。画像検索の表示回数と、`/` `/works` `/portrait` が画像の表に出るか。
- 数が小さいので、増減を1回で傾向と言わない。登録されていないページに表示が付かないのは当然なので、先に登録状況を見る。

