# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-09-01 JST（検索に引っかかるようにする・第1回）

- **Status:** 販売ページの構造化データと題、Work 棚の 404、非JSクローラ向けの
  本文とリンク。**push 済み・本番反映済み。**
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `5a1b598`

### やったこと

| commit | 内容 |
|---|---|
| `4958643` | **Work 棚に置いた1本が 404・noindex で返る**状態だった（本番にまだ work 棚が無いので未発症）|
| `e1212d7` | 販売ページに **Product + Offer**（値段は servicePageConfig から読む）と FAQPage |
| `69e466f` | B-25 を backlog へ |
| `3778857` | 題と説明を**作品を主語にした文**へ（オーナー判断）|
| `22ace9e` | **JSを実行しないクローラに本文とリンクを渡す**（リンクが0本だった）|
| `61f3148` | **画面にはFAQが出ているのに構造化データには無かった**（既定値を shared へ）|
| `3ea2348` | **写真497枚の説明文が7種類しかなかった**（344枚が同一文）→47種類 |
| `353cdb0` | **サイトマップの画像が4枚だけだった** → 約74枚 |
| `803dd9e` | **撮影を受けることを題・構造化データ・本文で言う**（題は1か所化してから変更）|
| `54e0ae2` | **撮影を受ける地域**（東京・福岡・台北）を設定できるようにした |
| `864c05e` | **画面に出ている文が HTML と構造化データでは空だった**（既定値がAPI層だけ・3度目）|
| `0afc72b` | **英語ページが日本語の説明文・見出しを出していた**（英語本文から作る）|
| `5a1b598` | **www と apex の二重サイト**を入口1つに寄せる（基準URL未設定なら発火しない）|

### 検証

- `bun run check` = **1215 pass / 0 fail**（exit 0）
- `bun run smoke` = **355 passed / 0 failed / 0 flaky**（147 skipped・13.9分）
  flaky は `public-scroll-stability`。**今日7回中およそ半分で落ちて再試行で通る。**
  変更前からで今回とは無関係だが、**本当の破損と揺れを毎回区別できない**ので
  別タスクへ切り出した。

**測る場所を間違えない。**`/api/settings` は既定値を適用した後の姿で、
`server.ts` は生の DB 行しか見ない。**同じキーでも見える物が違う。**
差し込みの確認は `/api/settings` ではなく、実際の HTML を見る。

途中の1回だけ `admin-debug-sweep :224`(mobile) が落ちたが、**再現しなかった**
（単体でも全体でも通る）。バンドルのチャンク構成も差が無く、増えたのは
`service` チャンクの10バイトだけで admin 側は同一。環境側のゆらぎと判断した。

**smoke は OGP/noscript の差し込みを一度も通っていない。**smoke の webServer は
`bunx vite`（dev server）で、HTML は Vite が返す。`server.ts` の差し込みは
本番の経路にしか無いので、そこはユニットテストと、`dist/index.html` を実際の
関数に通す手動確認で見た（`api/ogp.test.ts` `api/spa-fallback.test.ts`）。

### 次の一手

**オーナーの手が要る。効く順。コード側は全部待っている状態。**

1. **管理画面 → Settings →「公開サイトの基準URL」に `https://akieguchi.com`。**
   **いちばん大きい。**いま空欄で、空だとアクセスされたホストがそのまま基準に
   なる。そのため **www と apex が互いを指さない2つの完全なサイト**として
   応答していた（2026-09-01 実測。www の canonical も sitemap も www を指す）。
   中身が同じ2サイトなので評価がそこで割れる。入れると canonical / og:url /
   sitemap / JSON-LD が全て apex を指し、`5a1b598` の 301 も発火する
2. **「撮影を受ける地域」に一行**（東京・福岡・台北）。ページ・HTML本文・
   `Service.areaServed` の3か所へ同時に出る
3. **`googleSiteVerification`。**Search Console 未接続ならインデックス登録を
   依頼できず、何が起きているかも見えない

**測って問題が無かったので触らない所:** 表示速度（TTFB 0.15〜0.65秒・HTML
7〜10KB）、http→https の301、末尾スラッシュの308、`/profile` の canonical、
robots.txt。**速度は順位要因だが、ここは既に十分速い。**

**中文ページ `/zh/*` は作らない判断のまま**（繁體中文は3段落だけで、
`/zh/contact` は空になる）。台北向けの中国語の依頼文が書かれたら増設する。

コード側の残り: **B-25 の残り半分（SSR）**。Google は JS を実行するので
`<noscript>` は Google には効かない。

### 触ってはいけない範囲

- 本番DB・Turso・R2・Railway・環境変数・`.env` / `shotAt` / 公開API応答形
- Lightbox は 2026-08-31 にオーナー承認で触れた。**次も承認が要る**
- 動きの正本は `docs/specs/design-spec.md` §6。**duration ではなく
  「目に見えている時間」で決める**。**全画面に `filter` を animate しない**
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
