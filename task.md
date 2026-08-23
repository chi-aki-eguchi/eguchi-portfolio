# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-23 JST（8回目）

- **Status:** 公開サイトの応答が**一切圧縮されていなかった**のを実測で見つけ、
  静的・HTML・API すべて origin 側で圧縮するようにした。
  **commit 済み・push 未実施（オーナー判断待ち）。**
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF`

### 完了

1. `3895c8d` — `api/http-compression.ts` を新設し、`server.ts` の非API応答を通した
2. `4ce02db` — `/api` の JSON も通した。`Set-Cookie` を持つ応答には触れない
3. `AGENTS.md` と `docs/checklists.md` の該当規則を実測に合わせて書き直した
4. backlog へ B-21（経路チャンクが先読みされていない）、`measuring.md` へ
   「本番DB無しで `server.ts` を起動して測る手順」を追記

### なぜ直したか（実測）

本番 build `6606ff3f` へ `Accept-Encoding: gzip, br` 付きで GET すると、
`content-encoding` も `vary` も無い**平文**が返っていた。「Railway プロキシが
圧縮する」という文書の前提が誤り。測り方は `curl -sI -H 'Accept-Encoding: br, gzip'`。

| 応答 | 変更前 | brotli | gzip |
|---|---:|---:|---:|
| index.css | 183,672 | 26,873 | 29,975 |
| react-vendor.js | 365,865 | 97,929 | 110,810 |
| `/api/photos`（200件の疑似データ） | 118,748 | 2,976 | 5,667 |

初回表示の静的5資産で 687,662 → 約 163,500 バイト。**API は `no-store` なので
毎回の表示ごとに効く**（本番の `/api/photos` は 21,847 バイト）。

### 検証

- `bun run check` = **1050 pass / 0 fail**（新規テスト22件）
- `bun run smoke` = **331 passed / 0 failed**。ただし smoke は vite dev サーバ
  相手で **`server.ts` を通らない**。回帰が無い確認であって圧縮の証明ではない
- 使い捨てのローカル SQLite を作り本番ビルドを Bun サーバで配信して実測。
  brotli/gzip とも復号が**バイト一致**、ログイン→`/api/admin/me` も通る。
  **本番DBには触れていない**（手順は `docs/agents/measuring.md`）
- **本番未確認**（push していないため）

### オーナー判断待ち

- **この2つの commit を push してよいか。** 必須ゲートは3条件とも満たすが、
  `AGENTS.md` の不変条件を書き換える変更なので独断で push しない
- 既存2件（archive の管理パスワード平文 / `kill -9` 禁止）は変化なし

### 次の一手

- push 可否の回答待ち。可なら push → 本番で `curl -sI` を再測定
- backlog B-21（Vite の build manifest を出す設定から要る）
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
