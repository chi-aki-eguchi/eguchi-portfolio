# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-17 JST

- **Status:** admin のデザイン刷新。3件 commit 済み（色と書体 / 項目名と手応え /
  公開サイトの色との同期）。**push はしていない。**
- **Current owner:** Claude Code（設計・実装・検証すべて） / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF` / originとの差と作業ツリーの状態は
  `git status --short --branch` で測り直す

### 目的と完了条件

オーナーが選んだ方向は4つ（動きと反応 / 色と書体 / 密度とリズム / 使用感）、対象は
**全タブまとめて**。よって画面ごとではなく共通の視覚言語（`styles.css` の
`.admin-atelier` と `admin-ui.tsx`）を触る。正本は `docs/specs/admin-renewal-goal.md`
で、P1〜P3 は達成済み。残りは P4「可愛さと動き」と見た目そのもの。

### 完了（3件 commit 済み・push なし）

- 紙とインクに温度: `#f7f7f7`/`#1a1a1a` → `#f7f5f1`/`#1b1917`（本文16.1:1）
- 見出しの和文を名指し（Shippori Mincho。index.html で読込済みのため通信は増えない）
- **文字の太さを公開サイトから切り離した。** `--body-weight: 700` を admin が継ぎ、
  太さ未指定の補足文・入力値・一覧行が全部700（ラベル400より太い＝階層が逆転）
- 項目名を500へ。補足文と一覧メタの色から透明度を外した（実効色が 3.57:1 で、
  12pxの文字に必要な4.5:1に届かず。プレースホルダは薄いまま＝空欄が分かるため）
- 共通ボタン `.ax-btn` に押し込みの手応え（グローバルの `:active` から除外され、
  押しても何も返らなかった）。押下は即時・戻りだけ160ms
- **色を公開サイトの設定と同期**（下記オーナー判断）。明暗を解決してから色を作るので、
  暗いモードの追従も直った

### 次に効く発見（着手前に読むこと）

- **色の実体は `admin.tsx` の `adminThemeFromSettings` / `ATELIER_PAPER`**（インライン
  style なのでCSSより強い）。`styles.css` 側は控え。**CSSだけ変えても画面は変わらない**
- 開発サーバは片方だけHMRされた中間状態を返す。色が変わらないときは admin.tsx を疑う

### オーナー判断だったもの（2026-08-17 に回答あり・実装済み）

1. **色は公開サイトと同期する。**「独立させない。adminで変えられる公開サイトの色と
   同期させよう」。2026-08-07 の「切り離す」方針は撤回。差し色も同期し、意味を持つ
   4色と書体は同期しない。読めない組み合わせは足りない分だけ自動で寄せる
2. **暗いモードは判断を委任された。** 明暗を解決してから色を作る形にして、
   効いていなかった追従を直した（インライン style が CSS に勝っていた）

### 検証

- `bun run check` 全段通過（postgres-schema → typecheck → lint → test → test:tools → build）
- `bun run smoke` を3回。**最終回は 330 passed / 0 failed。** 途中の失敗は、旧い紙の色を
  直書きで期待していたテスト（更新済み）と、一過性の 404 console error（再実行で通過）
- 新テストは3件とも「修正前に落ちること」を確認済み
- 本番・Railway反映・実機は**いずれも未実施**

### 次の一手 / 触ってはいけない範囲

- 4方向のうち「色と書体」「使用感（手応え・階層）」に着手済み。**密度とリズム**と
  P4「動きと反応」の本体（数値の入れ替わり・チェックの付き方・空状態の佇まい）は未着手
- **push はオーナーのみ。** originとの差は `git status --short --branch` で測る
- 触ってはいけない: `shotAt` の保存方法、公開API応答形、Lightbox の既存ロジック、
  `site-and-data-direction.md` §2「作らないもの」と §9 の11段
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
