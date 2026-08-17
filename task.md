# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-18 JST

- **Status:** admin のデザイン刷新を継続（オーナー就寝中の明示依頼で夜間作業）。
  **6件 commit 済み / push はしていない。** 7件目（スマホ幅の一覧）は smoke 検証中。
- **Current owner:** Claude Code（設計・実装・検証すべて） / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF` / originとの差と作業ツリーの状態は
  `git status --short --branch` で測り直す

### 目的と完了条件

オーナーの依頼は「adminをもっとよくする / デザインとレイアウトをもっとよくする /
もっとおしゃれで可愛くしたい」。正本は `docs/specs/admin-renewal-goal.md`。
**可愛さは装飾を足さず小さな瞬間に置く**（丸み・パステル・キャラクター・絵文字は取らない）。
作業キューと「やらないと決めたこと」は `scratch/admin-charm-queue.md`。

### 完了（commit 済み・push なし）

1. 紙とインクに温度／見出しの和文を明朝で確定／**文字の太さの漏れを止めた**
   （公開サイトの `--body-weight: 700` を継ぎ、補足文が項目名より太かった）
2. 項目名と補足文の階層／12pxの文字のコントラスト(3.57→4.73:1)／ボタンの押し込み
3. **色を公開サイトと同期**（オーナー判断で「独立」を撤回）＋暗いモードの解決
4. 中間幅(1024px)の見出しずれ／**効いていなかった2列レイアウト**を直した
5. 「はじめに」の完了表示を警告枠から静かな一行へ
6. 行のホバー罫／サイドバーの現在地の罫／空の一覧の佇まい／検索欄を下罫線へ

### 次に効く発見（着手前に読むこと）

- **色の実体は `admin.tsx` の `adminThemeFromSettings` / `ATELIER_PAPER`**
  （インライン style なのでCSSより強い）。**CSSだけ変えても画面は変わらない**
- **CSSは順序で負ける。** 同じ強さの規則を前に置くと効かない（今回2回踏んだ）。
  見た目が変わらないときは `getComputedStyle` で実測してから上書き元を探す
- 開発サーバは片方だけHMRされた中間状態を返すことがある

### 検証

- `bun run check` は各commit前に実施。**1014 tests / 0 fail**
- `bun run smoke` は 330 passed / 0 failed を3回（色同期・レイアウト・はじめに・
  おしゃれ第1弾）。スマホ幅の一覧の分は実行中
- 実画面の確認: 1440 / 1024 / 390px、暗いモード、公開サイト色3種を撮って目視
- 本番・Railway反映・実機は**いずれも未実施**

### 次の一手 / 触ってはいけない範囲

- `scratch/admin-charm-queue.md` の残り（追加フォームの重さ、数字の表情など）
- **push はオーナーのみ。** originとの差は `git status --short --branch` で測る
- 触ってはいけない: `shotAt` の保存方法、公開API応答形、Lightbox の既存ロジック、
  `site-and-data-direction.md` §2「作らないもの」と §9 の11段
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
