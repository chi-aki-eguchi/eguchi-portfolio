# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-06 JST

- **Status:** Codex の「大きいバグ」ラウンドが完了し **12件を修正して commit 済み**。
  Claude が独立検証を実施（5件抜き取りで全て「戻すと落ちる」を確認）。
- **Current owner: Claude Code**（Codex のラウンドは完了。次の編集者は未定）
- **Branch:** `main` / **HEAD:** `SELF`
- **Git:** clean（未追跡は `scratch/` のみ・gitignore 対象）
- push 状況・ahead 件数はここに書かない（すぐ古くなる）。
  `git status --short --branch` で測る

### Codex の「大きいバグ」ラウンド — 完了（2026-08-06）

Codex（Terra / max, workspace-write）が **12件を修正して commit 済み**。
**ただし最後に通信エラーで落ち、報告 `scratch/codex-bigbug-report.md` と
Current State の更新は行われていない。**このブロックは Claude が代わりに書いた。

直った12件（コミット順）:
非公開カバー写真が公開シリーズ一覧に出る / Service下書きが読込で消える /
`"false"` が true として保存される / シリーズ削除と写真の切り離しが非原子的 /
一括メタデータ編集が途中まで保存される / 保存できない設定値を黙って捨てる /
サムネイル片方だけ残る / Hero一括選択が非原子的 / **同時アップロードで
保存キーが衝突しうる** / 古い並べ替えを受け付ける / 一括カテゴリ編集が
非原子的 / 存在しないレコードへの保存を受け付ける

### Claude の独立検証（2026-08-06）

- `bun run check` **成功**（exit 0）
- 12件のうち **5件を抜き取り、製品コードだけを戻して再実行**。
  すべて落ちた（10 / 8 / 9 / 4 / 3 件）。テストは実際に効いている
- テストは2方式: ロジックを切り出した単体テスト7件と、呼び出し側の結線を
  見る `*-wiring` テスト8件。**`series-public-visibility.test.ts` だけは
  wiring のみでロジックの単体テストが無い**（ソース文字列への一致検査）
- **残り7件は未検証。**本番DB・R2に触れずに再現できる範囲で追試が要る

### 完了済み（2026-08-05、push 済み）

設定が効かない系4件 / 表示されない・触れない系3件 / 操作系5件 /
スマホadmin 5件 / 壊れた時の表示1件 / Codex推奨1（派生画像のR2孤立）と
7（Serviceリンク・カスタムフォント）。詳細は git log と
`docs/agents/codex-debug-2026-08-05.md`。

### 未検証・未着手

- **Railway 反映と本番での確認は未実施**（push はしたが本番を見ていない）
- Codex 推奨 2・3・4・6・8・9 は未着手
- Codex 推奨 5（回転時の focal point）は**オーナー判断待ち**

### 次の一手

1. **オーナーが push するか判断する**（push はオーナーだけ）
2. 未検証の7件を追試する。本番DB・R2に触れずに再現できるものから
3. `series-public-visibility.test.ts` を、ソース文字列一致ではなく
   実際の絞り込み結果を見るテストへ差し替える
4. Codex 推奨5（回転時の focal point）は**オーナー判断待ち**のまま

### 触ってはいけない範囲

- `git push` / 本番DB / Turso / R2 / Railway / 環境変数 / 公開設定
- `bun run smoke` の実行（本番と同じDBにつながる）
- `.env`・APIキー・トークンの表示と記録
- `docs/archive/` の本文
- Lightbox は「既存の修正済みロジックを壊さない」対象
- 写真の並べ替えは `photo-reorder-safety.ts` の競合検知を壊さない

### 検証

- 製品コード変更後は `bun run check`（リポジトリルート）
- 回帰テストは**修正を戻すと落ちる**ことまで確認する
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
