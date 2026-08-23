# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-24 JST（10回目）

- **Status:** 公開サイトの機能追加と見た目の修正。**すべて push 済み**（`d20b52f`）。
  本番反映は未確認。
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF`

### 足した機能（新しい入力欄も新しい通信も増やしていない）

1. `3454383` **シリーズ詳細の巻頭。** オーナーが選んだ表紙は一覧でしか
   使われていなかった。詳細を表紙で開き、題名をその上に載せる
2. `ab0b93a` **作品群の奥付。** 「59点 ／ デジタル ／ 2024年8月–2025年8月」＋
   カメラ・レンズ。ページが既に持つ写真から計算する
3. `d20b52f` **一覧の札に規模と時期。** 押す前に5点の組と59点の組が分かる。
   `/series` に集計を1クエリ追加（N+1にしない）

### 直したもの

- `e219eab` 列が中身の数を超えていた（Series 表紙 313→443px）
- `106ef8b` 行頭に長音符が落ちていた（`line-break: strict`）
- `931e4ca` `88e8804` Settings の説明文 hint 64 → 14
- `8e9c03a` 圧縮の訂正を残りの規則ファイルへ

### 検証

- `bun run check` = **1087 pass / 0 fail**
- `bun run smoke` = **330 passed / 0 failed（EXIT=0）**
- **本番未確認**（push しただけ。Railway 反映後に見る）

### この回で踏んだ失敗（同じことをしないため）

- **`bun run smoke 2>&1 | tail` で終了コードが消え、赤いまま push した。**
  必ず `> log 2>&1; echo "EXIT=$?"` で判定する
- コントラストを2回測り損ねた（余白を最悪値に入れた／文字の縁を地と誤認）
- 見出しを探すフィルタ `left < 300` で、292px にある見出しを弾いて誤診しかけた

すべて `docs/agents/measuring.md` に測り方として記録済み。

### 次にやること（オーナー判断待ち／Cは判断不要）

- **A. 英語を全ページへ。** 土台はある（hreflang・sitemap・JP|EN 切替）が、
  シリーズの題名と作家の言葉に英語の列が無い。**スキーマ変更＋入力欄が要る**
- **B. 公開の見え方。** `galleryLayout: clean-grid`・列数8（上限）。
  **オーナーの設定なので触っていない。**効果はコードより大きい
- **C. 経路チャンクの先読み**（backlog B-21）。判断不要。Vite の
  build manifest を出す設定から要る

### 触ってはいけない範囲

- 本番DB・Turso・R2・Railway・環境変数
- `shotAt` の保存方法、公開API応答形、Lightbox の既存ロジック
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
