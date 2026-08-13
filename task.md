# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-14 JST

- **Status:** 公開面の日付表示 B案を実装・ローカル検証済み。
- **Current owner:** Codex（実装完了） / Claude Code は read-only の独立検証担当
  / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF` / Git・originとの差は `git status --short --branch` で再測定する。

### 目的と完了条件

フィルムの `shotAt`（デュープ時刻）は保存・更新・並べ替えを変えず、公開面だけで
出どころを誤解させない。Lightbox はフィルムを「スキャン」、デジタルを「撮影」とし、
`large-format` はフィルムの年を出さない。→ 達成。

### 完了した変更

- `Lightbox.tsx`: `filmType` が `フィルム` / `デジタル` のときだけ日付ラベルを
  `スキャン` / `撮影` に変更。空・不明は既存の `Date` のまま。
- `PhotoGallery.tsx`: `large-format` だけで、フィルムの `shotAt` 年を除外。
  `Film — ` のような区切りだけは残らない。
- API、schema、settings、`shotAt` の保存・更新・並べ替え、12レイアウトの種類は未変更。
- 回帰テストを追加し、Lightbox のフィルム・デジタル・未設定と、large-format の
  フィルム・デジタル・未設定の表示を固定した。

### 検証済み

- focused: `PhotoGallery.render`、日付ラベル、Lightbox focus return / gestures が成功。
- `bun run check` 成功（Postgres schema契約、typecheck、lint、923 tests、tools、build）。
- `git diff --check` 成功。

### 未検証 / 境界

- `bun run smoke` は未実行（admin変更なしのため、依頼どおり実行しない）。
- local commit: `HEAD: SELF`（このCurrent Stateを含む）/ push・Railway反映・本番確認は未実施。
  Turso、R2、環境変数、デプロイは未操作。
- 未追跡 `docs/specs/site-and-data-direction.md` はオーナーの正本であり、このcommitに含めない。

### 次の一手 / 禁止範囲

- Claude Code が差分と指定の表示条件をread-onlyで独立確認し、オーナーがpush可否を判断する。
- pushはオーナーのみ。Codex session: current root session（resume logなし）。
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
