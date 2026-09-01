# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-09-01 JST（検索に引っかかるようにする・第1回）

- **Status:** 販売ページの構造化データと題、Work 棚の 404、非JSクローラ向けの
  本文とリンク。**push 済み・本番反映済み。**
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `54e0ae2`

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

### 検証

- `bun run check` = **1201 pass / 0 fail**（exit 0）
- `bun run smoke` = **354 passed / 0 failed**（1 flaky・147 skipped・14.2分）
  flaky は `public-scroll-stability`。**変更前から同じ所がたまに落ちる。**

途中の1回だけ `admin-debug-sweep :224`(mobile) が落ちたが、**再現しなかった**
（単体でも全体でも通る）。バンドルのチャンク構成も差が無く、増えたのは
`service` チャンクの10バイトだけで admin 側は同一。環境側のゆらぎと判断した。

**smoke は OGP/noscript の差し込みを一度も通っていない。**smoke の webServer は
`bunx vite`（dev server）で、HTML は Vite が返す。`server.ts` の差し込みは
本番の経路にしか無いので、そこはユニットテストと、`dist/index.html` を実際の
関数に通す手動確認で見た（`api/ogp.test.ts` `api/spa-fallback.test.ts`）。

### 次の一手

**オーナーの手が要る（コードは待っている状態）**

1. **管理画面 → Settings → 「撮影を受ける地域」に一行入れる。**欄は作ったが
   既定は空。入れた瞬間に、ページ・HTML本文・`Service.areaServed` の3か所へ
   同時に出る。エージェントは本番DBに書かない
2. **`googleSiteVerification` が空。**Search Console が未接続なら、インデックス
   登録を依頼できず、何が起きているかも見えない。入力欄は管理画面にある

**写真に題や撮影地を入れる話は取り下げた**（2026-09-01）。オーナーいわく
**いまの写真は仮で入れ替わる**ので、1枚ずつ言葉を入れても消える。
入れ替わらない場所（撮影依頼・販売・プロフィール）に寄せる。

**コード側の次の大きい一手: 中国語ページ（`/zh/*`）。**台北が主要エリアで、
オーナーは台湾出身。**`profileBio` には既に中文の段落が入っている**のに
`/zh/*` が無く、台北で中国語で探している人に一文字も届いていない。
`/en/*` と同じ仕組みが既にあるので、増設で足りる。未着手。

その次: **B-25 の残り半分（SSR）**。Google は JS を実行するので `<noscript>`
は Google には効かない。

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
