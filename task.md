# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-06 JST

- **Status:** admin スマホ改善の**段階1・依頼1〜4と段階2・依頼5〜8を完了**。
  段階3へ進行中
- **Current owner:** Codex（依頼9へ継続中）/ **Handoff readiness:** not ready
- **Branch:** `main` / **HEAD:** `SELF` / **Git:** 実装はlocal commit済み。
  未追跡は `scripts/smoke/scratch/` のみ

### 目的と完了条件

写真家がプログラミング知識なしでスマホから迷わず管理できる `/admin` にする。
設計正本は `docs/specs/admin-mobile-usability-plan.md`。段階1の4件を1件ずつ実装し、
既存機能を減らさず、デスクトップとスマホの両方を検証する。

### 完了したこと

1. 調査・設計を `docs/specs/admin-mobile-usability-plan.md` に確定
2. 依頼1: SegmentedControl専用の選択文字色が、共通の `aria-pressed` 規則に
   負けていた。共通規則は変えず、専用規則だけを必要な強さにした
3. 修正前の実測は文字 `rgb(26,26,26)` / 指示子 `rgb(26,26,26)`、
   コントラスト比1:1。修正を外すと落ちる実ブラウザテストを追加
4. 明・暗テーマ、desktop、390px mobileで選択ラベルと指示子の比を数値検査
5. 依頼2: 検索・複合絞り込み・手動以外の表示順では「並べ替え」をdisabledにし、
   理由と「解除して並べ替える」を入口に表示。シリーズ単独絞り込みは維持
6. 依頼3: 検索は絞り込み件数から除外。全条件を専用行に表示し、個別×と
   「すべて解除」を追加。検索と絞り込みのアイコンを分離
7. 依頼4: JPの英語操作語を辞書へ移し、主要画面とEN切替を実ブラウザ確認。
   写真編集は専用alert、一括操作は共通toastで保存失敗が画面に出ると確認
8. 依頼5: スマホの写真編集を「基本/分類/詳細」に分割し、保存状態と操作を
   画面下へ固定。通信失敗時の表示と再試行も偽の500応答で確認
9. 依頼6: スマホの選択操作を下部固定。公開/非公開/カテゴリ/シリーズを表に出し、
   残りは「その他」に収納。選択数の重複をなくし、終了と取り込みも維持
10. 依頼7: スマホ作業バーを100px以下へ圧縮。選択入口を表へ、並べ替えを表示内へ
    移し、絞り込みは写真を押し下げない固定シートと件数footerへ変更
11. 依頼8: 作業バー/絞り込み/写真編集/選択操作の全可視操作を実機相当で測り、
    幅と高さが40px以上になる規則と回帰テストを追加

### 次の一手

- 次は設計書の**段階3・依頼9**「Settingsの語彙と2階建て化」
- `scripts/smoke/scratch/` はClaudeの調査用未追跡ファイル。内容を保護し、
  オーナー判断なしに追加・削除しない

### 検証の状態

- `bun run check` **成功**
- `bun run smoke` **成功**（306 passed / 115 skipped / 0 failed）
- 専用テストは修正前にコントラスト比1で失敗し、修正後はdesktop/mobileで成功
- 写真編集は375/390px、保存のclean/dirty/error/retryを実ブラウザで確認
- local commit済み / push・Railway反映・本番確認は未実施

### 測るときの落とし穴

**正本は `docs/agents/measuring.md`。着手前に読む。**
**見た目が想定と違ったら `getComputedStyle` で実測して上書き元を探す。**
今回の P0 は、CSSに正しい指定が書いてあるのに勝てていないという形だった。
シートのアニメーション中に撮ると、状態を誤読する（3秒待って撮り直して確定させた）。
Current State へ「すぐ古くなる値」（ahead件数・push状況）を書かないこと。

### 触ってはいけない範囲

- `git push`（オーナーだけ）/ 本番DB / Turso / R2 / Railway / 環境変数 /
  公開設定 / `.env` の表示・記録 / `docs/archive/` の本文
- 写真の並べ替えは `photo-reorder-safety.ts` の競合検知と
  `onlySeriesFilter` の条件を壊さない（入口を締めても出口を緩めない）
- 既存の `data-library-*` 目印を消さない（実ブラウザテストが読んでいる）
- 同じ worktree を2人で同時に編集しない
- 週枠が両者とも少ない。**範囲を縮めず1区切りを小さくして都度 commit**
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
