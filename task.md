# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-06 JST

- **Status:** テストの信頼性を立て直す作業。Codex 12件の追試が完了し、
  素通りしていた3件を実DB検査へ差し替えた。origin との差は
  `git rev-list --count origin/main..HEAD` で測る（push はオーナーだけ）
- **Current owner:** 未定（次の担当者が自分を書き込んでから編集を始める）
- **Branch:** `main` / **HEAD:** `SELF` / **Git:** clean（未追跡は `scratch/` のみ）

### 今回やったこと（詳細は `docs/agents/codex-debug-2026-08-05.md` 末尾）

1. **Codex 12件の追試を完了。**5件は実装を戻すとテストが落ちる。2件
   （`2051e48` `a3d7017`）は `index.ts` をテキストとして読むだけで、
   保存を空にしても後始末を無効化しても素通りしていた
2. **素通りしていた3件を実DB検査へ差し替えた。**
   `series-public-visibility.test.ts`（非公開カバー写真）/
   一括メタデータ保存（`applyBatchPhotoMetadata` へ切り出し）/
   サムネの後始末（R2削除のため配線テストのまま、no-op を弾くまで厳しく）
3. **推奨5（回転時の焦点）を実装。**オーナーが「一緒に回す」を選択

### 次の一手（上から順）

1. **推奨2: API入口の共通入力検証**（null・型違い・巨大ID配列を400へ）。
   書き込みAPIの挙動が変わるので既存テストの期待値も要確認
2. **推奨8: Lightbox の `srcSet` 再試行と 1スワイプ=1移動。**
   Lightbox は「壊さない」対象。着手前に `docs/checklists.md`
3. **推奨6: 画像キャッシュの版・上限・破棄**（Service Worker）。配信に関わる
4. 推奨4（並べ替え4種を写真と同じ競合拒否へ）と推奨3・9 も未着手

### 検証の状態

- `bun run check` **成功**（exit 0）/ `bun test ./src` 730 pass 0 fail
- `bun run smoke` は **Codex 12件と今回の変更を入れたあと未実行**。
  本番DBにつながるので実行判断は慎重に
- **Railway 反映と本番での確認は未実施**

### 測るときの落とし穴

**正本は `docs/agents/measuring.md`。着手前に読む。**
新しく分かったこと: **ソースを文字列で見るテストは実装を守らない。**
`.set(patch)` を `.set({})` にしても通る。同じ形が他にも無いか、
`readFileSync(import.meta.dir` を探すと見つかる。
Current State へ「すぐ古くなる値」（ahead件数・push状況）を書かないこと。

### 調査に使える道具（`scratch/debug-sweep/`・gitignore対象）

`full-sweep.mjs` / `interaction2.mjs` / `admin-mobile.mjs` /
`admin-interaction.mjs` / `failure-states.mjs` / `rapid.mjs` /
`settings-final.mjs` / `code-audit.mjs`。**すべて read-only 設計。**

### 触ってはいけない範囲

- `git push`（オーナーだけ）/ 本番DB / Turso / R2 / Railway / 環境変数 /
  公開設定 / `.env` の表示・記録 / `docs/archive/` の本文
- Lightbox は「壊さない」対象。写真の並べ替えは `photo-reorder-safety.ts` の
  競合検知を壊さない
- 同じ worktree を2人で同時に編集しない
- 週枠が両者とも少ない。**範囲を縮めず1区切りを小さくして都度 commit**
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
