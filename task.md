# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-05 JST

- **Status:** 公開サイトの全体デバッグを実施。**「設定しても反映されない」の主因を修正**。
  commit 済み・push 未実施
- **Current owner:** Claude Code（停止中）
- **Branch:** `main` / **HEAD:** `SELF` / **origin/main:** `03d22c3` より 3 commits ahead
- **Git:** clean（未追跡は `scratch/` のみ・gitignore 対象）

### 目的と完了条件

オーナー報告「settings で実際には反映されない項目が多い / 文字が枠の外に出る」。
完了条件は、**admin のどのスライダーも、選んだレイアウトに関係なく効く**こと。

### 今回直したこと（実測で確認済み）

原因は一つ。**後から足したレイアウトが、寸法・色・列数・余白を自前の定数で
書いていた**ため、admin を動かしても何も起きなかった。

- Hero の quiet-grid / editorial / immersive → 共通 `HeroNameBlock` に集約。
  名前・EN名・カタカナ・サブタイトルの大きさ/太さ/字間/色と `heroHeight` が効く。
  写真の上に載る tone だけ色指定を無視して白のまま（可読性。既定ヒーローと同じ規則）。
- `worksLabel` / `viewAllLabel` → `WorksHeader` に集約し、全ヒーローモードで出る。
- ギャラリーの masonry / clean-grid / large-format → 列数・余白が効く。
  **各レイアウトの従来値を「未設定時の既定」にしたので、見た目は触るまで変わらない。**
- `sectionLabelOpacity` → `--section-label-color` を新設し全ページのラベルに適用
  （従来は Series ページ1箇所だけ読んでいた）。
- admin の説明文「下の調整は『モザイク』に効きます」は事実と違ったので修正。

**オーナーの現在値では見た目が変わる**（heroMode=editorial / galleryLayout=masonry）:
ヒーローが100vh・名前が太さ700・サブタイトル表示・Works が5列・View all が出る。

### 調べたが**バグではなかった**もの

- 各ページの meta description → dev サーバは OGP 注入をしないだけ。`injectOgp` は正しい
- `line-clamp-2` が効いていないように見える → Chrome が `display` を `flow-root` と
  報告するだけで、実際は効いている
- 閉じた状態のモバイルメニュー → `inert` 済み
- 文字のはみ出し → 公開5ページ×3画面幅で0件。admin も実害なし（2px の丸め誤差のみ）

### 次の一手

1. **オーナーが実際の見た目を確認する。**太さ700・100vh が意図と違えば admin で戻せる
   （もう本当に効くので）。
2. push するか判断する（**push はオーナーだけ**）。
3. 残りは `docs/agents/backlog.md`。今回 B-15（`.env` の二重定義）と
   B-16（smoke の flaky）を追加した。
4. B-1（グローバルCSSの上書き）は継続中。一括移行はしない。

### 検証の状態

- `bun run check` **成功**（674 pass / 0 fail。回帰テスト19件を追加）
- 追加した回帰テストは**修正を戻すと4件落ちる**ことを確認済み
- `bun run smoke` **285 passed / 1 failed**。落ちたのは
  `admin-workspace-layout.spec.ts:99`。**単体で流すと通る = flaky**（B-16）
- 設定155キーを `/api/settings` 差し替えで総当たり検証（DBへは一切書いていない）
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
