# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-07 JST

- **Status:** デザイン自由度の拡大。着手順1（adminの色を切り離す）完了。
  **着手順2の1件目「列数が指定どおりに出ない」を修正**
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF` / **Git:** local commit 済み。push は未実施。
  未追跡で残るのは `scripts/smoke/scratch/`（以前からある調査用）

### 目的と完了条件

公開サイトと admin の「デザインを変えられる自由度」を上げる。
設計の正本は `docs/specs/design-freedom-plan.md`。着手順は
1) adminの色を切り離す 2) 写真の見せ方の振り幅 3) テイストのプリセット
4) ページごとの方向 5) 横スクロール・縦組み。

### 完了したこと

1. **暗い表示で文字が読めない問題を修正**（`9a85073`）。適用処理は
   `lib/theme-colors.ts` へ集約
2. **`design-spec.md` §9「色数を増やす」の禁止をオーナー判断で撤回**（2026-08-07）。
   **管理画面は対象外**
3. **着手順1: `.admin-atelier` の紙とインクを公開サイトの色から切り離した**（`03f3c53`）
4. **オーナー報告「列の数が変えられない」を修正。** 最大列数8でも4列止まりだった。
   原因は保存ではなく、列数が `floor(枠の幅 / 最小タイル幅)` で決まる一方、
   枠が `max-w-5xl`（実測928px）に固定されていたこと。**枠が指定列数に合わせて
   広がるようにした**（`galleryFrameWidth()`）。設定を触っていないサイトは不変

### 検証の状態

- `bun run check` **成功**（785 pass / 0 fail、exit 0）
- 実ブラウザ実測（本番DB・ローカルdev）: ギャラリー 1900px幅で **4列 → 8列**
  （枠 928px → 1597px、横スクロールなし）。トップWorks も **8列**（枠 1345px）。
  1200px幅では枠988pxへ自動縮小し4列、スマホ375pxは枠を広げず2列で従来どおり
- **未検証:** 画面リサイズ中の追従。プレビュー用ブラウザが `resize` /
  ResizeObserver をどちらも発火させないため、この環境では確認できない。
  読み込み時の各幅は上記のとおり実測済み
- local commit 済み / push・Railway反映・本番確認は**未実施**

### 次の一手

- **オーナー判断待ち: admin のフォントも公開サイトに追従している。**
  案(a)切り離す /(b)見出しだけ借りる /(c)現状維持
- 着手順2の残り（`gallerySizeVariation` などの上限拡大、キャプション表示の設定化）

### 触ってはいけない範囲

- `git push`（オーナーだけ）/ 本番DB / Turso / R2 / Railway / 環境変数 /
  公開設定 / `.env` の表示・記録 / `docs/archive/` の既存本文
- smoke は本番と同じDBにつながる。**保存・削除・追加の書き込み操作を増やさない**
- `admin-login.tsx` の `.admin-login` は意図的に公開サイトの色へ追従している
- 既存の `data-admin-setting` / `data-library-*` 目印を消さない
- 同じ worktree を2人で同時に編集しない
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
