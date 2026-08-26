# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-26 JST（15回目）

- **Status:** 散らかりの片付け + B-19 + B-22の一部 + specs索引。**push 済み。**
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF`

### やったこと

| commit | 内容 |
|---|---|
| （commit無し） | `scratch/` 2887MB → **47MB**。ログ213本・証跡フォルダを削除。`.md` 106本と `layout-mock` は残した |
| （commit無し） | 中身ゼロの枝2本を削除。`~/eguchi-finder-proto` の worktree を外した（枝の1commitは残存） |
| `bed944b` | Library の媒体の前置き「取り込み」→「媒体」（B-19。オーナー判断） |
| `494b9b7` | Library の検索欄を枠いっぱい32pxへ（B-22。実測17pxだった） |
| `e5b75ba` | `docs/specs/README.md` に21本の索引（層と優先順） |

### 実測でわかったこと

- **先読み（B-21）は本番で効いている。**`/`=12件 `/about`=9件 `/contact`=7件の
  modulepreload。経路ごとに違う＝`route-preload.ts` が意図どおり。
  HTML・`/assets/*` とも `content-encoding: gzip`、assets は `immutable`。
  **これで「本番未確認」が消えた。**
- **B-22 のサムネイルつまみ（4px）は記録が古く、既に直っていた**
  （`.ax-slider { height: 20px }`）。backlog から消した。
- `docs/specs` の admin 5本は重複ではなく階層だった。索引が無いだけ。

### 検証

- `bun run check` = **1111 pass / 0 fail（EXIT=0）**
- `bun run smoke` = **330 passed（EXIT=0）**
- 本番実測は上記のとおり（curl・読み取りのみ）

### 次にやること

- **B-22 の残り: Portfolio Kit タブの名前無しボタン2件・ラベル無し入力2件。**
  静的に読んでも場所が特定できない。backlog の「測り方」を先に走らせる
- **オーナーの実地確認が2件**: Stripe 決済導線（B-2）／
  取り込み目印（第1A, `608d677`）の線の強さ・文言・Escの体感
- **B-15**: `.env` の `ADMIN_PASSWORD` がリポジトリ直下と `packages/web/` で
  食い違う。**オーナーが片方を消すだけ。**エージェントは `.env` を触らない

### 触ってはいけない範囲

- 本番DB・Turso・R2・Railway・環境変数・`.env`
- `shotAt` の保存方法、公開API応答形、Lightbox の既存ロジック
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
