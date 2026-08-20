# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-20 JST（6回目）

- **Status:** push の条件付き解禁を実施し、**新規則で2件 push・本番反映まで確認済み**。
  ルール再検討とCodex連携案は提案のみ（未実行）。
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF` / origin と同期済み

### 目的と完了条件

エージェントが条件付きで push できるようにし、壊れたときにオーナーが自力で
戻せる状態を作る。正本は `AGENTS.md`「絶対に越えない境界」。

### 完了（commit・push・本番反映すべて済み）

1. **push の3条件**を `AGENTS.md` へ明記（check 成功 / 製品コードがあれば
   smoke も成功 / 本番DB・秘密情報・課金・公開設定に関わらない）
2. `.claude/settings.json` の deny から `git push` 系3件を除去。
   **`db:push` `drizzle-kit` `deploy` `railway` の deny は残した**
3. `docs/rollback-guide.md` を新設（オーナー向け・コピペ可）
4. `docs/specs/rule-review-2026-08.md`（提案34件 + Codex連携3案）
5. **Codex は引き続き push しない**（条件2・3を検証できるのは Claude 側）

### 検証（ここまで全部済み）

- `bun run check` = **1028 tests / 0 fail**、`test:tools` 37 pass / 0 fail
- smoke は不要と判定（`packages/` 配下に差分なし）
- **push 成功** → **本番反映確認: `x-build=6606ff3f`**
- **本番の健全性を実測**: `/api/health` `/api/settings` `/api/photos` すべて 200、
  写真 **497件** 取得。`/` `/gallery` `/about` も 200
  → 起動経路を触った `f7825df`（16列の安全網）を含む状態で本番が正常に動いている

### オーナー判断待ち

- **ルール再検討の実行可否**（`rule-review-2026-08.md`）。
  廃止1件 = PreCompact hook / 緩和6件 / 要判断6件。**まだ何も触っていない**
- **Codex 連携**: 案A 畳む / **案B 反対レビュー1用途（推奨）** / 案C 非推奨
- **`docs/archive/task-handoffs.md:1355` に管理パスワードの平文**
- Codex にも push を許すか
- `hono` / `sharp` の更新（調査済み・未実行）/ backlog B-19・B-15

### 次の一手

- wiki の鮮度警告 残り8件（`deployment.md` `project-overview.md` が次に効く）
- **中身を見ずに `last_verified` だけ進めない**

### 触ってはいけない範囲

- 本番DB・Turso・R2・Railway・環境変数（deny は残してある）
- `shotAt` の保存方法、公開API応答形、Lightbox の既存ロジック
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
