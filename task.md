# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-06 JST

- **Status:** Codex 12件の追試と、採用した推奨1〜9を完了。推奨4・9は
  既存commitで完了済みと再確認し、推奨3を追加実装した。origin との差は
  `git rev-list --count origin/main..HEAD` で測る（push はオーナーだけ）
- **Current owner:** 未定（Codexの編集は終了）/ **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF` / **Git:** clean（未追跡は `scratch/` のみ）

### 今回やったこと（詳細は `docs/agents/codex-debug-2026-08-05.md` 末尾）

1. **Codex 12件の追試を完了。**5件は実装を戻すとテストが落ちた。2件は
   ソースを文字列で見るだけで、保存を空にしても素通りしていた
2. **素通りしていたテストを実DB検査へ差し替え**（非公開カバー写真 /
   一括メタデータ保存）。サムネの後始末はR2削除のため配線テストのまま、
   no-op を弾くまで厳しくした
3. **推奨5**（回転時の焦点）— オーナー決定「一緒に回す」を実装
4. **推奨2**（API入口の入力検証）— 非オブジェクト本文を400へ。ID配列は
   `parseIdList()`（上限5000）
5. **推奨8**（Lightbox）— 1スワイプ=2移動と、`srcSet` 再試行の空振り。
   **どちらも実在した**
6. **推奨6**（画像キャッシュ）— `images-v2` / 300件上限 / 206を保存しない。
   `sw.js` に初めてテストを付けた
7. **推奨3**（壊れた画像）— 申告形式が画像でも内容を読めない場合は422へ。
   修正を外すとテストが落ちることまで確認した
8. **推奨4・9** — `1a83251` / `c477384` ですでに完了済みと実物で再確認。
   並べ替え10件、Service下書き3件のテストが成功

### 次の一手

- オーナーによるpush待ち。Railway反映・本番確認は別工程

### 検証の状態

- `bun run check` **成功**（exit 0）/ `bun test ./src` 765 pass 0 fail
- `bun run smoke` **成功**（exit 0 / 304 passed・115 skipped・0 fail）
- **Railway 反映と本番での確認は未実施**

### 測るときの落とし穴

**正本は `docs/agents/measuring.md`。着手前に読む。**
**ソースを文字列で見るテストは実装を守らない。**`.set(patch)` を `.set({})` に
しても通る。同じ形は `readFileSync(import.meta.dir` で探せる。
**jsdom で Lightbox のジェスチャを試すなら、mount後 120ms 待つ。**
30ms ではイベント登録が間に合わず、無反応を「不具合なし」と読み違える。
Current State へ「すぐ古くなる値」（ahead件数・push状況）を書かないこと。

### 触ってはいけない範囲

- `git push`（オーナーだけ）/ 本番DB / Turso / R2 / Railway / 環境変数 /
  公開設定 / `.env` の表示・記録 / `docs/archive/` の本文
- 写真の並べ替えは `photo-reorder-safety.ts` の競合検知を壊さない
- 同じ worktree を2人で同時に編集しない
- 週枠が両者とも少ない。**範囲を縮めず1区切りを小さくして都度 commit**
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
