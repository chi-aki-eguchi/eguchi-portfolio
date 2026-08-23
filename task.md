# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-23 JST（9回目）

- **Status:** 見た目・高級感の実測と修正。**commit 済み・push 未実施（5件）。**
  午前の圧縮3件は push 済み・本番反映確認済み。
- **Current owner:** Claude Code / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `SELF`

### 未 push（ゲートは全部通っている。オーナーが実物を見てから push する）

1. `e219eab` **列が中身の数を超えていた。** Series 一覧がシリーズ2件に
   `repeat(3,1fr)` を敷き、右3分の1が空いていた（到達点 #5 違反）。
   件数に合わせて減らす。表紙 313px → **443px**。写真グリッドも同じ欠陥
2. `106ef8b` **行頭に長音符が落ちていた。** Settings 目次の「ホバ / ー」。
   `line-break: strict` で違反 1 → **0件**
3. `931e4ca` + `88e8804` **Settings の説明文。** hint 日英計 **64 → 14**。
   画面に見える説明行は「サイト基本情報」で **6 → 1**

### 説明文に使った規則（オーナー未確認）

- 「空欄で非表示」は書かない（当たり前で意外ではない）
- 「空欄なら別のものが出る」だけ残す。置き場所は placeholder
- ラベルの言い換えを書かない（「Gallery リンク」に「ヘッダーナビの
  Gallery リンク」。SNS3欄は同じ文を3回繰り返していた）
- 名前が近い2欄を区別する説明は残す（View all リンク／ボタン）

### 検証

- `bun run check` = **1060 pass / 0 fail**
- `bun run smoke` = **330 passed / 0 failed**（4件それぞれの後に実施）
- 禁則は実ブラウザで Range を使って測る（`docs/agents/measuring.md`）
- 横あふれ 0件（公開5ページ×3幅・admin 3タブ×3幅）
- **本番未確認**（push していない）

### 測って問題が無かったもの（再調査しないために）

- **到達点 #1 は満たされている。** admin 9タブすべて `<h1>` 34px・
  左端292px で完全一致。ばらつきゼロ
- トークン層は健全。イージング7種が119箇所、素の cubic-bezier 直書きは1件

### 分かっているが未着手

- 「ページの構成」の節は選択帯ごとに説明があり、段落も2つ挟まる（別キー）
- Settings のライブプレビューは既定 `false` の**トグル**。既にオーナーが
  選べるものなので触っていない
- backlog B-21（経路チャンクが `modulepreload` されない）
- 公開の `galleryLayout` は `clean-grid`・列数8（上限）。**オーナーの設定**

### 触ってはいけない範囲

- 本番DB・Turso・R2・Railway・環境変数
- `shotAt` の保存方法、公開API応答形、Lightbox の既存ロジック
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
