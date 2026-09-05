# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-09-05 JST（Portfolio Kitの管理画面訴求）

- 写真の入れ替え、見せ方、プロフィールを自分で変更できることを日英販売ページの主役にした。
- 管理画面紹介を冒頭へ移し、実際のデモ画面3種の切替・拡大とデモ導線を追加。
- 原作業台の未コミット変更を保持し、origin/main基点の `codex/admin-sales` で分離した。
- 2026-09-05の最終確認: `bun run check` exit 0（1225 tests・tools 56件）、影響する公開smoke 20件成功。
- 日英・390px/1440pxの実ブラウザーで画像切替・画像読込・キーボード・横幅を確認。仕様と検証資料は `docs/specs/admin-led-sales-page.md`。
- 実装・検証完了。本番の配備状態は `/api/health` のbuildと販売ページを照合する。
- 本人確認: 普段の事業拠点は日本。台湾は時々渡航し撮影依頼へ対応できる地域。

<details>
<summary>直前のHERO修正の記録</summary>

## Current State — 2026-09-02 JST（HEROの名前位置を修正・本番確認済み）

- **Status:** 完了。2026-09-02 に `4d53d30` を `main` へ push し、
  本番 `/api/health` の `build: 4d53d309` と実画面を確認した。
- **Current owner:** Codex / **Handoff readiness:** ready
- 通常カルーセルの暗い写真下地が、写真下の名前欄まで黒く塗っていた。
  暗い下地を写真枠だけへ移し、名前はサイトの紙面上へ戻した。
- フルスクリーンのカルーセルは、名前を写真内へ移し、位置設定と暗い
  グラデーションを1枚絵と同じように反映する。画像も `cover` で表示する。
- 明暗テーマで同じ保存色を使って名前が沈む場合だけ、AAを満たす色へ補正する。
  読み込み中の高さと写真到着後の高さ、矢印と写真中央の位置も揃えた。
- 2026-09-02 の確認: `bun run check` exit 0、`bun run smoke` exit 0。
  HERO 5種をPC・タッチ端末、ライト・ダーク、通常・全画面の24状態で実測。
  本番デモでも通常は名前が写真外、全画面は写真内になることを確認した。
- 本番DB・Turso・R2・Railway設定・環境変数は変更していない。

### 残件

- 今回のHERO修正に残作業なし。
- 既知の `public-scroll-stability` は全体smoke内で1回再試行になったが、
  同一実行内で合格。従来どおり別タスク扱い。
</details>
<!-- CURRENT_STATE_END -->

<details>
<summary>直前の状態（検索の流入強化・第1回）</summary>

## Previous State — 2026-09-02 JST（検索の流入強化・第1回 完了）

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
</details>

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
