# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-17 JST

- **Status:** admin のデザイン刷新（オーナー指示「使用感とデザインを強化・少し変更」）に
  着手。1件目「紙と見出しと文字の太さ」を commit 済み。**push はしていない。**
- **Current owner:** Claude Code（設計・実装・検証すべて） / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF` / originとの差と作業ツリーの状態は
  `git status --short --branch` で測り直す

### 目的と完了条件

オーナーが選んだ方向は4つ（動きと反応 / 色と書体 / 密度とリズム / 使用感）、対象は
**全タブまとめて**。よって画面ごとではなく共通の視覚言語（`styles.css` の
`.admin-atelier` と `admin-ui.tsx`）を触る。正本は `docs/specs/admin-renewal-goal.md`
で、P1〜P3 は達成済み。残りは P4「可愛さと動き」と見た目そのもの。

### 完了（2件 commit 済み・push なし）

- 紙とインクに温度: `#f7f7f7`/`#1a1a1a` → `#f7f5f1`/`#1b1917`（本文16.1:1）
- 見出しの和文を名指し（Shippori Mincho。index.html で読込済みのため通信は増えない）
- **文字の太さを公開サイトから切り離した。** `--body-weight: 700` を admin が継ぎ、
  太さ未指定の補足文・入力値・一覧行が全部700（ラベル400より太い＝階層が逆転）
- 項目名を500へ。補足文と一覧メタの色から透明度を外した（実効色が 3.57:1 で、
  12pxの文字に必要な4.5:1に届かず。プレースホルダは薄いまま＝空欄が分かるため）
- 共通ボタン `.ax-btn` に押し込みの手応え（グローバルの `:active` から除外され、
  押しても何も返らなかった）。押下は即時・戻りだけ160ms

### 次に効く発見（着手前に読むこと）

- **紙とインクの定義は2箇所ある。** 画面へ出るのは `admin.tsx` の
  `ATELIER_FALLBACK`（インライン style なのでCSSより強い）。`styles.css` 側は控え。
  **CSSだけ変えても画面は変わらない**（一致は独立性テストが見張る）
- 開発サーバは片方だけHMRされた中間状態を返す。色が変わらないときは
  admin.tsx 側が古い可能性を先に疑う

### オーナー判断待ち（実装しない。仕様と実装が矛盾している）

1. **admin の紙は公開サイトの `themeBg`/`themeText` から作られている**
   （`adminThemeFromSettings`）。2026-08-07 の決定は「公開サイトの色から独立」。
   現在 themeBg は空で実害はないが、背景色を設定した瞬間に管理画面まで追従する
2. **暗い方の追従は事実上効いていない。** `[data-theme=dark] .admin-atelier` は
   インライン style に負ける。「明暗の追従だけは残す」という記録と実装が食い違う

### 検証

- `bun run check` 全段通過（postgres-schema → typecheck → lint → test → test:tools → build）
- `bun run smoke` を2回。1回目 327 passed / 2 failed（旧い紙 `#f7f7f7` を直書きで
  期待していた `admin-debug-sweep`。期待値を更新して desktop / mobile 各1回通過）。
  2回目 329 passed / 1 failed で、落ちたのは同スペックが拾った 404 の console error
  2件。**再実行すると通る一過性**で、今回の変更はCSSのみ
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
