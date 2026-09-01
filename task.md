# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-09-01 JST（検索に引っかかるようにする・第1回）

- **Status:** 販売ページの構造化データと題、Work 棚の 404、非JSクローラ向けの
  本文とリンク。**push 済み・本番反映済み。**
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `864c05e`

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

### 検証

- `bun run check` = **1205 pass / 0 fail**（exit 0）
- `bun run smoke` = **354 passed / 0 failed**（1 flaky・147 skipped・14.1分）
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

**オーナーの手が要る（コード側は待っている状態）**

1. **管理画面 → Settings →「撮影を受ける地域」に一行。**欄は作ったが既定は空。
   入れた瞬間にページ・HTML本文・`Service.areaServed` の3か所へ同時に出る
2. **`googleSiteVerification` が空。**Search Console 未接続ならインデックス
   登録を依頼できない。入力欄は管理画面にある

**中文ページ `/zh/*` は作らない判断をした（2026-09-01）。**繁體中文は実在するが
**3段落だけ**で、しかも `profileBio` と `profileBioEn` の両方の末尾に重複して
入っている。`/zh/about` は3行、`/zh/contact` は中国語の依頼文が無いので空になる。
**中身の薄いページを増やすのは検索では逆効果**で、このコードベース自身
`hasPublicEnglishContent` で同じガードをしている。**台北向けの中国語の依頼文を
オーナーが書いたときに増設する**（`/en/*` の仕組みがそのまま使える）。

ついでに見つかった実害: 同じ中国語ブロックが `/about` と `/en/about` の2つのURLに
重複している。`profileBio` から中国語部分を切り出せば解消する。

**写真に題や撮影地を入れる話は取り下げ済み。**いまの写真は仮で入れ替わる。

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
