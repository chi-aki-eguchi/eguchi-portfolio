# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-17 JST

- **Status:** admin のデザイン刷新（オーナー指示「使用感とデザインを強化・少し変更」）に
  着手。1件目「紙と見出しと文字の太さ」を commit 済み。**push はしていない。**
- **Current owner:** Claude Code（設計・実装・検証すべて） / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF` / originとの差と作業ツリーの状態は
  `git status --short --branch` で測り直す

### 目的と完了条件

オーナーが選んだ方向は4つ（動きと反応 / 色と書体 / 密度とリズム / 使用感）で、
対象は**全タブまとめて**。よって画面ごとではなく共通の視覚言語（`styles.css` の
`.admin-atelier` と `admin-ui.tsx`）を触る。正本は `docs/specs/admin-renewal-goal.md`。
同仕様書の P1〜P3 は達成済みで、残りは P4「可愛さと動き」と見た目そのもの。

### 完了（commit `7537ccf` / 色と書体）

- 紙とインクに温度: `#f7f7f7`/`#1a1a1a` → `#f7f5f1`/`#1b1917`（本文16.1:1）
- 見出しの和文を名指し（Shippori Mincho。index.html で読込済みのため通信は増えない）
- **文字の太さを公開サイトから切り離した。** 公開サイトの `--body-weight: 700` を
  admin が継いでおり、太さ未指定の補足文・入力値・一覧行が全部700で出ていた
  （ラベル400より補足700が太い＝階層が逆転）。`.admin-atelier` で400を宣言

### 次に効く発見（着手前に読むこと）

- **紙とインクの定義は2箇所ある。** 実際に画面へ出るのは `admin.tsx` の
  `ATELIER_FALLBACK`（`adminThemeFromSettings` がインライン style で付けるため
  CSSより強い）。`styles.css` 側は控え。**CSSだけ変えても画面は変わらない。**
  一致は `admin-theme-independence.test.ts` が見張る
- 開発サーバは片方だけHMRされた中間状態を返すことがある。色が変わらないときは
  admin.tsx 側が古い可能性を先に疑う（今回30分溶かした）

### オーナー判断待ち（実装しない。仕様と実装が矛盾している）

1. **admin の紙は公開サイトの `themeBg`/`themeText` から作られている**
   （`adminThemeFromSettings`）。2026-08-07 の決定と CSS 側コメントは
   「公開サイトの色から独立」。現在 themeBg は空なので実害はないが、
   オーナーが背景色を設定した瞬間に管理画面まで追従する
2. **暗い方の追従は事実上効いていない。** `[data-theme=dark] .admin-atelier` は
   インライン style に負ける。「明暗の追従だけは残す」という記録と実装が食い違う

### 検証

- `bun run check` 全段通過（postgres-schema → typecheck → lint → test → test:tools → build）
- `bun run smoke` 327 passed / 2 failed。落ちた2件は旧い紙 `#f7f7f7` を直書きで
  期待していた `admin-debug-sweep`。期待値更新後 desktop / mobile 各1回通過
- 新テストは「修正前に落ちること」を確認済み（`.admin-atelier` に font-weight が
  無いことを `git show HEAD:` で確認）
- 本番・Railway反映・実機は**いずれも未実施**

### 次の一手 / 触ってはいけない範囲

- 残り3方向（密度とリズム / 動きと反応 / 使用感）は未着手。P4 は仕様書の
  「先に飾りを足さない」に従い、土台が揃ったこの順で入れてよい
- **push はオーナーのみ。** originとの差は `git status --short --branch` で測る
- 触ってはいけない: `shotAt` の保存方法、公開API応答形、Lightbox の既存ロジック、
  `site-and-data-direction.md` §2「作らないもの」と §9 の11段
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
