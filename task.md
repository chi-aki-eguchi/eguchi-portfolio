# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-07 JST

- **Status:** 「つまみを回しても見た目に出ない」不具合の一掃が完了。
  **保留していたオーナー判断2件も、委任を受けて決定・実装済み**
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF` / **Git:** `4c38ec1` まで local commit 済み。
  push は未実施。未追跡は `scripts/smoke/scratch/`（以前からある調査用）

### 完了したこと

1. **列数が届かない**（`0f9cb8c`）。枠が928px固定で5〜8列を出せなかった。
   `galleryFrameWidth()` が指定列数に必要な幅まで枠を広げる
2. **範囲のずれ5件**（`a923995`）。範囲を `shared/setting-ranges.ts` へ集約し、
   管理画面と実行時clampが同じ表を読む形にした
3. **二重clamp1件と嘘の見出し1件**（`1fd6b5d`）。`buildGalleryLayout` が抜け頻度を
   0.3へ切り戻していた（管理画面は0.4）。**キー名がその場に無く範囲検査から見えない種類**
4. **書体の切り離し**（`4c38ec1`・オーナー委任で案(a)採用）。あわせて smoke の
   撤回済み契約を直し、**flaky の原因（`isVisible()` が待たない）も修正**

### 決定したこと（もう判断待ちではない）

- **collage に抜け頻度・サイズの緩急は効かせない。** 重なりで作る山に空セルを
  入れると欠落に見え、既存サイトの見た目も黙って変わる。嘘の見出しは直したので実害なし
- **admin の書体は全部切り離す（案a）。** title は h2/h3 と uppercase 全部に
  当たるため、案(b)では読みにくさが残る。**本文は明朝→ゴシックに実際に変わる**

### 検証の状態

- `bun run check` **成功**（797 pass / 0 fail、exit 0）
- 回帰テスト21件。**すべて修正を戻すと落ちることを個別に確認済み**
- 実ブラウザ実測: ギャラリー1900pxで4列→**8列**、1200pxで枠988px・4列、
  スマホ375pxは枠を広げず2列。書体は title=Cormorant Garamond / ui=Hiragino Sans
- smoke: `admin-debug-sweep`（desktop+mobile）の書体・色の検査は**通過**。
  mobile は40秒タイムアウト→17.6秒。`admin-selected-button` `admin-form-layout` も通過
- **smoke 全体は未再実行**（25分・週枠が少ない）。既存失敗の残りは admin Library の
  2件で、今日の変更が原因でないことは stash 比較で確認済み → `backlog.md` の **S-1**
- local commit 済み / push・Railway反映・本番確認は**未実施**

### 次の一手

- **オーナーが push する。** 本番反映後、管理画面の本文がゴシックになることを確認
- S-1（admin Library の smoke 失敗2件）の切り分け。flaky 修正後の全体数は未測定
- 着手順3（テイストのプリセット）。ただし `design-spec.md` §9 の衝突1の判断が要る

### 触ってはいけない範囲

- `git push`（オーナーだけ）/ 本番DB / Turso / R2 / Railway / 環境変数 / `.env`
- smoke は本番と同じDBにつながる。**書き込み操作を増やさない**
- 範囲を `setting-ranges.ts` 以外へ数値で書き戻さない（テストが落ちる）
- `.admin-login` は「扉」として意図的に公開サイトの色・書体へ追従している
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
