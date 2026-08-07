# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-07 JST

- **Status:** 「つまみを回しても見た目に出ない」不具合の一掃。**6件すべて修正・commit 済み**
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF` / **Git:** `a923995` まで local commit 済み。
  push は未実施。未追跡は `scripts/smoke/scratch/`（以前からある調査用）

### 目的と完了条件

管理画面が出す値が、必ず公開サイトの見た目に出ること。出ない値をつまみに出さないこと。
設計の正本は `docs/specs/design-freedom-plan.md` §D。

### 完了したこと

1. **列数が指定どおりに出ない**（`0f9cb8c`）。枠が `max-w-5xl`（実測928px）固定で
   5〜8列が届かなかった。`galleryFrameWidth()` が指定列数に必要な幅まで枠を広げる
2. **範囲のずれ5件**（`a923995`）。写真の大きさ 3.0→実際2.0 / 余白倍率 5.0→実際3.0
   （各ギャラリー・トップ）/ シリーズ列数 8→実際6。**範囲を
   `shared/setting-ranges.ts` へ集約**し、管理画面と実行時 clamp が同じ表を読む
3. API `/settings` の**古い範囲コメント3件を削除**（0.5–2.0 / 0–0.3 / 2–4。全部間違い）

### 検証の状態

- `bun run check` **成功**（790 pass / 0 fail、exit 0）
- 回帰テスト: `setting-ranges.test.ts` 5件 ＋ PhotoGallery render 9件。
  **どれも修正を戻すと落ちることを個別に確認済み**
- 実ブラウザ実測: ギャラリー 1900px で 4列→**8列**（枠 928→1597px、横スクロールなし）、
  1200px で枠988px・4列、スマホ375px は枠を広げず2列。トップWorks 8列。
  新規タブのコンソールに error なし
- **`bun run smoke` は 18 failed / 286 passed / 130 skipped。** ただし
  **今日の変更が原因ではないことを確認済み**（作業差分を stash しても同じ2件が
  同じ形で落ちる。落ちる要素は `admin.tsx` の `[data-virtualized]` で、今日触った
  ファイルは描画しない）。詳細と再現手順は `docs/agents/backlog.md` の **S-1**
- **未検証:** 上限を超える値を保存した本番相当の確認（本番DBへ書くため未実施）。
  画面リサイズ中の追従（検証用ブラウザが resize/ResizeObserver を発火しない）
- local commit 済み / push・Railway反映・本番確認は**未実施**

### 次の一手

- **S-1（smoke 18件）の切り分け。** テスト側の競合（`openSettingsSection()` の
  `isVisible()`）と、本番DB依存の可能性を分けて調べる
- **オーナー判断待ち: admin のフォントが公開サイトに追従している**
  （案 a切り離す / b見出しだけ借りる / c現状維持）

### 触ってはいけない範囲

- `git push`（オーナーだけ）/ 本番DB / Turso / R2 / Railway / 環境変数 /
  公開設定 / `.env` の表示・記録 / `docs/archive/` の既存本文
- smoke は本番と同じDBにつながる。**保存・削除・追加の書き込み操作を増やさない**
- `admin-login.tsx` の `.admin-login` は意図的に公開サイトの色へ追従している
- 既存の `data-admin-setting` / `data-library-*` 目印を消さない
- 範囲を `setting-ranges.ts` 以外の場所へ数値で書き戻さない（テストが落ちる）
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
