# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-20 JST

- **Status:** エージェントが読む文書の棚卸しと整理。**commit 済み。push は未実施。**
- **Current owner:** Claude Code（設計・実装・検証すべて） / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF` / originとの差は
  `git status --short --branch` で測り直す

### 目的と完了条件

起動時に読まれる文書を最小化し、役目を終えた文書を `docs/archive/` へ畳む。
棚卸しの正本は `docs/specs/reading-layer-audit-2026-08.md`（監査本文 + 実行記録）。
管理画面のゴールは従来どおり `docs/specs/admin-renewal-goal.md`。

### 完了（commit 済み・push なし）

1. C判定13件を `git mv` で `docs/archive/` へ。各冒頭に ARCHIVED / 後継 / 理由の3行
   （`docs/specs/admin-enhancement-spec.md` は同名衝突のため `-v3` を付けた）
2. 移動前に現役側の参照を振り替え（design-spec / admin-renewal-goal /
   library-redesign-spec / checklists / wiki index・admin-settings・open-issues）
3. `AGENTS.md` に「読まない場所」節を追加（`docs/archive/` は通常読まない）
4. Codex試用は判定を後追いで作らず**運用終了**とし、`codex-workflow.md` の
   発動条件を恒久化と明記
5. `wiki/pages/image-pipeline.md` の**誤り**（purge で thumb/medium が消えない）を
   実装に合わせて訂正。死んだ引用 `task.md:2677` も撤去
6. `photo-metadata-extraction-plan.md` の「7列が無いと動かない」警告を撤去（下記）
7. `backlog.md` B-4 から解決済み1件を削除、`open-issues.md` #16 を解決済みへ
8. `codex-workflow.md` のレーン例に `< /dev/null` を追加（無言ハング防止）
9. `handoff-workflow.md` の「既存39 commits」を測り直す形の規則へ

### 検証

- `bun run check` = **1019 tests / 0 fail**、`test:tools` 27 pass / 0 fail、
  lint・typecheck・postgres-schema contract すべて通過
- `bun run smoke` は**未実施**。admin 製品コードに差分が無いため（文書 + 新規script のみ）
- 本番・Railway反映・実機は**いずれも未実施**

### 本番DBの確認結果（読み取りのみ）

`node scripts/ai/check-prod-photo-columns.mjs` を新設し実行。本番 Turso の
`photos` は **36列**で、メタデータ7列は**すべて存在**（移行適用済み）。
**本番DBへの変更は行っていない。**

### 次の一手 / オーナー判断待ち

- **`docs/archive/task-handoffs.md:1355` に管理パスワードの平文が commit されている。**
  現用なら Railway の `ADMIN_PASSWORD` を変更するのが最短
- `hono` / `sharp` の更新は**調査のみで未実行**（依頼どおり）。7件中実際に効くのは
  hono の CORS ReDoS 1件だけと実測。詳細は監査文書
- backlog **B-19**（Libraryの「取り込み」の語）／**B-15**（`.env` 2ファイルの
  `ADMIN_PASSWORD` 食い違い）はオーナー判断待ち

### 触ってはいけない範囲

- **push はオーナーのみ。**本番DB・Turso・R2・Railway・環境変数
- `shotAt` の保存方法、公開API応答形、Lightbox の既存ロジック
- `site-and-data-direction.md` §2「作らないもの」と §9 の11段
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
