# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-06 JST

- **Status:** デバッグ継続中。Claude が5巡（24件）→ Codex が「大きいバグ」12件を修正。
  **未pushの commit がある。**件数は `git rev-list --count origin/main..HEAD` で測る
- **Current owner:** 未定（次の担当者が自分を書き込んでから編集を始める）
- **Branch:** `main` / **HEAD:** `SELF` / **Git:** clean（未追跡は `scratch/` のみ）

### 次の担当者への引き継ぎ（デバッグ継続）

**やることは3つ。上から順でよい。**

1. **Codex の12件のうち未検証7件を追試する。**検証は「製品コードだけを1件ぶん
   戻して `bun test ./src` が落ちること」。**確認済み5件**: `45f4ad5` `2553903`
   `c7e2655` `1a83251` `5f8be81`。**未確認7件**: `c477384` `2051e48` `087f591`
   `a3d7017` `8343911` `f77bf49` `d7daf99`
2. **`packages/web/src/api/series-public-visibility.test.ts` を差し替える。**
   いまはソース文字列に `"schema.photos.isPublished, true"` が含まれるかを
   見ているだけで、実際の絞り込み結果を検査していない。リファクタで壊れ、
   コメントに書いても通る。**この1件だけロジックの単体テストが無い。**
3. Codex 推奨の残り（`docs/agents/codex-debug-2026-08-05.md` の表）:
   **2（API入口の共通入力検証）/ 6（画像キャッシュの版・上限・破棄）/
   8（Lightbox の srcSet 再試行と 1スワイプ=1移動）**。
   推奨5（回転時の focal point）は**オーナー判断待ち** — 90度変換するか
   中央リセットするか。

### 直近で直したもの

Codex 12件（`7c49d09..321c6b7^`）。重いのは**非公開カバー写真が公開シリーズ一覧に
出ていた**件、**同時アップロードで保存キーが衝突しうる**件、**一括操作4種が
途中まで保存される**件。Claude 24件を含む経緯は `docs/agents/codex-debug-2026-08-05.md`。

### 調査に使える道具（`scratch/debug-sweep/`・gitignore対象）

`full-sweep.mjs`（全ルート×3画面幅×light/dark）/ `interaction2.mjs`（操作系）/
`admin-mobile.mjs`・`admin-interaction.mjs` / `failure-states.mjs`（API故障・空）/
`rapid.mjs`（連打）/ `settings-final.mjs`（設定の到達性）/ `code-audit.mjs`（不変条件）。
**すべて read-only 設計**（非GETを止めるガード入り）。本番DBに書かない。

### 測るときの落とし穴

**正本は `docs/agents/measuring.md`。着手前に読む。**
特に、Current State へ「すぐ古くなる値」（ahead件数・push状況）を書かないこと。
`check-handoff-freshness.mjs` が弾く。2026-08-05 に Codex を4回止めた原因。

### 検証の状態

- `bun run check` **成功**（exit 0）
- `bun run smoke` は 2026-08-05 の Claude 分までは成功（303 passed）。
  **Codex の12件を入れたあとは未実行**。本番DBにつながるので実行判断は慎重に
- **Railway 反映と本番での確認は未実施**

### 触ってはいけない範囲

- `git push`（オーナーだけ）/ 本番DB / Turso / R2 / Railway / 環境変数 / 公開設定 /
  `.env` の表示・記録 / `docs/archive/` の本文
- Lightbox は「壊さない」対象（触るなら `docs/checklists.md`）。写真の並べ替えは
  `photo-reorder-safety.ts` の競合検知を壊さない
- 同じ worktree を2人で同時に編集しない（2026-08-05 に違反して Codex を止めた）
- 週枠が両者とも少ない。**範囲を縮めず1区切りを小さくして都度 commit**
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
