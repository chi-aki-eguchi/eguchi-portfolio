# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-24 JST（11回目）

- **Status:** admin の列数を2〜6へ。**push 済み**（`7768356`）。本番未確認。
  **次はオーナー依頼の「admin の無駄な余白を減らす」。未着手。**
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF`

### 完了（`7768356`）

Library の列数を 2/3 → **2〜6** から選べるようにした。同時に見つけた2件も修正。

| 端末幅 | 前 | 後 |
|---|---|---|
| 390px | 3列まで | **6列（1枚51px）** |
| 820px | **1列** | **6列（107px）** |
| 1024px | 2列 | **6列（139px）** |

- **丸めで列が落ちていた。** グリッド実幅 683.53px を `clientWidth` が 684 と
  返し、そこから出した2列ぶんのタイルが 0.24px 太くなって auto-fill が1列へ。
  列数を選んだときは `repeat(N, minmax(0,1fr))` を敷いて数え直させない
- **CSS・矢印キー・仮想スクロールが別々に数えていた**（実際に食い違い、↑↓ が
  違う行へ飛ぶ）。`libraryColumnCount()` に一本化。幅だけその場で測る
  （state 経由だと resize 直後に古い列数で動く。render テストが検出）
- **効くのはタッチ端末なのに、ボタンは `md:hidden` だった。** タブレットでは
  効かないスライダーだけが見えていた。ポインタ種別で出し分け

### 次の作業：admin の余白（依頼内容）

「無駄な余白を減らす。ギチギチにはしない。オシャレは残す。PCも」

**測った数値:**

```
.ax-page  padding: 上 clamp(28,3.4vw,52)px / 左右 clamp(20,3.2vw,44)px / 下 96px
--ax-gap-page: 40px（節と節） / --ax-gap-block: 20px（節の中）
```

- **下の96pxは無駄ではない。** 保存バーが `sticky; bottom:18px`（高さ約78px）
  で、詰めると最後の行が隠れる。**ただし保存バーが出ないタブでは丸ごと空く**
- 余白トークンは定義されているのに**使用は8箇所だけ**。大半は個別指定
- **未実施:** タブごとに「上端→最初の操作」「最後の要素→下端」を実ブラウザで
  測る。印象で詰めると窮屈になるので、測ってから

### 検証

- `bun run check` = **1095 pass / 0 fail（EXIT=0）**
- `bun run smoke` = **331 passed（EXIT=0）**
- 実ブラウザで390/820/1024px の列数と横あふれ0を確認

### この回の誤り（記録）

- 「作業バーの1行がタップできない」と報告したが**誤り**。閉じた `<details>`
  の矩形を測って誤判定した。開けば押せる
- `getBoundingClientRect` を優先する変更を入れたら、jsdom で**他のテストが
  仕込んだ rect のモックを拾って**2件落ちた。戻した

### 触ってはいけない範囲

- 本番DB・Turso・R2・Railway・環境変数
- `shotAt` の保存方法、公開API応答形、Lightbox の既存ロジック
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
