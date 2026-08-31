# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-31 JST（動きの直し）

- **Status:** 公開サイトの現れ方を直した。**commit・push 済み。本番は未確認。**
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF`
- push 状況の測り方: `git rev-list --left-right --count origin/main...HEAD`

### やったこと（`5877091`）

**1度目（8/30）の「もっと余裕を」が効かなかった理由が分かった。長さでは
なくカーブだった。**`--ease-expo` は変化の 90% を duration の 33% で使い切る。
750→1000ms へ広げても目に見えていたのは 333ms のままで、増やした 250ms は
まるごと 97%→100% の見えない尾に入っていた。

**今回は長さを1msも足していない**（写真の読み込みを除く）。
`--ease-reveal` = `cubic-bezier(0.3, 0.12, 0.22, 1)` へ差し替え。

    90%到達（実測）      前     後    宣言
      写真1枚           333ms  615ms  1000ms（据え置き）
      節・ページ・帯    258ms  483ms   780ms（据え置き）
      ぼけが晴れる       264ms  750ms  1200ms（新設 --dur-develop）
      原寸へ落ち着く     497ms  875ms  1400ms（--dur-breathe を延長）

段差 0.075s/0.45s → 0.1s/0.55s。触った反応（hover・キャプション・絞り込み）は
`--ease-quart` のまま速い。通信もJSも変えていないので**表示の速さは無傷。**

### 検証

- `bun run check` = **1146 pass / 0 fail（EXIT=0）**
- `bun run smoke` = **351 passed / 0 failed（EXIT=0）**
- `public-motion-tempo.spec.ts` 新設。duration ではなく目に見えている時間を
  測る。**前のめりなカーブへ戻すと落ちることを、一度戻して確認済み。**
- `public-scroll-stability.spec.ts` の「画面が空にならない」を締めた。並んで
  いるかだけ数えていたので、**全部揃っているが全部まだ透明**を通していた
- **本番（akieguchi.com）は未確認。**push しただけで、目で見ていない

### 次にやること

- **オーナーが本番を見る。**動きの好みはここでしか決まらない
- **ライトボックスの仮画像→本画像がいまも「パッ」と入れ替わり**（別実装で
  フェードが無い）。「写真の読み込み」で一番目立つ場所だが、`Lightbox.tsx` は
  触らない取り決めなので保留。**やるならオーナーの許可が要る**
- **案1: プレビューを Settings 以外のタブへも広げる。**承認済み・未着手。
  `AdminSettingsPreviewPane` は独立部品だが、幅の記憶・分割線・live sync の
  payload が Settings タブに埋まっている。**途中で止めると動かない状態で
  残るので、まとめて取る**
- オーナーの実地確認2件: Stripe 決済導線（B-2）／取り込み目印（第1A）
- B-15: `.env` の食い違いは 8/31 に決着（Railway が正・複製は削除済み）

### 触ってはいけない範囲

- 本番DB・Turso・R2・Railway・環境変数・`.env`
- `shotAt` の保存方法、公開API応答形、**Lightbox の既存ロジック**
- 過去の経緯・罠は `docs/archive/task-handoffs.md` の末尾（8/31 ぶんを追記済み）
<!-- CURRENT_STATE_END -->
<!-- CURRENT_STATE_END -->
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
