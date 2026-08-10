# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-11 JST

- **Status:** オーナー就寝中の自走6時間。**公開サイトと admin の見直し・選べる範囲の
  拡張・違和感の修正**を実施。commit 7本が push 待ち
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF` / **Git:** clean・未追跡なし / **origin より 7 先**
- **push状況の測り方:** `git status -sb` の `ahead` と
  `curl -sI https://akieguchi.com/ | grep -i x-build` を突き合わせる。
  x-build が `git rev-parse --short origin/main` と一致していれば本番反映済み
- **注意:** 02:33 に**別セッションが同じ worktree へ commit した**（`dc8ca5d`・
  task.md のみ）。以後の重複を避けるため、編集者は1人に保つ

### 完了したこと（今回の7本）

- `002ec77` ページ最上部の帯を選べるように（`headerBackground`）※前セッション分
- `2fe11d6` **About の構成**（`profileLayout` = 写真左／写真を上に大きく／写真なし）。
  写真未登録のときの空の灰色四角を廃止。Journal の札で抜粋の開始位置が19pxずれる
  のも直した
- `047de91` **Contact の構成**（`contactLayout` = 中央／左寄せ／説明を左・フォームを右）
- `c075a4b` スマホで Settings だけ見出しが8px左へ飛ぶのを修正。
  smoke が desktop 限定だったので、スマホ幅の検査を追加
- `f7a7954` **作風プリセット**（しずか／雑誌／展示／暗室）。既存設定を14個まとめて
  入れ替える。押しても保存はせず下書きに入るだけ
- `005181a` お問い合わせの入力エラーを日本語化し、暗いテーマでも読める色に
  （backlog **B-17 は解消したので削除済み**）

### 検証の状態

- `bun run check` **成功**（865 pass / 0 fail・exit 0）
- `bun run smoke` **307 passed / 1 failed**。落ちたのは既知の **S-2**
  （`admin-workspace-layout.spec.ts:99`）だけ。**単独実行では 4.0 秒で通る**ので
  今回の変更が原因ではない。全体実行で負荷が高いときだけ出る既知の揺れ
- 3構成 × 実ブラウザで実測済み（About / Contact とも、日英・スマホ・PC）。
  作風プリセットは**サーバーへ非GETが1件も出ない**ことを実測

### 次の一手

- **オーナーが push する。** 反映後、TOPのシリーズ帯が流れることと、
  新しい「作風を選ぶ」「ページの構成」が本番で効くことを一度見る
- 作風プリセットは**オーナー未確認**。4つの名前と中身が好みに合うかは要判断

### 触ってはいけない範囲

- `git push`（オーナーだけ）/ 本番DB / Turso / R2 / Railway / 環境変数 / `.env`
- smoke は本番と同じDBにつながる。**書き込み操作を増やさない**
- 範囲を `setting-ranges.ts` 以外へ数値で書き戻さない（テストが落ちる）
- 最小タイル幅（210 / 150）を `shared/gallery-metrics.ts` の外へ書き戻さない
- **節を足したら `scripts/smoke/helpers.ts` の `SETTINGS_SECTION_COUNT` も直す。**
  忘れると full smoke が4件まとめて落ちる（`bun run check` が先に捕まえる）
- **custom property の暗側上書きは `:root` より後に置く。** 特異度が同じで後勝ち
- **作風プリセットに色・書体を入れない。** 配色の選び直しが消える
- `.admin-login` は「扉」として意図的に公開サイトの色・書体へ追従している
- ビューアの色に公開サイトのテーマ変数を使わない（暗色時に読めなくなる）
- **popstate を「同じパスかどうか」で見分けない。** `historyBridge` の印で判定する
- **履歴・遷移まわりを jsdom のテストだけで「通った」と判断しない**
- **後から現れる要素を測る effect の依存を `[]` にしない**（帯の実例・`05b75f7`）
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
