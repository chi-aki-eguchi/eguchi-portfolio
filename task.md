# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-23 JST（8回目）

- **Status:** `/assets/*` が**誰にも圧縮されていなかった**のを実測で見つけ、
  origin 側で brotli/gzip を付けた。**push 済み・本番反映確認済み**（`488d9070`）。
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF`

### 完了

1. `3895c8d` — `api/http-compression.ts` を新設し `server.ts` の非API応答を通した
2. `4ce02db` — `/api` も通した。`Set-Cookie` を持つ応答には触れない
3. `488d907` / 訂正commit — 規則と記録を実測に合わせた

### 本番の実測（`488d9070` 反映後）

| 資産 | 変更前 | 変更後 |
|---|---:|---:|
| `/assets/` の初回5本（CSS+JS） | **687,662** | **161,722**（br・76%減） |
| HTML `/` | 2,375（edgeのgzip） | 2,059（br） |
| `/api/photos` | 21,847（edgeのgzip） | 17,448（br） |

**訂正:** 当初「HTMLもAPIも非圧縮」と報告したが誤り。Railway の edge は
HTML と `/api` を gzip で圧縮していた。**していなかったのは `/assets/*` だけ**
（immutable でedgeにキャッシュされる分）。誤読の原因と正しい測り方は
`docs/agents/measuring.md`「圧縮を測るときは」に記録した。
効果の大半は `/assets/*` の 525,940 バイト。API 側は br と gzip の差だけ。

### 検証

- `bun run check` = **1050 pass / 0 fail** / `bun run smoke` = **331 passed / 0 failed**
- 本番の `/` と `/gallery` を実ブラウザで確認。表示は変わらず console エラー0。
  二重圧縮は起きていない
- smoke は vite dev サーバ相手で **`server.ts` を通らない**。回帰確認であって
  圧縮の証明ではない（本番DB無しで server.ts を起動する手順は `measuring.md`）

### 次の一手

- backlog B-21（経路チャンクが `modulepreload` されない）。Vite の
  build manifest を出す設定から要る
- wiki の鮮度警告 残り8件

### オーナー判断待ち

- 既存2件のみ（archive の管理パスワード平文 / `kill -9` 禁止）

### 触ってはいけない範囲

- 本番DB・Turso・R2・Railway・環境変数
- `shotAt` の保存方法、公開API応答形、Lightbox の既存ロジック
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
