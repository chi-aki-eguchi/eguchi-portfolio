# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-20 JST（7回目）

- **Status:** Codex の CLI 連携を廃止し規則1行へ。ルール仕分けを適用。
  **commit・push 済み。**
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF`

### 完了

1. **Codex の CLI 連携を廃止**（`18cd5d8`）。`codex-workflow.md`(180行)・
   レーン定義TOML2件・導入scriptを archive へ。残した規則は
   `docs/checklists.md` の1行だけ（本番DB・課金・公開設定・認証に触る前に
   Codex アプリへ貼って反対意見をもらう。**オーナーが手で貼る。自動化しない**）
   - **Codex アプリ自体は今も使用中**（主に Ivy's House 側）。やめたのはCLI連携だけ
2. **ルール仕分けを適用**。廃止1件（`PreCompact` hook を settings から削除）、
   緩和6件。維持21件は未変更。要オーナー判断6件は**実行せず説明を用意**
3. Current State の**下限30行を廃止**（上限60行のみ）。水増しの動機を消した
4. `file-hygiene.md` から `AGENTS.md` と重複する2項目を削除

### 途中で見つけて直したもの

- `chatgpt-handoff.mjs` が次のAIへ「push は行わない」と**古い規則を配っていた**。
  現行の3条件へ更新し、テストで固定（旧文言を含まないことも検査）

### 検証

- `bun run check` = **1028 tests / 0 fail**、`test:tools` 37 pass / 0 fail
- smoke は不要と判定（`packages/` 配下に差分なし）
- `18cd5d8` は push 済み。**本番反映は未確認**（次のcommitとまとめて測る）

### オーナー判断待ち（残り2件）

- **`docs/archive/task-handoffs.md` の管理パスワード平文。**
  推奨は Railway で `ADMIN_PASSWORD` を変えること（数分・低リスク）
- `.claude/settings.json` の `kill -9` 禁止。実害ゼロだが理由も記録に無い。
  見立ては「そのまま残す」
- （他: `hono`/`sharp` の更新、backlog B-19・B-15）

### 次の一手

- wiki の鮮度警告 残り8件（`deployment.md` `project-overview.md` が次に効く）
- Obsidian 互換の調査結果は同セッションで報告（実行はしない）

### 触ってはいけない範囲

- 本番DB・Turso・R2・Railway・環境変数
- `shotAt` の保存方法、公開API応答形、Lightbox の既存ロジック
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
