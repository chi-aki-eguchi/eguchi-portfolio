# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-05 JST

- **Status:** 公開サイト全体のデバッグ一巡。**「設定が効かない」系4件・写真が出ない1件・
  タップ判定1件を修正**。commit 済み・push 未実施
- **Current owner:** Claude Code（停止中）
- **Branch:** `main` / **HEAD:** `SELF` / **origin/main:** `03d22c3` より 7 commits ahead
- **Git:** clean（未追跡は `scratch/` のみ・gitignore 対象）

### 目的と完了条件

オーナー報告「settings で反映されない項目が多い / 文字が枠の外」。
完了条件は、**admin のどのつまみも、選んだレイアウトに関係なく効く**こと。

### 直したこと（すべて A/B で「戻すと壊れる」ところまで確認済み）

| # | 症状 | 原因 |
|---|---|---|
| 1 | Hero の文字サイズ・色・高さが効かない | editorial/quiet-grid/immersive が自前の定数を持っていた |
| 2 | ギャラリーの列数・余白が効かない | masonry/clean-grid/large-format が自前の定数を持っていた |
| 3 | セクションラベルの濃さが効かない | Series ページ1箇所しか読んでいなかった |
| 4 | **ナビの濃さが効かない** | `.nav-pos-left` の `!important` が literal な alpha で上書き |
| 5 | **/gallery の写真が灰色のまま出ない** | 後から挿入されたタイルが誰にも監視されていなかった |
| 6 | **フィルタ等がタップしづらい** | `.tap-target::after` が下線の `::after` と衝突して無効化 |
| 7 | 「完了」を押しても無反応 | `finishSetup` に onError が無く失敗が握り潰されていた |
| 8 | 404 ページの文字が薄い / h1 が無い | 0.35〜0.40 の直書き |

**オーナーの現在値では見た目が変わる**（heroMode=editorial / galleryLayout=masonry）:
ヒーローが1画面・名前が太さ700・サブタイトル表示・Works が5列・View all が出る。
ナビは navOpacity=1 が効くようになったので**はっきり濃くなる**（2.35:1 → 13.9:1）。

### 調べたが**バグではなかった**もの（再調査しないこと）

- 各ページの meta description → dev サーバが OGP 注入をしないだけ。`injectOgp` は正しい
- `line-clamp-2` → Chrome が `display` を `flow-root` と報告するだけで効いている
- 閉じたモバイルメニュー → `inert` 済み。ヒットテストの 0px はその副作用
- 404 の大きな「404」と `JP|EN` の区切り → どちらも `aria-hidden`。コントラスト対象外
- 文字のはみ出し → 公開16ルート×3画面幅×light/dark で0件

### 次の一手

1. **オーナーが見た目を確認する。**太さ700・1画面ヒーローが好みでなければ admin で戻せる。
2. push するか判断する（**push はオーナーだけ**）。
3. 残りは `docs/agents/backlog.md`。今回 B-15〜B-17 を追加した。

### 検証の状態

- `bun run check` **成功**（674 pass / 0 fail）
- `bun run smoke` **成功**（295 passed / 0 failed）
- 追加した回帰テストは**修正を戻すと落ちる**ことを個別に確認済み
- 設定155キーを `/api/settings` 差し替えで総当たり検証（**DBへは一切書いていない**）
- **本番確認は未実施。** push していないため

### 触ってはいけない範囲

- push / deploy / 本番DB / Turso / R2 / Railway / env 変更（`.env` は読むだけ）
- `docs/archive/` と `docs/reports/` の**本文**（移動は可、書き換えは不可）
- 履歴文書の削除

### 記録

- 調査スクリプトは `scratch/debug-sweep/`（gitignore 対象・消してよい）
- local commit: あり / push: 未実施（origin/main は `03d22c3`） /
  Railway 反映: 未確認 / 本番確認: 未実施
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
