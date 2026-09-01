# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-09-01 JST（検索に引っかかるようにする・第1回）

- **Status:** 販売ページの構造化データと題、Work 棚の 404、非JSクローラ向けの
  本文とリンク。**push 済み・本番反映済み。**
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `22ace9e`

### やったこと

| commit | 内容 |
|---|---|
| `4958643` | **Work 棚に置いた1本が 404・noindex で返る**状態だった（本番にまだ work 棚が無いので未発症）|
| `e1212d7` | 販売ページに **Product + Offer**（値段は servicePageConfig から読む）と FAQPage |
| `69e466f` | B-25 を backlog へ |
| `3778857` | 題と説明を**作品を主語にした文**へ（オーナー判断）|
| `22ace9e` | **JSを実行しないクローラに本文とリンクを渡す**（リンクが0本だった）|

### 検証

- `bun run check` = **1174 pass / 0 fail**（exit 0）
- `bun run smoke` = **353 passed / 0 failed**（2 flaky・147 skipped・14.8分）
  flaky は `public-scroll-stability` の2件。**今回の変更の前から同じ所が
  たまに落ちる**（今朝の基準線でも同じ1件が落ちて再試行で通った）。

**smoke は OGP/noscript の差し込みを一度も通っていない。**smoke の webServer は
`bunx vite`（dev server）で、HTML は Vite が返す。`server.ts` の差し込みは
本番の経路にしか無いので、そこはユニットテストと、`dist/index.html` を実際の
関数に通す手動確認で見た（`api/ogp.test.ts` `api/spa-fallback.test.ts`）。

### 次の一手

**B-25 の残り半分（backlog）。Google には今回の分は効かない。**Google は JS を
実行するので、そちらへ本文を届けるには本物の SSR（`renderToString` と
サーバ側のデータ取得、クライアントは hydrate へ）が要る。アプリの返し方を
作り直す話なので、独立した区切りで。

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
