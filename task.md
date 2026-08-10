# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-11 JST

- **Status:** オーナー就寝中の自走。**公開サイトと admin の見直し／選べる範囲の拡張／
  違和感の修正**。commit 13本が push 待ち
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF` / **Git:** clean・未追跡なし / **origin より 13 先**
- **注意:** 02:33 に別セッションが同じ worktree へ commit（`dc8ca5d`・task.md のみ）

### 選べる範囲を広げた

**骨格そのものを選べるようにした。**新キー6つ（既定は従来どおりで既存サイトは不変）:

- `profileLayout` 写真左／写真を上に大きく／写真なし
- `contactLayout` 中央／左寄せ／説明を左・フォームを右
- `seriesCardStyle` 表紙の下に題名／題名を重ねる／3:2横長
- `footerLayout` 中央／左寄せ／SNSを左・著作を右
- `pageTitleStyle` 小さな大文字中央／左／大きな見出し／出さない
- `homeStatement` TOPに作家の言葉を出す位置（文章は Profile のものを再利用）
**作風プリセット**（しずか／雑誌／展示／暗室）も追加。既存設定を16個まとめて
入れ替えるが、押しても保存せず**下書きに入るだけ**なので、見てから決められる。

### 直した「違和感」

- 何も登録していないサイトのトップが **1440×540 の空の灰色の板**だけだった
- About の写真未登録・シリーズの表紙未設定で、空の四角を場所取りしていた
- Journal の札で抜粋の開始位置が **19px** ずれていた
- **スマホで Settings だけ見出しが 8px 左へ飛んでいた**（smoke が desktop 限定で
  見落とされていた。スマホ幅の検査を追加）
- 入力エラーと空状態の文言が英語直書き。エラー色も暗いテーマで 2.87:1 だった

### 検証の状態

- `bun run check` **成功**（886 pass / 0 fail・exit 0）
- `bun run smoke` は同じ日に2回流して**毎回1件だけ、別々の spec が30秒で落ちた**。
  **どちらも単独では4.0秒・8.2秒で通る**ので今回の変更が原因ではない
  （経緯は `backlog.md` S-2）
- 新設定6つは実ブラウザで全選択肢を実測（日英・スマホ・PC・横あふれ）
- 押せる範囲・コントラスト・焦点・動きの抑制・長い名前・ビューアの操作は
  **測って問題なし**（`backlog.md` に記録）

### 次の一手

- **オーナーが push する。** 反映後、新しい2節（作風／ページの構成）を本番で見る
- **作風プリセットの名前と中身はオーナー未確認。** 好みに合うか要判断

### 触ってはいけない範囲

- `git push`（オーナーだけ）/ 本番DB / Turso / R2 / Railway / 環境変数 / `.env`
- smoke は本番と同じDBにつながる。**書き込み操作を増やさない**
- 範囲を `setting-ranges.ts` 以外へ、最小タイル幅を `gallery-metrics.ts` の外へ
  数値で書き戻さない
- **節を足したら `scripts/smoke/helpers.ts` の `SETTINGS_SECTION_COUNT` も直す**
- **custom property の暗側上書きは `:root` より後に置く**（同特異度で後勝ち）
- **作風プリセットに色・書体・本人の文章を入れない**
- **`.tap-target` を測るときは Playwright に `hasTouch` を付ける**（付けないと誤診）
- ビューアは素の `<dialog>`。Tab で一瞬 BODY になるのは折り返しで不具合ではない
- **popstate を「同じパスか」で見分けない。** `historyBridge` の印で判定する
- **後から現れる要素を測る effect の依存を `[]` にしない**（帯の実例・`05b75f7`）
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
