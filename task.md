# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-09 JST

- **Status:** 08-08・08-09 の依頼8件は実装・本番反映まで完了。本番で実測して
  **TOPのシリーズ帯の不具合を1件見つけ、直した**。その分がまだ push されていない
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF` / **Git:** clean・未追跡なし
- **push状況の測り方:** `git status -sb` の `ahead` と
  `curl -sI https://akieguchi.com/ | grep -i x-build` を突き合わせる。
  x-build が `git rev-parse --short origin/main` と一致していれば本番反映済み

### 完了したこと

- 08-08 の依頼4件（白いビューア / 閉じるときのカクッ / シリーズの入口 / 安定性）
- 08-09 の依頼4件（マソンリーの説明 / ランダム並び / シリーズ除外 / HERO ランダム）
- 経緯と実測値は `docs/archive/task-handoffs.md` の 2026-08-09 の節

### 検証の状態

- `bun run check` **成功**（839 pass / 0 fail・exit 0）
- `bun run smoke` **成功**（306 passed / 0 failed。`5ff1edd` 時点で実行）
- 08-09 分は Claude が独立検証済み。本番でも主要な変更が効いていることを確認
- **未確認:** HERO「順番だけ」。登録HERO写真が1枚では順番が変わらないのが
  正しい挙動のため観測できない。2枚以上登録したときに一度見る
- **未確認:** 修正した帯が本番で流れること（push 後に見る）

### 次の一手

- **オーナーが push する。** 反映後、TOPのシリーズ帯が実際に流れることを一度見る
  （push 前の本番では静止したまま）
- S-2（`admin-workspace-layout` の flaky）。出たときの調査を繰り返さないため
  `backlog.md` に手順ごと残してある

### 触ってはいけない範囲

- `git push`（オーナーだけ）/ 本番DB / Turso / R2 / Railway / 環境変数 / `.env`
- smoke は本番と同じDBにつながる。**書き込み操作を増やさない**
- 範囲を `setting-ranges.ts` 以外へ数値で書き戻さない（テストが落ちる）
- 最小タイル幅（210 / 150）を `shared/gallery-metrics.ts` の外へ書き戻さない
- `.admin-login` は「扉」として意図的に公開サイトの色・書体へ追従している
- ビューアの色に公開サイトのテーマ変数を使わない（暗色時に読めなくなる）
- `/photos` の公開応答へ管理用の列を戻さない（テストが落ちる）
- **popstate を「同じパスかどうか」で見分けない。** 実ブラウザでは本物の戻るも
  同じパスに見える。`historyBridge` の印で判定する
- **履歴・遷移まわりを jsdom のテストだけで「通った」と判断しない**
- ランダムの種を描画のたびに引き直さない。戻ったときに位置がずれる
- **後から現れる要素を測る effect の依存を `[]` にしない。** API のデータが
  届いてから描かれる要素は、マウント時点では ref が空。一度きりの測定だと
  永久に固着する（帯の実例・`05b75f7`）
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
