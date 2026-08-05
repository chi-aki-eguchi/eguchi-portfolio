# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-05 JST

- **Status:** デバッグ3巡目まで完了（設定 → 静的解析 → 操作 → **スマホadmin**）。
  合計24件を修正。**settings 155キーは全て「効く」ことを確認済み**。
  **2026-08-05 オーナーが push 済み。**Railway反映と本番確認は未確認
- **Current owner:** Claude Code（停止中）
- **Branch:** `main` / **HEAD:** `SELF` / **push状況はここに書かない** — 変わるたびに古くなるので `git status --short --branch` と `git rev-list --count origin/main..HEAD` で測る
- **Git:** clean（未追跡は `scratch/` のみ・gitignore 対象）

### 直したこと（すべて A/B で「戻すと壊れる」ところまで確認済み）

**設定が効かない系**
1. Hero の文字サイズ・色・高さ（editorial/quiet-grid/immersive が自前の定数）
2. ギャラリーの列数・余白（masonry/clean-grid/large-format が自前の定数）
3. セクションラベルの濃さ（Series 1箇所しか読んでいなかった）
4. **ナビの濃さ**（`.nav-pos-left` の `!important` が直値で上書き）

**表示されない・触れない系**
5. **/gallery の写真が灰色のまま出ない**（後から挿入されたタイルが未監視。実測268/348枚）
6. **フィルタがタップしづらい**（`.tap-target::after` が下線の `::after` と衝突し無効化）
7. 404 の文字が薄い（2.0:1）/ h1 が無い

**スマホの admin（3巡目で発見・全9タブを iPhone プロファイルで操作）**
13. **入力欄が12〜14pxで、触るたびにiOSが画面ごと拡大**（設定20欄・撮影依頼100欄）
14. JP/ENトグルが16〜20pxしか押せない（全タブに出る）
15. Library の「表示」パネルが折り返さず、列ボタン等が画面外41pxへ
16. 9〜10pxの極小文字（ラベル・タイルのバッジ）
17. **スクロール効果が carousel（既定）と3レイアウトで無効**
    （effect が null ref で諦めたまま再実行されない／fx層が無い）

**壊れた時・空の時（4巡目）**
18. **設定APIが落ちるとContactが「準備中です。」**になり連絡手段が全部消える

**操作系（2巡目で発見）**
8. **戻るとURLだけ変わって中身が前のページのまま**。/gallery へ戻っても写真0枚
9. **戻ると必ず先頭へ飛ぶ**（見ていた位置を毎回失う）
10. **モバイルメニューが Escape で閉じない**
11. **「上へ戻る」がナビの下敷きで押せない**（3つのナビ位置のうち2つ）
12. 「セットアップ完了」が失敗しても無反応

### 調べたが**バグではなかった**もの（再調査しないこと）

- meta description → dev サーバが OGP 注入をしないだけ。`injectOgp` は正しい
- `line-clamp-2` → Chrome が `display` を `flow-root` と報告するだけ
- 写真ビューアの role / フォーカストラップ / Esc → ネイティブ `<dialog>` で正しく動く
- 無限スクロールが終わらない → 公開写真が497枚あるだけ。重複も無し
- 文字のはみ出し → 公開16ルート×3画面幅×light/dark で0件

### 次の一手

0. **Codex の指摘9件の着手順をオーナーが決める**（`docs/agents/codex-debug-2026-08-05.md`）。
   R2削除・書き込みAPIに触れるものは**着手前に許可が要る**。
1. **オーナーが見た目と操作を確認する。**ヒーローが1画面・ナビが濃い・Works が5列。
   好みでなければ admin で戻せる（もう効く）。
3. 残りは `docs/agents/backlog.md`。今回 B-15〜B-22 を追加した。
   **B-19 / B-21 / B-22 は決定 → 対応完了**（2026-08-05）。B-21 は「対応しない」で決着。
   Codex 推奨のうち 1（派生画像）と 7（Serviceリンク・フォント）も実装済み。
   **残りは推奨2・3・4・6・8・9 と、推奨5（回転時のfocal point）のオーナー判断。**

### 検証の状態

- `bun run check` **成功**（674 pass / 0 fail）
- `bun run smoke` **成功**（303 passed / 0 failed）
- スマホ admin は9タブ×6観点=55項目すべて OK（iPhone 13 プロファイルで実測）
- **画面から見える範囲の**API故障・空データ 96項目、連打/高速遷移 12項目、
  シリーズ詳細と出し分けブロック 21項目 — Contact の1件を除きすべて OK。
  **API層そのものの安全性は別問題**（Codex が別経路を発見。下記）
- Codex Phase A（read-only）が未踏の7領域を調査し、**新たに11件**を報告。
  判定付きの正本は `docs/agents/codex-debug-2026-08-05.md`。うち2件は Claude が
  実測で裏取り済み（派生画像のR2孤立 / Service リンクの `safeHref` 漏れ）
- 追加した回帰テストは**修正を戻すと落ちる**ことを1件ずつ確認済み
- 設定155キーを `/api/settings` 差し替えで総当たり検証（**DBへは一切書いていない**）
- **本番確認は未実施。** push 済みだが Railway 反映と本番での確認をしていないため

### 触ってはいけない範囲

- push / deploy / 本番DB / Turso / R2 / Railway / env 変更（`.env` は読むだけ）
- `docs/archive/` と `docs/reports/` の**本文**（移動は可、書き換えは不可）
- 履歴文書の削除

### 記録

- 調査スクリプトは `scratch/debug-sweep/`（gitignore 対象・消してよい）
  `interaction2.mjs` が操作系の総当たり、`full-sweep.mjs` が全ルート走査
- local commit / push / Railway反映 / 本番確認は別物として扱う。
  **2026-08-05: オーナーが push 済み**（それ以前の全 commit が origin/main に入った）。
  Railway 反映と本番確認は**未確認**。
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
