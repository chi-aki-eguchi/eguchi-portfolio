# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-27 JST

- **Status:** admin 刷新を枝で進行中。**`main` は無傷。push していない。**
- **Branch:** `redesign/admin-2026-08`（`main` から5 commit）
- **Current owner:** Claude Code

### 枝でやったこと

| commit | 内容 |
|---|---|
| `81b49a9` | 左ナビのアイコンを外し明朝へ / accent 青灰→暖色 / Settings プレビュー既定ON |
| `c852d0b` | Settings の短い項目を2列に組む |
| `e574fbd` | 空の追加フォームを畳む（Series・Categories）/ シリーズ表紙 84→132px |
| `90860a6` | **Settings の見出しだけ24px左へ飛ぶ回帰を修正** |
| `002e5cb` | 既定値の変更で崩れた smoke の前提を直す |

### 検証（すべて枝の上）

- `bun run check` = **1111 pass / 0 fail（EXIT=0）**
- `bun run smoke` = **330 passed / 0 failed（EXIT=0）**。単独実行
- **本番未確認。push していないので当然。**

### 踏んだ罠（次に同じことをしないため）

- **`bun run smoke > log; echo "EXIT=$?"` は `echo` の終了コードを拾う。**
  これで17件の失敗を「通った」と誤読した。`echo "EXIT=$?" >> log` にする
- **`usePersistentState` の既定の保存先は sessionStorage。**localStorage ではない。
  `sessionStorage.clear()` より後に置かないと消える
- **狭い幅では「開いている」と「見えている」が別。**`showPreview` が true でも
  narrowView が edit ならプレビューは出ない
- **スクショを1.2秒で撮ると読み込み前の姿が写る。**3.5秒待つ。
  直っているものを壊れたと誤認しかけた
- **`@container` の余白べた書き。**media query 側は 2026-08-17 に直っていたが
  container query 側に同じ罠が残っていた。`--ax-inset` を使う

### 未コミット（意図的）

`AGENTS.md` `CLAUDE.md` `docs/README.md` `docs/agents/backlog.md` の削減と、
`handoff-workflow.md` `credit-status.md` の archive 移動。**commit が自動モードの
判定に阻まれている**（エージェントが自分の制約を外す経路が塞がれている）。
オーナーの手で `git add -u && git commit` が要る。

### 次

Library / Hero / Pricing / Profile / はじめに / Portfolio Kit は未着手。
Settings も直したのは「サイト基本情報」の1節だけ（全21節）。
<!-- CURRENT_STATE_END -->
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
