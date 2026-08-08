# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-08 JST

- **Status:** 公開サイト側の依頼4件のうち3件を実装・commit 済み。
  残り2件（TOPのシリーズ流し見／安定性の棚卸し）は未着手
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF` / **Git:** `9b7e29a` まで local commit 済み。
  push は未実施。未追跡は `scripts/smoke/scratch/`（以前からある調査用）

### 完了したこと（今回）

1. **写真ビューアを白い壁に**（`76a854a`・オーナー決定）。背景を黒→白。暗色テーマ
   でもビューアは常に白なので、UIは黒インクへ反転。**テーマ変数は参照しない**
   （参照すると暗色時にインクまで白へ反転し、白い壁の上で読めなくなる）
2. **閉じるときの横跳ね**（`76a854a`）。`overflow:hidden` でスクロールバーが消え、
   本文が **1276px→1280px** に広がっていた。同じ幅を padding で埋める
3. **閉じたあとページ移動でスクロール位置が壊れる**（`55eb753`）。ビューアの
   `history.back()` を PageTransition が「戻るボタン」と誤記録し、印が消費されず
   残っていた。**修正前は移動先で `scrollTo(900)` が8回**呼ばれることをテストで確認
4. **シリーズの入口を1本に**（`9b7e29a`・オーナー判断）。Gallery上部の
   Photos/Series タブを撤去。ナビの Series（`seriesNavEnabled` で制御）だけにする。
   効き先が消えた `worksDefaultView` は台帳・API既定・管理UI・文言・smokeから削除

### 検証の状態

- `bun run check` **成功**（exit 0、802 pass / 0 fail。今回 +5件）
- 新しい回帰テスト5件。**横跳ねと popstate の2件は、修正を戻すと落ちることを確認済み**
- 実ブラウザ実測（ローカル dev）: 白い壁の表示、Gallery から Photos/Series タブが
  消えていること、`/series` がナビに残ることを確認
- **smoke は未実行**（25分・Codexの週枠が少ない）。admin の文言を変えたので要実行
- local commit 済み / push・Railway反映・本番確認は**未実施**

### 次の一手

- **オーナーが push する。**
- TOPページにシリーズを「オシャレに流し見」させる（未着手・見せ方の合意が要る）
- 公開サイトの安定性の棚卸し。オーナー申告は4分類すべて＋
  「仕様上は正しいけど変なもの」。**まず実測して一覧にするところから**
- smoke 実行（今回 admin の Series セクションの文言とフィールドが1つ減っている）

### 触ってはいけない範囲

- `git push`（オーナーだけ）/ 本番DB / Turso / R2 / Railway / 環境変数 / `.env`
- smoke は本番と同じDBにつながる。**書き込み操作を増やさない**
- 範囲を `setting-ranges.ts` 以外へ数値で書き戻さない（テストが落ちる）
- `.admin-login` は「扉」として意図的に公開サイトの色・書体へ追従している
- ビューアの色に公開サイトのテーマ変数を使わない（上記1の理由）
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
