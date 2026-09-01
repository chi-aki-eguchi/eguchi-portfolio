# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-09-01 JST（検索に引っかかるようにする・第1回）

- **Status:** 販売ページの構造化データと題、Work 棚の 404、非JSクローラ向けの
  本文とリンク。**push 済み・本番反映済み。**
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `353cdb0`

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

### 検証

- `bun run check` = **1183 pass / 0 fail**（exit 0）
- `bun run smoke` = **355 passed / 0 failed / 0 flaky**（147 skipped・13.6分）

途中の1回だけ `admin-debug-sweep :224`(mobile) が落ちたが、**再現しなかった**
（単体でも全体でも通る）。バンドルのチャンク構成も差が無く、増えたのは
`service` チャンクの10バイトだけで admin 側は同一。環境側のゆらぎと判断した。

**smoke は OGP/noscript の差し込みを一度も通っていない。**smoke の webServer は
`bunx vite`（dev server）で、HTML は Vite が返す。`server.ts` の差し込みは
本番の経路にしか無いので、そこはユニットテストと、`dist/index.html` を実際の
関数に通す手動確認で見た（`api/ogp.test.ts` `api/spa-fallback.test.ts`）。

### 次の一手

**ここから先は、コードでは伸びない。**2026-09-01 の本番実測:

    公開写真 497枚 — title / description / 撮影地が入っているもの: すべて0件
    シリーズ 2本   — statement / subtitle: どちらも空

技術面（題・説明・canonical・JSON-LD・sitemap・hreflang）は全ページ揃っている。
**Google が引っかけられる言葉が、サイトに無い。**写真そのものは読めない。

オーナーにしか書けない。効く順:

1. シリーズ2本の statement（管理画面 Series）。いま空欄
2. 写真の撮影地と題。**代表30枚だけでも効く**
3. 展示・掲載の記録

**代わりに書かない。**見ていない写真について作品の文章を書いて公開するのは、
オーナーの言葉を騙ることになる。

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
