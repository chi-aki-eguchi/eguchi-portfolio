# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-18 JST

- **Status:** admin のデザイン刷新（オーナー就寝中の明示依頼で夜間作業）。
  **今夜10件の実装＋記録を commit 済み。push はしていない。作業ツリーはクリーン。**
- **Current owner:** Claude Code（設計・実装・検証すべて） / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF` / originとの差は
  `git status --short --branch` で測り直す

### 目的と完了条件

「adminをもっとよくする / デザインとレイアウトをもっとよくする / もっとおしゃれで
可愛くしたい」。正本は `docs/specs/admin-renewal-goal.md`。**可愛さは装飾を足さず
小さな瞬間に置く**（丸み・パステル・キャラクター・絵文字は取らない）。
作業キューと「やらないと決めたこと」は `scratch/admin-charm-queue.md`。

### 完了（commit 済み・push なし）

1. 紙とインクに温度／見出しの和文を明朝で確定／**文字の太さの漏れを止めた**
2. 項目名と補足文の階層／12pxの文字のコントラスト(3.57→4.73:1)／ボタンの押し込み
3. **色を公開サイトと同期**（オーナー判断で「独立」を撤回）＋暗いモードの解決
4. 中間幅(1024px)の見出しずれ／**効いていなかった2列レイアウト**
5. 「はじめに」の完了表示を警告枠から静かな一行へ
6. 行のホバー罫／サイドバーの現在地の罫／空の一覧の佇まい／検索欄を下罫線へ
7. **スマホ幅(390px)の一覧で切り詰められていた名前に幅を返した**
8. **読み込み中に見出しが消える3画面（Hero / Profile / Settings）を直した**
9. プレビュー表示で保存状態の文が1文字だけ行末に落ちるのを直した
10. ⌘K の案内文が「Trash」、項目名が「ゴミ箱」で食い違っていたのを直した

### 次に効く発見（着手前に読むこと）

- **色の実体は `admin.tsx` の `adminThemeFromSettings` / `ATELIER_PAPER`**
  （インライン style なのでCSSより強い）。**CSSだけ変えても画面は変わらない**
- **CSSは順序で負ける。**同じ強さの規則を前に置くと効かない（今回2回踏んだ）
- **スモークは「遅れて出る要素」を捕まえられない**（`toHaveCount` が待つため）。
  読み込み中の一瞬は `admin-tab-loading-header.render.test.tsx` が見張る
- **「半端に見える」が全部不具合ではない。**複数行入力の下端の覗きは実測すると
  ちょうど3行で、スクロールの合図だった（直しかけて取り消した）

### 検証

- `bun run check` を各commit前に実施。最終 **1019 tests / 0 fail**
- `bun run smoke` を6回。すべて **330〜331 passed / 0 failed**
- 実画面: 1440 / 1024 / 390px、768〜1920pxの6段階、暗いモード、英語表示、
  公開サイト色3種、Settingsプレビュー表示を撮って目視
- 本番・Railway反映・実機は**いずれも未実施**

### 次の一手 / 触ってはいけない範囲

- backlog **B-19**（Libraryの「取り込み」の語）はオーナー判断待ち
- 未調査: ゴミ箱の画面（⌘K に項目はあるが、開き方を特定できていない）。`scratch/admin-charm-queue.md` に残りの候補
- **push はオーナーのみ。** originとの差は `git status --short --branch` で測る
- 触ってはいけない: `shotAt` の保存方法、公開API応答形、Lightbox の既存ロジック、
  `site-and-data-direction.md` §2「作らないもの」と §9 の11段
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
