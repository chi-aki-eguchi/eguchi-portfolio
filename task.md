# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-31 JST（動きの直し・完了）

- **Status:** 動きの直し一巡。**push 済み・本番反映済み（`f58c596`）。**
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF`

### いちばん大事なこと（次に同じ轍を踏まないため）

**オーナーの Mac で「視差効果を減らす」が ON だった。**6回モーションを直して
6回とも「変わってない」と言われた原因はこれ。`prefers-reduced-motion: reduce`
の一括規則が全アニメを 0.01ms にするので、**届いていた上で無効化されていた。**

**画面がどこかだけでなく、そのブラウザがどう描画する設定かを確かめる。**
確かめ方: そのブラウザで `matchMedia('(prefers-reduced-motion: reduce)').matches`。

**未着手の判断:** いまの実装は `*` に一括で 0.01ms を掛け、移動だけでなく
静かなフェードまで消している。設定の目的は「移動」を避けることなので、
**フェードは残し移動だけ消す**形にできる。同じ設定の訪問者全員に効く。

### やったこと（commit）

| commit | 内容 |
|---|---|
| `5877091` | カーブが時間を見えない所へ捨てていた（`--ease-reveal`）|
| `ce2dc63` | ライトボックスの入れ替わり3か所 |
| `bbbec72` `fab5804` | admin。**名乗っている仕事をしていない段差を外す** |
| `490a227` | 開いた瞬間、器ではなく写真から |
| `89d460e` | 尺を上げ、ヒーローに寄り引き |
| `afe642e` | **「触った反応は速いまま」という判断そのものを撤回** |
| `3e620d6` | ヒーローを透けた幽霊ではなく不透明で出す |
| `f58c596` | **全画面のぼけを外す**（カクつきの出所）／現れ方の方向を4つ追加 |

### 検証

- `bun run check` = **1146 pass / 0 fail** ／ `bun run smoke` = **351 passed / 0 failed**
- 本番実測: コマ 413中 32ms超 **0コマ**（前は76コマ中13コマ落ち）
- `public-motion-tempo.spec.ts` が尺を見張る（前のめりなカーブへ戻すと落ちる）

### 次にやること

- **`prefers-reduced-motion` でフェードだけ残す**（上記・未着手）
- 柔らかい出方が要るなら「ぼけた複製を重ねて opacity で入替」（ぼけは1回だけ描く）
- **B-23**: `/gallery` の骨組みが 61px 押し下げられる。出所まで測ってある
- **案1: プレビューを Settings 以外のタブへ。**承認済み・未着手

### 触ってはいけない範囲

- 本番DB・Turso・R2・Railway・環境変数・`.env` / `shotAt` / 公開API応答形
- Lightbox は 2026-08-31 にオーナー承認で触れた。**次も承認が要る**
- 動きの正本は `docs/specs/design-spec.md` §6。**duration ではなく
  「目に見えている時間」で決める**。**全画面に `filter` を animate しない**
<!-- CURRENT_STATE_END -->
<!-- CURRENT_STATE_END -->
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
