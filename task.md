# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-23 JST（9回目）

- **Status:** 見た目・高級感の実測と修正。**commit 済み・push 未実施（3件）。**
  午前の圧縮3件は push 済み・本番反映確認済み。
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF`

### 未 push の3件（ゲートは全部通っている）

1. `e219eab` **列が中身の数を超えていた。** Series 一覧がシリーズ2件に
   `repeat(3,1fr)` を固定で敷き、右3分の1が空いていた（到達点 #5 違反）。
   件数に合わせて列を減らす。表紙 313px → **443px**。写真グリッドも同じ欠陥
2. `106ef8b` **行頭に長音符が落ちていた。** Settings の目次が
   「ホバ / ー」と割れていた。`line-break: strict`。違反 1 → **0件**
3. `931e4ca` **Settings の説明文が多すぎた。** 画面に見える説明行 **6 → 1**

### 3 に使った規則（オーナー確認待ち）

- 「空欄で非表示」は書かない（当たり前で意外ではない）
- 「空欄なら別のものが出る」だけ残し、置き場所は placeholder
- 位置の説明は書かない（ラベルとライブプレビューで分かる）

**辞書全体の hint はまだ64個。** この規則でよければ残りの節へ広げる。
文言はオーナーの声なので、1節だけ見せて反応を待っている状態。

### 検証

- `bun run check` = **1060 pass / 0 fail** / `bun run smoke` = **330 passed / 0 failed**
- 禁則は実ブラウザで Range を使って測る（`docs/agents/measuring.md`）
- 横あふれを公開5ページ×3幅・admin 3タブ×3幅で確認（0件）
- **本番未確認**（push していない）

### 分かっているが未着手

- **Settings のライブプレビューが 1280/1440/1680/1920px のどの幅でも
  横に出ない。** 「プレビューを開く」を押さないと出ず、右側が空いたまま
- backlog B-21（経路チャンクが `modulepreload` されない）
- 公開サイトの `galleryLayout` は `clean-grid`・列数8（上限）で、仕様書の
  「不揃い・余白主導」と逆。**これはオーナーの設定なので触っていない**

### 触ってはいけない範囲

- 本番DB・Turso・R2・Railway・環境変数
- `shotAt` の保存方法、公開API応答形、Lightbox の既存ロジック
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
