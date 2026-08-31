# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-31 JST（動きの直し・2巡目）

- **Status:** 公開サイト＋ライトボックス＋admin の動きを直した。**push 済み。**
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF`
- push 状況の測り方: `git rev-list --left-right --count origin/main...HEAD`

### やったこと

| commit | 内容 |
|---|---|
| `5877091` | **公開サイト**: 長さではなくカーブが原因だった。`--ease-reveal` 新設 |
| `5dcec3d` | 前の Current State を archive へ |
| `ce2dc63` | **ライトボックス**: 入れ替わりは1回ではなく**3か所**だった |
| `bbbec72` | **admin**: 知覚の閾値を下回っていた量を、読める量まで上げる |

**通底する発見: 直すべきは duration ではなかった。**公開サイトは前のめりの
カーブが時間を見えない所へ捨てていた。admin は量が小さすぎた（段差 20ms＝
60Hz で1.2フレーム）。ライトボックスは DOM から外していて transition が
そもそも走れなかった。**どれも「長さを足す」では直らない。**

    90%到達（実測）        前     後
      写真1枚             333ms  615ms
      節・ページ・帯       258ms  483ms
      ぼけが晴れる         264ms  750ms
      admin 画面切替       150ms  218ms（6px → 10px）
      admin 作業バー        82ms  150ms

### 検証

- `bun run check` = **1146 pass / 0 fail（EXIT=0）**
- `bun run smoke` = **351 passed / 0 failed（EXIT=0）**
- `public-motion-tempo.spec.ts` 新設。**前のめりなカーブへ戻すと落ちることを
  一度戻して確認済み。**本番（akieguchi.com）でも5件通過を確認した
- `public-scroll-stability.spec.ts` の「画面が空にならない」を締めた
  （並んでいるかだけ数えていたので、全部透明でも通っていた）
- **admin の見た目はオーナー未確認。**数値は測ったが、目で見ていない

### 次にやること

- **オーナーが admin と本番を見る。**動きの好みはここでしか決まらない
- 公開側で残っている「押した反応」は速いまま（意図どおり）。`lb-in` 0.5s、
  hover 系 `--ease-quart`。**ここを伸ばすと鈍く感じるので、伸ばすなら要相談**
- **案1: プレビューを Settings 以外のタブへも広げる。**承認済み・未着手。
  幅の記憶・分割線・live sync が Settings タブに埋まっている。まとめて取る
- オーナーの実地確認2件: Stripe 決済導線（B-2）／取り込み目印（第1A）

### 触ってはいけない範囲

- 本番DB・Turso・R2・Railway・環境変数・`.env`
- `shotAt` の保存方法、公開API応答形
- Lightbox は 2026-08-31 にオーナー承認で触れた。**次も承認が要る**
- 動きの正本は `docs/specs/design-spec.md` §6。**duration ではなく
  「目に見えている時間」で決める**（測り方も同節）
<!-- CURRENT_STATE_END -->
<!-- CURRENT_STATE_END -->
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
