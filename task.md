# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-07 JST

- **Status:** 「つまみを回しても見た目に出ない」不具合の一掃。**8件修正・commit 済み**
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF` / **Git:** `1fd6b5d` まで local commit 済み。
  push は未実施。未追跡は `scripts/smoke/scratch/`（以前からある調査用）

### 目的と完了条件

管理画面が出す値が、必ず公開サイトの見た目に出ること。出ない値をつまみに出さないこと。
出ないものを「出る」と書かないこと。設計の正本は `docs/specs/design-freedom-plan.md` §D。

### 完了したこと

1. **列数が届かない**（`0f9cb8c`）。枠が928px固定で5〜8列が出せなかった。
   `galleryFrameWidth()` が指定列数に必要な幅まで枠を広げる
2. **範囲のずれ5件**（`a923995`）。写真の大きさ3.0→実際2.0 / 余白倍率5.0→実際3.0
   （各ギャラリー・トップ）/ シリーズ列数8→実際6。範囲を
   `shared/setting-ranges.ts` へ集約し、管理画面と実行時clampが同じ表を読む
3. **二重clamp1件と、嘘の見出し1件**（`1fd6b5d`）。`buildGalleryLayout` が
   抜け頻度を0.3へ切り戻していた（管理画面は0.4）。**キー名がその場に無いので
   範囲チェックからは見えない種類**。見出し「モザイク／コラージュだけの調整」は
   collage が両方読んでいないため「モザイクだけの調整」へ

### 調べて「問題なし」と分かったもの（再調査しないため記録）

- 許可リスト157キーに、読む側が無いキーは**ゼロ**
- レイアウト選択肢12種と `KNOWN_LAYOUTS` 12種は**完全一致**。`seriesLayout` も
  `series-detail.tsx` が読んでいる
- プレビューの4箇所同期は問題なし。CSS変数以外は
  `qc.setQueryData` で一括ミラーされる（個別適用が無いのは正常）
- `lib/` の clamp は他に `tileWidth` の 0..1 だけで、範囲と一致

### 検証の状態

- `bun run check` **成功**（794 pass / 0 fail、exit 0）
- 回帰テスト18件。**すべて修正を戻すと落ちることを個別に確認済み**
- 実ブラウザ実測: ギャラリー1900pxで4列→**8列**、1200pxで枠988px・4列、
  スマホ375pxは枠を広げず2列。トップWorks 8列。コンソールerrorなし
- smoke: `admin-selected-button` + `admin-form-layout`(desktop) **7 passed**。
  **全体は未再実行**（25分・週枠が少ないため）。全体には既存失敗18件があり、
  今日の変更が原因でないことは stash 比較で確認済み → `backlog.md` の **S-1**
- local commit 済み / push・Railway反映・本番確認は**未実施**

### 次の一手

- **オーナー判断: collage に抜け頻度・サイズの緩急を効かせるか**（見た目が変わる）
- **オーナー判断: admin のフォントが公開サイトに追従**（a切離す/b見出しだけ/c現状維持）
- S-1（smoke既存失敗18件）の切り分け

### 触ってはいけない範囲

- `git push`（オーナーだけ）/ 本番DB / Turso / R2 / Railway / 環境変数 / `.env`
- smoke は本番と同じDBにつながる。**書き込み操作を増やさない**
- 範囲を `setting-ranges.ts` 以外へ数値で書き戻さない（テストが落ちる）
- `admin-login.tsx` の `.admin-login` は意図的に公開サイトの色へ追従している
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
