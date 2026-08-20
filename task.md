# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-20 JST（5回目）

- **Status:** push をオーナー判断で条件付き解禁。戻し方の手順書を新設。
  **commit 済み。この変更自体を新規則に沿って push する。**
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF` / originとの差は
  `git status --short --branch` で測り直す

### 目的と完了条件

エージェントが条件付きで push できるようにし、壊れたときにオーナーが
自力で戻せる手順を用意する。正本は `AGENTS.md`「絶対に越えない境界」。

### 完了

1. **push の3条件を `AGENTS.md` へ明記。**check 成功 / 製品コードがあるなら
   smoke も成功 / 本番DB・秘密情報・課金・公開設定に関わらない。
   **1つでも欠けたら push せず止まる**
2. `.claude/settings.json` の deny から `git push` 系3件を除去
   （`db:push` `drizzle-kit push` `deploy` `railway` の deny は残した）
3. **`docs/rollback-guide.md` を新設**（オーナー向け・コピペ可）。
   本番の版の見方 / Railway画面での即時復旧 / `git revert` での正式な復旧 /
   AIへの頼み方 / やってはいけないこと
4. 波及6ファイルを更新: `CLAUDE.md` `codex-workflow.md` `handoff-workflow.md`
   `checklists.md` `owner-guide.md` `docs/README.md`
5. **Codex は引き続き push しない**（TOML は未変更）。条件の検証を担うのは Claude

### 検証

- `bun run check` = **1028 tests / 0 fail**、`test:tools` 37 pass / 0 fail
- smoke は**不要と判定**（`packages/` 配下に差分なし。文書と設定のみ）
- `curl -sI https://akieguchi.com/ | grep -i x-build` が動くことを実測（手順書の1番）
- push 後の本番反映は**未確認**（push 直後に測る）

### 分かったこと

- A層は 239行 → **249行**（+10）。push 条件5行と CLAUDE.md 1行の増分
- `.claude/settings.json` の deny 変更がこのセッション内で効くかは未検証。
  効かない場合はセッション再起動が要る

### オーナー判断待ち

- **`docs/archive/task-handoffs.md:1355` に管理パスワードの平文**
- Codex にも push を許すか（今回は許していない）
- ローカルブランチ `improve/night-20260707`
- `hono` / `sharp` の更新（調査済み・未実行）/ backlog B-19・B-15

### 次の一手

- ルール全体の再検討とCodex連携の作り直し案は**報告のみ**（同セッションで提出）
- wiki の鮮度警告 残り8件

### 触ってはいけない範囲

- 本番DB・Turso・R2・Railway・環境変数
- `shotAt` の保存方法、公開API応答形、Lightbox の既存ロジック
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
