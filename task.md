# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-09-02 JST（検索の流入強化・第1回 完了）

- **Status:** コード側は一巡して**全部 push 済み・本番反映済み**。
  **オーナー側の3操作も完了**（基準URL / 撮影を受ける地域 / Search Console）。
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `a177fbd`

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
| `32fbbfb` | 例文が入力済みに見えて、実際にオーナーが欄を取り違えた |
| `a177fbd` | **別セッションの成果**: `docs/specs/seo-audit-2026-09.md`（検索から見た監査）|

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

### オーナー側の3操作 — 2026-09-02 に全部完了（実測確認済み）

    公開サイトの基準URL   https://akieguchi.com   → www が apex へ 301
    撮影を受ける地域       東京・福岡・台北         → Service.areaServed に3件
    Search Console        DNS(TXT)で確認・サイトマップ再読込 2026/09/02 成功・11ページ

**Search Console は8月から既に接続済みだった。**`googleSiteVerification` が
空なのは「HTMLタグ以外の方法で確認していた」だけで、未接続の証拠ではなかった
（空欄から未接続を推測したのは誤り）。あの欄は今後も空でよい。

**ドメインプロパティにはサイトマップを相対パスで登録できない。**`sitemap.xml`
では「アドレスが無効」になる。`https://akieguchi.com/sitemap.xml` と完全なURLで
入れる（URLプレフィックスのプロパティなら相対パスで通る）。

### 次の一手

**効果が出るのは言葉を足したとき。**シリーズ2本の statement がまだ空。
**写真は仮で入れ替わるので、写真1枚ずつに題や撮影地を入れる話は取り下げ済み。**
入れ替わらない場所（撮影依頼・販売・プロフィール・地名）に寄せる。

**中文ページ `/zh/*` は保留のまま。**繁體中文は3段落だけで `/zh/contact` は
空になる。台北向けの中国語の依頼文が書かれたら増設する（`/en/*` の仕組みが
そのまま使える）。

コード側の残り: **B-25 の残り半分（SSR）**。Google は JS を実行するので
`<noscript>` は Google には効かない。

**smoke の flaky（`public-scroll-stability`）は別タスクへ切り出し済み。**
なお**同じワークツリーで2セッションが同時に smoke を回すとポート4310を奪い合い、
259件が ERR_CONNECTION_REFUSED で落ちる**（2026-09-01 に実際に起きた）。
片方ずつ回すこと。

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
