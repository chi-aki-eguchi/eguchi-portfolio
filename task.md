# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-27 JST

- **Status:** admin 刷新と公開サイトの手直しを枝で進行中。作業は全部この枝の上。
  push 状況の測り方: `git rev-list --left-right --count origin/main...HEAD`
- **Branch:** `redesign/admin-2026-08` / **HEAD:** `SELF`
- **Current owner:** Claude Code

### 枝でやったこと

| commit | 内容 |
|---|---|
| `81b49a9` | 左ナビのアイコンを外し明朝へ / accent 青灰→暖色 / Settings プレビュー既定ON |
| `c852d0b` | Settings の短い項目を2列に組む |
| `e574fbd` | 空の追加フォームを畳む（Series・Categories）/ シリーズ表紙 84→132px |
| `90860a6` | Settings の見出しだけ24px左へ飛ぶ回帰を修正 |
| `002e5cb` | 既定値の変更で崩れた smoke の前提を直す |
| `c0d49fc` | 上の修正で消えていた2列組みを戻す |
| `1b774a6` | **案3: Library を左ナビの主役にする** |
| `52bf671` | **案2: 左ナビと同名だった Settings の節に、何を決めるかを付ける** |
| `6e9128f` | **公開サイト**: 触れると震えるボタン / 水増ししたシリーズ帯 / 明滅する骨組み / 角丸の写真 / 絞り込み2段の間 / PC の最小文字 |
| `7956d1f` | **公開サイト**: 書いた言葉が出るように（写真の説明文はどこにも出ていなかった / 札が写真に重なって読めない / 作家の言葉が本文より薄い） |
| `89900af` | **公開サイト**: ギャラリーに奥付。EXIF の汚れ（`----`・`0.0 mm f/0.0`・二重のメーカー名）を公開ページから外す |

### 検証（すべて枝の上）

- `bun run check` = **1112 pass / 0 fail（EXIT=0）**
- `bun run smoke` = **330 passed / 0 failed（EXIT=0）**。単独実行・最終形
- **本番（akieguchi.com）では未確認。**確認できるのは push 後だけ。

### 公開サイトの中身（2026-08-29 実測）

    公開写真 497枚 — 題名 0 / 説明 0 / 分類なし 403 / シリーズ外 425
    シリーズ 2本 — statement はどちらも空

**サイトに、人が書いた文が一つも無い。**出ているのは点数・カメラ名・撮影年月
だけで、全部プログラムが数えた値。デザインではなくここが天井になっている。
測り方: `/api/photos` を全件取り、各欄の空でない件数を数える
（`scratch/public-look.spec.ts` に置いた形）。

**オーナーの方針（2026-08-29 チャットで確認）**: 全部見せるのは変えない。
ただし**ここに入れる写真は改めて選定する**。→ 「選んだ写真だけ見せる」別枠は
作らない。公開・非公開で絞る。

**書ける欄が公開サイトに出るかは全数調査済み**（目印を全欄に入れて6ページ＋
ライトボックス＋ホバーを走査）。穴は `photo.description` だけで、修正済み。
`photo.meta` は移行用の旧欄、`printDescription` は販売 off のため出ないのが
正しい、`heroCaption` は存在しないキー。

### 次にやること

**案1: プレビューを Settings 以外のタブへも広げる。**オーナー承認済み・未着手。
`AdminSettingsPreviewPane` は独立した部品だが、周辺の状態（幅の記憶・
ドラッグできる分割線・live sync の payload）が Settings タブの中に埋まっている。
まずそこを取り出す。**途中で止めると動かない状態で残るので、まとめて取る。**

Hero / Profile は settings キーを編集するので live sync が効く。
Series / Pricing は別テーブルなので、保存後に再読み込みする形になる。

### 踏んだ罠（次に同じことをしないため）

- **`bun run smoke > log; echo "EXIT=$?"` は `echo` の終了コードを拾う。**
  これで17件の失敗を「通った」と誤読した。`echo "EXIT=$?" >> log` にする
- **smoke の実行中にファイルを書き換えると結果が混ざる。** 止めて回し直す
- **`usePersistentState` の既定の保存先は sessionStorage。**localStorage ではない。
  `sessionStorage.clear()` より後に置かないと消える
- **狭い幅では「開いている」と「見えている」が別。**`showPreview` が true でも
  narrowView が edit ならプレビューは出ない
- **スクショを1.2秒で撮ると読み込み前の姿が写る。**3.5秒待つ
- **`@container` の余白べた書きで見出しが24px飛んだ。**media query 側は
  2026-08-17 に直っていたが container query 側に残っていた
- **余白を直したら2列組みが4px差で消えた。**片方を直すと片方が崩れる幅なので、
  しきい値には余裕を取る
- **同じ作業ディレクトリで2つのセッションが同時に動くと混ざる。**
  2026-08-27、別セッションの `git add -A` が、こちらの作業中の `styles.css`
  を `1b774a6`（admin の案3）へ巻き込んだ。commit の中身と題が合っていない。
  また、両方が smoke を回して 4310 を奪い合い、262件が
  `ERR_CONNECTION_REFUSED` で落ちた（コードの問題ではない）。
  **パス指定で `git add` する。smoke は片方ずつ回す。**

### 未コミット（意図的）

`AGENTS.md` `CLAUDE.md` `docs/README.md` `docs/agents/backlog.md` の削減と、
`handoff-workflow.md` `credit-status.md` の archive 移動。**commit が自動モードの
判定に阻まれている**（エージェントが自分の制約を外す経路が塞がれている）。
オーナーの手で `git add -u && git commit` が要る。
<!-- CURRENT_STATE_END -->
<!-- CURRENT_STATE_END -->
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
