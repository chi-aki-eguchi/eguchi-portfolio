# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-24 JST（14回目）

- **Status:** admin の使いやすさ・スマホの見やすさ・初回表示の先読み。7件完了、
  **すべて push 済み**（`733225c`）。**本番反映を待って実測中。**
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF`

### 完了

| commit | 内容 | 実測 |
|---|---|---|
| `7768356` | Library の列数 2/3 → **2〜6** | 820pxタッチが1列→6列 |
| `acf5548` | admin の足元の余白を条件付きに | 常時96px → 40px |
| `085f848` | スマホの小さい文字に下限 | 最小 9px → 11px |
| `130df66` | スマホのページ見出し | h1 11px → 13px |
| `ca0d59d` | 並べ替えの上下ボタン | 14×14 → 24×24 |
| `a091214` | 狙いにくい／名前の無い操作 | **32件 → 3件** |
| `c70c78e` | 経路ごとのJSを先読み（B-21） | **2波186ms → 1波1ms** |

### 先読み（B-21）の作り

`vite.config.ts` に `build.manifest: true`、`api/route-preload.ts` が経路→
チャンクを引いて `<link rel="modulepreload">` を組む。

- **PWA の `dist/manifest.json` と Vite の `dist/.vite/manifest.json` は別物。**
  取り違えると8エントリの PWA 側を読んでしまう
- HTML が既に持ち込むもの（entry とその imports）は足さない
- manifest が無くても先読みが出ないだけで動く（dev / 未生成）
- `/admin` は先読みしない
- **`app.tsx` とずれても画面は動くので気づけない。** 表に無い公開経路が
  足されたらテストが落ちる
- Dockerfile / .dockerignore が無く Railway はリポジトリをそのまま使うので、
  ドット始まりの `dist/.vite/` も配布される（確認済み）

### 検証

- `bun run check` = **1111 pass / 0 fail（EXIT=0）**
- `bun run smoke` = **331 passed（EXIT=0）**
- **本番未確認。** 反映後に `curl` で modulepreload が出ているかを見る
- **ゲートは `> log 2>&1; echo "EXIT=$?"` で判定する。** 今回これで
  負荷由来の赤を push 前に2回捕まえた

### 触っていないもの（オーナーの設定）

- 公開の本文12px・「Photography」10px・PCのページ見出し11px
- `galleryLayout: clean-grid`・列数8

### 次にやること

- 本番反映後の実測（先読みが出ているか、圧縮と併せて）
- backlog **B-22** の残り3件（実害は小さい）

### 触ってはいけない範囲

- 本番DB・Turso・R2・Railway・環境変数
- `shotAt` の保存方法、公開API応答形、Lightbox の既存ロジック
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
