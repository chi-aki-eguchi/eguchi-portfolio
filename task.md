# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-09-01 JST（検索に引っかかるようにする・第1回）

- **Status:** 販売ページの構造化データと題、Work 棚の 404 を直した。
  **commit 済み・push は未実施（本番未反映）。**
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `3778857`

### やったこと

| commit | 内容 |
|---|---|
| `4958643` | **Work 棚に置いた1本が 404・noindex で返る**状態だった（本番にまだ work 棚が無いので未発症）|
| `e1212d7` | 販売ページに **Product + Offer**（値段は servicePageConfig から読む）と FAQPage |
| `69e466f` | B-25 を backlog へ |
| `3778857` | 題と説明を**作品を主語にした文**へ（オーナー判断）|

### 検証

- `bun run check` = **1159 pass / 0 fail**（exit 0）
- `bun run smoke` = **355 passed / 0 failed**（147 skipped・13.4分）

### 次の一手

**B-25（backlog）。`<body>` が 481 バイトしかない。**`<head>`（title /
description / canonical / JSON-LD / sitemap）は揃っているので、残るのは本文。
Google は JS を実行するが、他のクローラの多くは実行しない。シリーズの
statement もプロフィール文も、それらには一語も見えていない。

**判断待ち:** push（本番反映）。文面はオーナーが 2026-09-01 に決めた
（`写真を置く場所をつくる | 写真家のポートフォリオサイト`）。

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
