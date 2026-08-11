# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-11 JST

- **Status:** オーナー就寝中の自走。**公開サイトと admin の見直し／選べる範囲の拡張／
  違和感の修正**。commit 40本が push 待ち
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF` / **Git:** clean・未追跡なし / **origin より 40 先**

### 選べる範囲を広げた

**骨格そのものを選べるようにした。**新キー7つ（既定は従来どおりで既存サイトは不変）:

`profileLayout`（About 3種）/ `contactLayout`（3種）/ `seriesCardStyle`（3種）/
`footerLayout`（3種）/ `pageTitleStyle`（4種）/ `homeStatement`（TOPに作家の言葉。
文章は Profile を再利用）/ `viewerStyle`（ビューアの壁3種・オーナー承認済み）
**作風プリセット**（しずか／雑誌／展示／暗室）も追加。既存設定を16個まとめて
入れ替えるが、押しても保存せず**下書きに入るだけ**なので、見てから決められる。

### 使用感・見た目（オーナー指示で着手）
- **公開4ページの余白がばらばら**で、移動のたび本文がずれていた。左右
  16/24/20/24px → `.site-page` で24/48px、上端 8/8/5/6rem → `.site-page-top` で統一
- Gallery の絞り込み2本が同じ見た目。フィルム/デジタルを一段小さくした
- **スマホのメニューを開いている間、後ろが流れていた**。ビューアと同じく止める
- 日本語の本文が語の途中で切れていた。`.ja-prose` を本文だけに当てた

### 直した「違和感」
- 何も登録していないサイトのトップが **1440×540 の空の灰色の板**だけだった。
  About の写真未登録・シリーズの表紙未設定でも空の四角を置いていた
- **スマホで Settings だけ見出しが 8px 左へ飛んでいた**（smoke が desktop 限定）
- 入力エラー・空状態が英語直書き。エラー色も暗いテーマで 2.87:1 だった
- **取得失敗を「まだシリーズがありません」と言っていた**（fail-quiet trap）。
  シリーズ詳細も500と404を一緒に扱っていた
- **他人のデータで崩れる箇所を10箇所以上直した。** 折り返せない長い語で
  About 1650px / シリーズ詳細 1654px / 撮影依頼の帯 1147px へ伸びていた（320px実測）

### 検証の状態

- `bun run check` 898 pass / 0 fail・`bun run smoke` 307 passed / 0 failed（直近5回とも）
- 新設定7つは実ブラウザで全選択肢を実測（日英・スマホ・PC・横あふれ）
- 押せる範囲・コントラスト・焦点・動きの抑制・ビューア操作・Kit販売ページ・
  管理画面は**測って問題なし**（`backlog.md`）

### 次の一手

- **オーナーが push する。** 反映後、新しい2節（作風／ページの構成）を本番で見る
- **作風プリセットの名前と中身はオーナー未確認。** 好みに合うか要判断
- B-18（選択帯の重複9箇所）は着手を見送った。やるかどうかはオーナー判断

### 触ってはいけない範囲
- `git push`（オーナーだけ）/ 本番DB / Turso / R2 / Railway / 環境変数 / `.env`
- smoke は本番と同じDBにつながる。**書き込み操作を増やさない**
- 範囲は `setting-ranges.ts`、最小タイル幅は `gallery-metrics.ts` の外へ書き戻さない
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
