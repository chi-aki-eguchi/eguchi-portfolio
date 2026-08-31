# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-31 JST（開いた瞬間）

- **Status:** 開いた瞬間の順番を直した。**push 済み。本番反映は未確認。**
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF`

### やったこと

| commit | 内容 |
|---|---|
| `5877091` | **公開**: 長さではなくカーブが原因。`--ease-reveal` 新設 |
| `ce2dc63` | **ライトボックス**: 入れ替わりは1回ではなく**3か所**だった |
| `bbbec72` `fab5804` | **admin**: べた書きを目盛りへ／**名乗っている仕事をしていない段差を外す** |
| `490a227` | **公開**: 開いた瞬間、器ではなく**写真から**始まるようにする |
| `935d201` | backlog B-23（ズレの出所を名指し） |

**開いた瞬間の実測（本番・1440px・キャッシュ無し）。ここが天井だった:**

    184ms  ナビが一瞬で出る（「TOP」明朝・薄い）
   ~500ms  ナビが書き換わる（「AKI EGUCHI」ゴシック・太い）
    553ms  ようやく写真がフェード開始
  ~1000ms  ナビに「Series」が増える

**最初の半秒に出ていたのは、自分を組み立て直しているナビだった。**
器が整うまで器を出さない形にし、写真→器の順にした。**写真の到着は1msも
遅らせていない。**計測上の「最初の描画」だけ 184→550ms 付近へ後ろへずれる。

### 検証

- `bun run check` = **1146 pass / 0 fail（EXIT=0）**
- `bun run smoke` = **350 passed / 0 failed / 1 flaky（EXIT=0）**
- flaky の1件は **B-23**。**この変更のせいではない**ことを確認済み
  （変更を外して3回とも通る／出所は `div.gallery-skeleton`、ナビは出ない）
- `public-motion-tempo.spec.ts` は本番でも通過を確認済み
- **本番の見た目はオーナー未確認。admin も未確認**

### 次にやること

- **オーナーが本番を見る。**「開いた瞬間」の好みはここでしか決まらない
- **速さの体感が落ちたと感じたら戻せる**（`site-chrome-reveal` の遅らせ 0.45s
  を縮めるか、待つ条件を「設定だけ」に緩める）
- **B-23**: `/gallery` の骨組みが 61px 押し下げられる。出所まで測ってある
- **案1: プレビューを Settings 以外のタブへ。**承認済み・未着手。まとめて取る

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
