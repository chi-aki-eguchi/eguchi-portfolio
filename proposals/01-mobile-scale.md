# 企画書 #01 — モバイル縮小率 `--mobile-scale`（A4）

状態: **提案（未実装・承認待ち）** ／ 起案 2026-06-14 ／ 区分 B（実装キュー）

## 1. 背景・課題
- ヒーロー名など主要テキストは CSS変数（`--hero-name-size` 等）で admin から自由設定できる（`top.tsx:369-421`）。
- だが**モバイル専用の縮小が一切ない**（コードに `mobile-scale` 系は皆無＝監査で確認）。
- 既定値（ヒーロー名 1.75rem）はスマホでも収まるが、admin で大きめに設定すると**スマホでヒーロー名が画面幅をはみ出す**。design-spec の「写真主役・余白主導」を崩す。
- CLAUDE.md でも A4 は「優先度高（ヒーロー名はみ出し解消）」と明記済みの宿題。

## 2. 提案
単一の係数 `--mobile-scale`（0.6〜1.0、既定 0.78）を導入し、`@media (max-width: 768px)` で
主要サイズ変数に `calc(var(--xxx) * var(--mobile-scale))` を掛けて一括縮小する。
admin から係数1つで「スマホ時の詰まり具合」を調整できる。

対象サイズ変数（第一弾はヒーロー周辺に限定してリスクを抑える）:
`--hero-name-size` / `--hero-name-en-size` / `--hero-sub-size`
（将来拡張: `--heading-size` / `--section-label-size`）

## 3. 実装範囲（§0「settingsキーは4箇所同期」厳守）
新規キー `mobileScale`（文字列、既定 "0.78"）を以下に**セットで**追加:
1. `web/lib/settings-preview.ts` の `SETTINGS_PREVIEW_KEYS`（CSS変数駆動なので JS_PREVIEW_KEYS は不要）
2. `api/index.ts` `GET /settings` の default に `mobileScale: "0.78"`
3. `provider.tsx` の DB適用 useEffect で `set("--mobile-scale", data?.mobileScale)`
4. `provider.tsx` の `handlePreviewMessage` で `applyVar("--mobile-scale", s.mobileScale)`

CSS（`styles.css` の `@media (max-width: 768px)` ブロックに追記）:
```css
@media (max-width: 768px) {
  :root {
    --hero-name-size:    calc(var(--hero-name-size-base, 1.75rem) * var(--mobile-scale, 0.78));
    /* en / sub も同様 */
  }
}
```
※ 注意点: 同名変数に自己参照 calc は不可。**`-base` 変数を別に持つ**か、ヒーロー要素側の
`font-size` を `calc(var(--hero-name-size) * (モバイル時のみ var(--mobile-scale) 反映))` にする方式を採る。
→ 推奨: ヒーロー名等の `style` を `clamp()` 化し、上限に `--mobile-scale` を織り込む案を実装時に比較検討（別途PoC）。

admin UI:
- Typography → Mobile グループに `TypoControl`（min 0.6 / max 1.0 / step 0.02 / 既定 0.78）を1つ追加。
- admin.tsx は settings台帳から自動生成されるため、台帳追加で UI も追従（直接編集しない）。

## 4. リスク・留意
- **CSS変数の自己参照**が最大の落とし穴（無限/無効になる）。`-base` 分離 or clamp 方式で回避。
- ライブプレビュー iframe での反映確認が必須（postMessage 経由）。
- 既存写真・既存設定に影響なし（既定0.78でやや縮むので、現状デザインと差が出る点だけ要確認）。
- git管理外のため、実装時は `bun run deploy` ゲート（tsc -b / 69テスト / 5ページ200）必須。

## 5. 工数感・確認事項
- 工数: 小〜中（4箇所同期＋CSS＋UI＋プレビュー確認で半日想定）。
- **秋さんへの確認**:
  1. 既定縮小率は 0.78 でよいか（控えめ 0.85 / しっかり 0.7 など好み）。
  2. 第一弾はヒーロー3要素だけでよいか、見出し等も含めるか。
  3. CSS方式は `-base`分離 と `clamp` どちらの見た目が好みか（実装前にPoC画像を出す）。

→ 承認 or 方針決定をもらえれば、別途実装サイクルで着手（今は企画のみ）。
