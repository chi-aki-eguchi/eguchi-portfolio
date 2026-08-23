# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-24 JST（12回目）

- **Status:** admin の使いやすさとスマホの見やすさ。3件完了。
  **`acf5548` まで push 済み。最後の1件は smoke 待ちで未push。** 本番未確認。
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF`

### 完了

1. `7768356` **Library の列数 2/3 → 2〜6。** 390px で6列（1枚51px）、820px の
   タッチは**1列だったのが6列**に。丸め（実幅683.53を`clientWidth`が684と返す）
   で列が落ちていたのを `repeat(N,…)` 固定で塞ぎ、CSS・矢印キー・仮想スクロールが
   別々に数えていたのを `libraryColumnCount()` へ一本化
2. `acf5548` **admin の足元96pxを条件付きに。** 保存バーは未保存が無いとき
   DOM に存在しないのに96px空けていた。既定40px、バーが出る間だけ96px
   （`:has()`）。実ブラウザで両方確認。縦のリズムも 40/20 → 30/18
3. **（未push）スマホの小さい文字に下限。** 390px の最小文字が全ページ9pxで
   リンクだった。640px以下だけ `max()` で下支え（設定で大きくした分は通る）。
   最小 9px → **11px**。横あふれ0を8面×3幅で確認

### 残っている依頼

- **admin の使いやすさ「他のとこも。PCも」は未着手。**
- スマホの**ページ見出し `<h1>` が本文12pxより小さい11px**（階層の逆転）。
  ただし `sectionLabelSize: 11` + `pageTitleStyle` という**オーナーの設定**
  なので触っていない。「スマホだけ大きくしていい」と言われれば同じ手で直せる
- 「Photography」10px も `heroSubSize: 10` の設定

### 検証

- `bun run check` = **1098 pass / 0 fail（EXIT=0）**
- `bun run smoke` = 直近 **331 passed（EXIT=0）**。3件目は実行中
- **ゲートは必ず `> log 2>&1; echo "EXIT=$?"` で判定する**（`| tail` に
  終了コードを飲まれて赤いまま push した実績あり）

### この回の誤り

- 「作業バーの1行がタップできない」は**誤報告**。閉じた `<details>` の矩形を
  測っていた。開けば押せる
- `getBoundingClientRect` 優先の変更で、jsdom が他テストの rect モックを拾い
  2件落ちた。戻した

### 触ってはいけない範囲

- 本番DB・Turso・R2・Railway・環境変数
- `shotAt` の保存方法、公開API応答形、Lightbox の既存ロジック
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
