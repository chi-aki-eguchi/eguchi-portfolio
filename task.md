# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-20 JST（2回目）

- **Status:** 常時読む分（A層）の削減と、wiki の鮮度チェック追加。**commit 済み・push なし。**
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF` / originとの差は
  `git status --short --branch` で測り直す

### 目的と完了条件

起動時に必ず読まれる分を減らし、古い文書が自分から警告を出すようにする。
正本は `docs/specs/reading-layer-audit-2026-08.md`（監査 + 実行記録2回分）。
管理画面のゴールは従来どおり `docs/specs/admin-renewal-goal.md`。

### 完了（commit 済み・push なし）

1. **A層 288行 → 241行**。`AGENTS.md` 148→110、`CLAUDE.md` 64→55
2. 削除前に19項目をB側と照合。**実在しなかった4項目は先に移設**
   （最小Handoff・オーナー報告 → `handoff-workflow.md` /
   参照先 → `docs/README.md`（新規）/ memory優先規則 → `CLAUDE.md` 前文）
3. 削った箇所には、どこを見るかの参照を1行ずつ残した
4. **削っていないもの:** §0不変条件24行、安全境界9行（push禁止・本番DB・秘密情報）、
   「オーナーの直接指定が優先」の1行
5. `scripts/ai/check-wiki-freshness.mjs` を追加し `bun run check` の最後へ。
   45日超のページを警告。**終了コードは常に0で check を失敗させない**
6. 鮮度チェックのテスト10件を `test:tools` へ追加

### 検証

- `bun run check` = **1019 tests / 0 fail**、`test:tools` **37 pass / 0 fail**、
  lint・typecheck・postgres-schema すべて通過、**終了コード0**
- `bun run smoke` は未実施（admin 製品コードに差分なし。文書・script・package.json のみ）
- 本番・Railway反映・実機は**いずれも未実施**

### 次の一手

- **wiki 13ページ中10ページが45日超の警告に出ている。**日付は動かしていない。
  中身をソースと突き合わせて確認してから `last_verified` を動かすこと。
  **見ずに日付だけ進めない**（それをやると今回直した種類の誤りをまた埋める）
- 優先度が高いのは `pages/invariants.md` と `pages/database.md`
  （不変条件とDBの記述は誤ると影響が大きい）

### オーナー判断待ち

- **`docs/archive/task-handoffs.md:1355` に管理パスワードの平文が commit されている。**
  現用なら Railway の `ADMIN_PASSWORD` 変更が最短
- `hono` / `sharp` の更新（調査済み・未実行）。hono は7件中1件のみ該当、
  sharp は `package.json` の書き換えが必要で画質の目視比較が要る
- backlog **B-19**（Libraryの「取り込み」の語）／**B-15**（`.env` 2ファイルの食い違い）

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
