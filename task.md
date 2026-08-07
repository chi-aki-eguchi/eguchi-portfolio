# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-07 JST

- **Status:** デザイン自由度の調査完了。**B-21（暗い表示で文字が読めない）を修正・検証済み**
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF` / **Git:** B-21 は local commit 済み。
  push は未実施。未追跡で残るのは `scripts/smoke/scratch/`（Claude の調査用）

### 目的と完了条件

公開サイトと admin の「デザインを変えられる自由度」を上げる。
オーナーの言葉: 配置・レイアウトの種類・方向性を、公開サイトでも admin でも変えたい。
**方向性の意味は「全部（テイスト / スクロール方向 / ページ別 / 写真の見せ方）」と回答済み。**

### 完了したこと

1. 参照サイト `good-web-design.com/webdesign/photograph` を調査。**解説記事ではなく
   257件の実例リンク集**。作例には色面型（強い色＋階段状の写真）があり、今の設定では到達不能
2. 現状の棚卸し（実測）: 設定キーは `shared/settings-keys.ts` の台帳、Settings は19節。
   ヒーロー5種 / ナビ位置3種 / 写真の並べ方12種 / 余白4軸 / 文字・色は既に可変
3. 到達できない3点: (a) 完成形へ一発で行く手段が無い (b) ページ構成と色の役割が固定
   (c) admin は公開サイトの色に従属（`.admin-atelier` が `--background` を継承）
4. **B-21 を修正。** 明/暗それぞれに当てる色を選び直す `lib/theme-colors.ts` を新設し、
   DB適用とライブプレビューの両方を同じ適用口へ集約。`themeBgDark` / `themeTextDark` を
   4箇所同期（台帳 / API default / provider の DB適用 / handlePreviewMessage）＋admin UI

### 検証の状態

- `bun run check` **成功**
- `bun run smoke` **成功**（306 passed / 128 skipped / 0 failed）。1回目は1件失敗し
  （`admin-live-preview.spec.ts` の `getByLabel` が新しい入力と2件一致）、
  テストを緩めず `exact: true` へ直した
- 単体テスト `theme-colors.test.ts` 7件成功。**修正を外すと3件落ちる**ことを確認済み
- 実ブラウザ実測（localhost:5173 / postMessage 経路）:
  暗い表示で `themeBg` だけ渡しても背景 `#121212` / 文字 `#e8e8e8` を維持。
  暗い色を渡せば `#101012` / `#ededed` が当たり、theme-color とテクスチャ合成も追従
- local commit **未実施** / push・Railway反映・本番確認は未実施

### 次の一手

- 自由度拡大の設計は `docs/specs/design-freedom-plan.md` に確定。
  着手順は 1) admin を公開サイトの色から切り離す 2) 写真の見せ方の振り幅
  3) テイストのプリセット 4) ページごとの方向 5) 横スクロール・縦組み
- **1 と 2 は他に依存しないので、判断待ちの間でも進められる**
- **オーナー判断待ち:** `design-spec.md` §9「色数を増やさない」を更新するか。
  色面型をプリセットに入れるかどうかで、プリセットの振り幅が変わる

### 触ってはいけない範囲

- `git push`（オーナーだけ）/ 本番DB / Turso / R2 / Railway / 環境変数 /
  公開設定 / `.env` の表示・記録 / `docs/archive/` の既存本文
- smoke は本番と同じDBにつながる。**保存・削除・追加の書き込み操作を増やさない**
- 既存の `data-admin-setting` / `data-library-*` 目印を消さない
- 同じ worktree を2人で同時に編集しない
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
