# 検索・外部流入の監査（2026-09-02 実測）

> **一時点の監査記録。**ここの数値は 2026-09-02 に本番 `https://akieguchi.com` を
> 読み取りだけで測ったもの。着手前に測り直す（測り方は末尾）。
> 対象は「流入に効くこと」だけ。デザイン・admin の磨き込みは範囲外。

前回の作業（2026-09-01「検索に引っかかるようにする・第1回」、`task.md` の
Current State と `docs/agents/backlog.md` B-25）で、技術面の土台はほぼ揃った。
今回はその続きで、**残っている穴を流入への影響が大きい順**に並べる。

## 結論（3行）

1. **技術は足りている。足りないのは言葉とページ数。**公開写真497枚のうち
   題・説明が入っているものは0枚、シリーズは2本でどちらも statement が空、
   文章で説明しているページは実質3枚（About / Contact / Portfolio Kit）。
2. 写真の85%（425枚）はシリーズに属さず、**着地できるURLが `/gallery` の1枚だけ。**
3. フィルム写真280枚（56%）には機材データが一切無く、**「フィルム銘柄ごとのページ」は
   今のデータでは作れない。**カメラ・レンズのページはデジタル分だけなら作れる。

## 問題一覧（流入への影響が大きい順）

| # | 問題 | 影響 | 難しさ | 誰が |
|---|---|---|---|---|
| 1 | 写真に題・説明が0枚、シリーズの statement が2本とも空 | **大** | 小（書くだけ）| オーナー |
| 2 | ~~Search Console 未接続~~ **接続済み。誤りだった**（下記「訂正」）| — | — | — |
| 3 | 着地ページが少ない。写真497枚に対して索引できるURLは11本、うち写真を束ねるのは3本（gallery + series×2）| **大** | 中（フェーズ2）| コード |
| 4 | 文章で答えるページが無い（記事機能が無い） | **大** | 大（フェーズ3）| コード＋オーナー |
| 5 | フィルム写真280枚に camera / lens / 銘柄が無い。銘柄の欄そのものが無い（`filmType` は「フィルム/デジタル」の2値）| 中 | 中（欄の追加＋入力）| コード＋オーナー |
| 6 | 1枚1枚の写真にURLが無い（Lightbox は履歴だけ積み、URLは変えない）。JSON-LD も `ImageGallery` 止まりで `ImageObject` が無い | 中 | 中 | コード |
| 7 | Google（JSを実行する側）には SPA の描画結果しか見えない。`<noscript>` は Google には効かない（B-25 の残り半分）| 中 | 大 | コード |
| 8 | JSON-LD の `WebSite.description` / `ImageGallery.description` が「江口秋の写真ポートフォリオ。」の1文（`siteDescription`）| 小 | 小 | オーナー（設定1行）|
| 9 | hreflang に `x-default` が無い。`/en` は 404（英語の入口が無い）| 小 | 小 | コード |
| 10 | `/work` が空のまま `index, follow` の 200 で返る（sitemap には載っていない）| 小 | 小 | コード |
| 11 | カテゴリ（portrait 73枚など）がURLを持たない。`/gallery` の絞り込みだけ | 小 | 中 | コード |
| 12 | UTM 付きリンクを作る仕組みが無い | 小 | 小（フェーズ4）| コード |

**#1 はコードの外にあって、しかもいちばん効く。**フェーズ1〜3のコードは
「言葉を入れる場所」を増やすものであって、言葉そのものは増やせない。

## 訂正（2026-09-02・同日）

**「Search Console 未接続」は誤りだった。**接続されている。

`googleSiteVerification` の設定欄が空だったので未接続と書いたが、**認証は DNS で
済んでいた。**akieguchi.com の TXT レコードに
`google-site-verification=6x75jSEN6AiuYYQ27raygdc_OU3Ok3yHT4Pu5_wbfX8` がある。

DNS 認証は、HTML の `<meta>` タグより**強い**方式（ドメイン全体・全サブドメイン・
http/https をまとめて認証する）。したがって設定欄は空のままでよく、
**埋める必要は無い。**

    dig +short TXT akieguchi.com @8.8.8.8

**この誤りの教訓:** 設定欄が空であることは「機能が無効」を意味しない。
認証・接続の類は、アプリの設定ではなく**外側（DNS・ドメイン・プラットフォーム）**を
見ないと分からない。同じ罠は `printStoreUrl` などでは起きない（あれは本当に空）。

なお、DNS で認証されていることと、**サイトマップを送信済みかどうかは別**。
Search Console の画面でしか確認できないので、ここでは未確認とする。

## 揃っていたもの（触らない）

- **sitemap.xml**: 11 URL。公開ページはすべて載っている（`/profile` は `/about` の
  別名で canonical が `/about` を指すので載せないのが正しい。`/work` は空なので載せない）。
  画像は75枚（シリーズ2本分＋プロフィール）。`lastmod` は分かる所だけ。
- **robots.txt**: `Allow: /`、`Disallow: /admin`、Sitemap 行あり。
- **title / description / canonical / OGP / Twitter Card**: 全ページで揃う。
  `og:image` は 1200×630 の JPEG で幅・高さ・alt 付き。
- **hreflang**: 英語版があるページ（about / contact / portfolio-kit）には ja / en が付く。
  無いページに付いていないのは正しい。
- **JSON-LD**: 全ページに WebSite + Person（sameAs 3本）+ ImageGallery。シリーズは
  BreadcrumbList、Contact は ContactPage + Service（areaServed 3か所）、Kit は
  Product + Offer + FAQPage。
- **noindex**: 404 と `/start` と `/admin/*` だけ。付け忘れ・付けすぎ無し。
- **重複URL**: www → apex 301、http → https 301、末尾スラッシュ 308、`/profile` は
  canonical で `/about` へ。基準URLは設定済み（2026-09-01 の「次の一手」1番は完了）。
- **404**: 公開URLで 404 になるものは無し。存在しないURLは正しく 404 + noindex。
- **画像**: `alt` は題→説明→「シリーズ・撮影者・撮影月」の順で必ず文になる。
  `loading="lazy"` は初回表示分だけ eager。
- **LCP**: ヒーロー画像（170KB WebP）を `preload` + `fetchpriority=high`。
  フォントは preconnect + preload。JS は gzip 後で約180KB、CSS 31KB。
  TTFB 0.13〜0.4秒。**速さは順位を落としていない。**
- **非JSクローラ向け本文**: `<noscript>` に見出し・説明・リンク（B-25 の前半）。
- **計測**: GA4（`G-NKECCDLXYD`）が全公開ページに入っている。
  **SNS からの流入は GA4 の「トラフィック獲得」で今日から見られる。**
  Cloudflare Web Analytics は未導入（無くても困らない。GA4 が既にある）。

## データの実測（フェーズ2の材料）

公開写真 497枚（`/api/photos`）。

| 欄 | 入っている枚数 |
|---|---:|
| title | 0 |
| description | 0 |
| shotAt（撮影日）| 497 |
| filmType | 497（フィルム 280 / デジタル 217）|
| camera | 217（**デジタルだけ**。フィルム280枚は全て空）|
| lens | 217（うち `----` 35枚、`0.0 mm f/0.0` 3枚はゴミ値）|
| category | 94（portrait 73 / nature 11 / life 7 / street 3）|
| seriesId | 72（Ishigaki Island 59 / indigo blue 13）|

カメラ別（3枚以上）: SONY ILCE-1 = 140、SONY ILCE-7RM5 = 37、SONY ILCE-7M4 = 25、
NIKON Z6_3 = 13。（Z f は2枚なので対象外）

レンズ別（3枚以上）: FE 50mm F1.2 GM = 125、FE 35mm F1.4 GM = 12、
85mm F1.4 DG DN Art = 12、NIKKOR Z 50mm f/1.2 S = 11、FE 135mm F1.8 GM = 6、
FE 24-50mm F2.8 G = 3、Viltrox 16mm F1.8 = 3。

注意点:

- **camera の値は EXIF の生の文字列**（`SONY ILCE-1`）。管理画面のプリセット
  （`metaPresetsCamera`: `SONY α1`、`Leica M6`、`PENTAX 67` …）とは別の表記。
  ページの見出しとURLには読める名前（`SONY α1` / `/camera/sony-a1`）への対応表が要る。
- プリセットにはフィルム機（Leica M6、PENTAX 67、BRONICA S2、Nikon F3 …）と
  フィルム用レンズが並んでいるが、**それを付けた写真は0枚。**
  フィルム機ごとのページは、オーナーが機材を付けてから。
- **フィルム銘柄（Portra 400 など）を入れる欄が無い。**フェーズ2で銘柄ページを
  作るなら、`photos` に列を1本足す（Turso の `ensureTursoColumns` / 契約テスト /
  PostgreSQL migrator の3か所）＋ admin に入力欄＋オーナーの入力、が前提になる。

## フェーズ2の想定（オーナー確認前の下書き）

今のデータで「3枚以上」を満たす組み合わせ:

| 想定URL | 見出し | 枚数 |
|---|---|---:|
| `/camera/sony-a1` | SONY α1 | 140 |
| `/camera/sony-a7rv` | SONY α7R V | 37 |
| `/camera/sony-a7iv` | SONY α7 IV | 25 |
| `/camera/nikon-z6iii` | Nikon Z6III | 13 |
| `/lens/fe-50mm-f1-2-gm` | FE 50mm F1.2 GM | 125 |
| `/lens/fe-35mm-f1-4-gm` | FE 35mm F1.4 GM | 12 |
| `/lens/sigma-85mm-f1-4-dg-dn-art` | 85mm F1.4 DG DN Art | 12 |
| `/lens/nikkor-z-50mm-f1-2-s` | NIKKOR Z 50mm f/1.2 S | 11 |
| `/lens/fe-135mm-f1-8-gm` | FE 135mm F1.8 GM | 6 |
| `/lens/fe-24-50mm-f2-8-g` | FE 24-50mm F2.8 G | 3 |
| `/lens/viltrox-16mm-f1-8` | Viltrox 16mm F1.8 | 3 |
| `/film` （銘柄ページ）| — | **作れない（データ無し）** |

案として `/category/portrait`（73枚）も同じ仕組みで作れる。
**この表はフェーズ2の冒頭でオーナーの確認を取ってから実装する。**

## 追加の実測（2026-09-02・同日の第2回）

オーナーから「写真の題でもカメラでもない。**もっと他のところ**があるはず」と
言われて測り直した結果、**監査の第1回が見落としていた2つの事実**が出た。

### 1. オーナーは既に16本書いている。ただし全部 note.com 側にある

note.com の API で全件を数えた。**公開済みの記事は16本**（2025-04-11 〜 2026-06-15）。

    curl -s "https://note.com/api/v2/creators/chi_aki_zip/contents?kind=note&page=1"

反応が大きい順に、話題はこう分かれる。

| 話題 | 本数 | いちばん反応が大きい記事 |
|---|---:|---|
| オールドコンデジ（古いコンパクトデジカメ）| 3 | オールドコンデジ沼にハマりました（like 41）|
| 中判フィルム 6x6 / 6x7 | 2 | 66とか67の中判フィルム写真（like 20）|
| 展示 | 2 | still,life大阪参戦！ |
| プリセット配布 | 1 | すきぴいろプリセット配布（自作の Lightroom プリセットを無料配布）|
| 写真日記・雑記 | 8 | — |

**自サイト側の扱いは、`/about` の下に出る見出し3本の抜粋カードだけ**
（`api/note-rss.ts` が RSS を読んでいる）。**記事本文は1文字も自サイトに無く、
記事ごとのURLも無い。**書いた文章の検索評価は、全部 note.com が受け取っている。

ここから分かること。**この人は「書けない人」ではない。既に書いている。**
第1回監査の「文章で説明しているページが3枚しかない」は、
正しくは「**文章はあるが、自分のドメインに置いていない**」だった。

### 2. JS を実行した後（＝Google が見る姿）でも、本文とリンクが少ない

ブラウザで実際に描画させてから数えた。`<noscript>` の話ではなく、
**JavaScript を実行する側から見た本物の姿**。

| ページ | 読める文字数 | リンク（重複除く）| 画像 | リンクの中の画像 |
|---|---:|---:|---:|---:|
| `/` | 250 | 12 | 21 | 2 |
| `/gallery` | 160 | 10 | 36 | **0** |
| `/series/ishigakiisland` | 296 | 11 | 60 | **0** |
| `/about` | 780 | 24 | — | — |

- **`/about` の780文字の半分は note の抜粋3本。**それを除くと本文はプロフィール数行。
- **写真1枚ごとのURLが存在しない。**Lightbox は履歴を積むだけでURLを変えない。
  画像はどれもリンクの中に入っていないので、**Google 画像検索が人を送れる先は
  `/gallery` 1本しか無い**（497枚が同じ1つの着地点を共有している）。
- シリーズページは60枚の画像に対して本文296文字。statement が空なのが効いている。

測り方（ブラウザの開発者コンソールで実行しても同じ）:

```js
document.body.innerText.replace(/\s+/g,' ').trim().length
document.querySelectorAll('a[href]').length
[...document.querySelectorAll('img')].filter(i=>i.closest('a[href]')).length
```

## 測り方（数値は信じずに測り直す）

```bash
# ページの head を見る（title / description / robots / canonical / hreflang）
curl -s https://akieguchi.com/about | grep -o '<title>[^<]*</title>\|<meta name="\(description\|robots\)"[^>]*>\|<link rel="\(canonical\|alternate\)"[^>]*>'
# sitemap の URL 数と画像数
curl -s https://akieguchi.com/sitemap.xml | grep -c '<url>'
curl -s https://akieguchi.com/sitemap.xml | grep -o '<image:image>' | wc -l
# 写真の言葉と機材の入り具合
curl -s https://akieguchi.com/api/photos | python3 -c "
import json,sys,collections;ph=json.load(sys.stdin)['photos'];s=lambda v:(str(v).strip() if v is not None else '')
print(len(ph),'photos');[print(k,sum(1 for p in ph if s(p.get(k)))) for k in ['title','description','camera','lens','category','seriesId']]
print(collections.Counter(s(p.get('camera')) or '(none)' for p in ph).most_common())"
```
