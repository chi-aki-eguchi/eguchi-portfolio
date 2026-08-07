# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-07 JST

- **Status:** デザイン自由度の拡大に着手。**着手順1（adminの色を切り離す）まで完了**
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF` / **Git:** local commit 済み。push は未実施。
  未追跡で残るのは `scripts/smoke/scratch/`（以前からある調査用）

### 目的と完了条件

公開サイトと admin の「デザインを変えられる自由度」を上げる。
設計の正本は `docs/specs/design-freedom-plan.md`。着手順は
1) adminの色を切り離す 2) 写真の見せ方の振り幅 3) テイストのプリセット
4) ページごとの方向 5) 横スクロール・縦組み。

### 完了したこと

1. 参照サイト `good-web-design.com/webdesign/photograph` を調査（解説記事ではなく
   257件の実例リンク集）。現状の棚卸しと到達できない点を `design-freedom-plan.md` に確定
2. **暗い表示で文字が読めない問題を修正**（`9a85073`）。明/暗で当てる色を選び直し、
   `themeBgDark` / `themeTextDark` を追加。適用処理は `lib/theme-colors.ts` へ集約
3. **`design-spec.md` §9「色数を増やす」の禁止をオーナー判断で撤回**（2026-08-07）。
   撤回したのは「選べる見た目の振り幅」であって既定値ではない。**管理画面は対象外**
4. **着手順1: `.admin-atelier` の紙とインクを公開サイトの色から切り離した。**
   結合していたのは冒頭4行だけ。明暗の追従は残している（機能を減らしていない）

### 検証の状態

- `bun run check` **成功** / `bun run smoke` **成功**（306 passed / 128 skipped / 0 failed）
- `theme-colors.test.ts` 7件・`admin-theme-independence.test.ts` 4件。
  **どちらも修正を戻すと落ちる**ことを確認済み（3件 / 2件）
- 実ブラウザ実測: 公開サイトを `#101010` にしても admin の紙は `#f7f7f7` のまま。
  暗い表示では `#121212` になる。旧宣言を再現すると `#101010` に変わることも確認
- local commit 済み / push・Railway反映・本番確認は**未実施**

### 次の一手

- **オーナー判断待ち: admin のフォントも公開サイトに追従している。**
  実測で装飾書体を選ぶと admin の本文と見出しがまるごと変わる。ただし意図的な
  設計の可能性があるため触っていない。案(a)切り離す /(b)見出しだけ借りる /(c)現状維持
- 着手順2（写真の見せ方の振り幅）は判断待ちに関係なく進められる

### 触ってはいけない範囲

- `git push`（オーナーだけ）/ 本番DB / Turso / R2 / Railway / 環境変数 /
  公開設定 / `.env` の表示・記録 / `docs/archive/` の既存本文
- smoke は本番と同じDBにつながる。**保存・削除・追加の書き込み操作を増やさない**
- `admin-login.tsx` の `.admin-login` は「公開サイトと道具の間の扉」として
  意図的に公開サイトの色へ追従している。admin本体と同じ扱いにしない
- 既存の `data-admin-setting` / `data-library-*` 目印を消さない
- 同じ worktree を2人で同時に編集しない
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
