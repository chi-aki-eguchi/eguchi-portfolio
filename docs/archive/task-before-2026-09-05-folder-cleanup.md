# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-09-05 JST（公開サイト・収益化基盤の改善をローカル完了）

- **Status:** 実装とローカル検証は完了。未commit・未push・未deployで、本番は未変更。
- **Current owner:** Codex / **Handoff readiness:** ready（公開前に下記オーナー確認が必要）
- 写真詳細ページを追加し、固有題と十分な説明がある代表作だけを検索対象・
  sitemap対象にする。薄い写真は共有できるが `noindex, follow` のままにした。
- 空のWorkはSeriesへ案内し、`/profile` はAboutへ正規化。HERO画像を画面幅に
  合わせて配信し、無駄なフォント取得とランダムHEROの誤った先読みを止めた。
- Privacy・利用条件・販売条件を日英で追加。販売者名・税・キャンセル・返金が
  未確認の間はPortfolio Kitの直接決済を出さず、Contactで確認する安全な導線にした。
- 公開英語ページと共通UIの日本語混在を解消。問い合わせ・言語切替・Kit導線・
  SPA遷移を個人情報なしでGA4計測し、実在しない詳細URLは計測しない。
- 管理画面の保存後に公開側キャッシュを更新し、古いHERO・Gallery・Series・
  Work・写真詳細が残らないようにした。
- 2026-09-05 の確認: `bun run check` exit 0（1289 pass / 0 fail）、
  `bun run smoke` exit 0（358 passed / 149 skipped / 0 failed / 0 flaky）。
  目視用6画面も撮影し、公開8ページのCLSは最大0.047（基準0.1未満）。
- 本番DB・Turso・R2・Railway・環境変数・課金・公開設定は変更していない。

### 残件

- Portfolio Kit公開前に、販売者の正式名称、住所・電話の表示または請求時開示手順、
  3万円の税込/税別、工程別キャンセル・返金条件、施行日をオーナーが確定する。
- 問い合わせ送信サービス名、保存期間、削除手順を確認しPrivacyへ反映する。
- 公開する場合は、既存の未コミット作業と分けて内容を確認してからcommit/pushする。
<!-- CURRENT_STATE_END -->

## 2026-09-05 12:39 JST 追記 — Portfolio Studio連携は別worktreeから本番公開済み

- 上の「未commit・未push・未deploy」は既存のローカル改善分の状態。別依頼で
  `origin/main` 基点の `/tmp/aki-studio-integration.PsMfDs` を作り、Portfolio Studioへの
  所有者サイト限定の導線だけを実装・pushした。元の未コミット変更は保持している。
- 本番は `02690153`。`/api/health` の build と status ok、PC・390px画面で確認。
  ナビのPortfolio Kit、販売ページ冒頭とプラン比較、所有者サイトのフッターから
  <https://photo-work-pricing.chi-aki-18.chatgpt.site/> へ接続している。
- 公開済みcommitは `df4e7f9`、`6c90c6a`、`0269015`。このローカルmainは現時点で
  origin/mainに対しahead 1 / behind 3。未コミット作業と同じLayout・service・テストが
  重なるため、次回は公開済みの導線を保持して統合する。強制push・reset・checkoutで消さない。
- 最終 `bun run check` はexit 0（1225 pass / 0 fail、tools 56 pass）。途中は
  所有者ナビ表示を変えた旧期待値で1件失敗し、期待値とoff/購入者サイト回帰テストを修正した。
  今回はAdmin変更なし。既存の358件smoke結果は上のローカル改善分の検証であり、今回の実行結果ではない。
- Studioの69,800円はKit分を含む総額で追加30,000円ではない。購入者へ配るKitでは
  `isServiceOwnerSite` によりStudio広告を表示しない。明示的サービスoffも保持する。
- Studio本番v10では、無料相談の保存→ブラウザー経由Formspree通知→実際の受信箱到着を確認。
  新商品の決済、本人の販売者情報・正式条件、実顧客の有料受注は未完了。
- 本追記は引き継ぎ用のローカル文書変更。元の未公開改善分はcommit/pushしていない。

記録者: Codex

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
