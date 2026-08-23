# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-23 JST（8回目）

- **Status:** 公開サイトの応答が**一切圧縮されていなかった**のを実測で見つけ、
  origin 側で brotli/gzip 圧縮するようにした。**commit 済み・push 未実施。**
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF`

### 完了（`3895c8d`）

1. `packages/web/src/api/http-compression.ts` を新設し、`server.ts` の
   非API応答すべてを通した。`Content-Encoding` を付けるのはこの1箇所だけ
2. `AGENTS.md` と `docs/checklists.md` の該当規則を、実測に合わせて書き直した

### なぜ直したか（実測）

本番 build `6606ff3f` へ `Accept-Encoding: gzip, br` 付きで GET すると、
`content-encoding` も `vary` も無い**平文**が返っていた。初回表示に要る5資産で
合計 687,662 バイト。「Railway プロキシが圧縮する」という文書の前提が誤り。

| 資産 | 変更前 | brotli | gzip |
|---|---:|---:|---:|
| index.css | 183,672 | 26,873 | 29,975 |
| react-vendor.js | 365,865 | 97,929 | 110,810 |
| HTML(`/`) | 約 6,187 | 1,563 | — |

初回表示 687,662 → 約 163,500 バイト（約 76% 減）。

### 検証

- `bun run check` = **1048 pass / 0 fail**（新規テスト20件を含む）
- 本番ビルドを Bun サーバで配信して curl と実ブラウザで確認。
  brotli/gzip とも**復号がソースとバイト一致**。PNG は非圧縮のまま。
  `identity` 要求には平文＋`Vary` を返す。HTML の `no-store` は不変
- **本番未確認**（push していないため。反映後に上の curl をもう一度回す）
- `bun run smoke` = **330 passed / 0 failed**（145 skipped）。ただし smoke は
  vite dev サーバ相手で `server.ts` を通らない。**回帰が無いことの確認であって、
  圧縮が効いていることの証明ではない**

### オーナー判断待ち

- **この commit を push してよいか。** `AGENTS.md` の不変条件
  「`Content-Encoding` を手動設定しない」を書き換える変更のため、
  check が通っていても独断で push しない
- 既存の2件（archive の管理パスワード平文 / `kill -9` 禁止）は変化なし

### 次の一手

- push 可否の回答待ち。可なら push → 本番で `curl -sI` を再測定
- **残作業:** `/api/*` は未圧縮のまま（`/api/photos` が 21,847 バイト）。
  Hono の Set-Cookie 素通しを壊さない形（Set-Cookie が無い GET だけ圧縮）で
  足せるが、**ローカルでは本番DB無しに admin ログインを通せず検証できない**
  ため今回は入れていない
- wiki の鮮度警告 残り8件

### 触ってはいけない範囲

- 本番DB・Turso・R2・Railway・環境変数
- `shotAt` の保存方法、公開API応答形、Lightbox の既存ロジック
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
