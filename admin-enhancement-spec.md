# 管理画面 強化仕様書（AI実装者向け）

> この文書は AIコーディングエージェントが実装に着手するための仕様書である。
> 人間向けの可読性より、識別子・ファイルパス・受け入れ基準の明確さを優先する。
> 各機能は独立して実装可能。フェーズ順（§7）に従うこと。

---

## 0. 前提・既存パターン（必ず踏襲すること）

- **スタック**: Hono + React 19 + Drizzle/Turso(libSQL) + Bun。画像は R2(S3互換) + sharp。
- **設定の保存**: `siteSettings` テーブル（key-value、value は string）。未設定キーは各 UI/CSS の既定値にフォールバックする設計を維持する。
- **DBアクセス**: 必ず `withRetry(() => db....)` でラップする（既存の全クエリがこの形）。
- **データ更新後**: React Query の `qc.invalidateQueries({ queryKey: [...] })` で再取得する（既存パターン）。
- **ライブプレビュー**: 管理画面は iframe(`src="/"`) に `postMessage({ type: "preview-settings", settings })` を送る。受信は `provider.tsx` の `handlePreviewMessage`。
  - ⚠️ 新規設定キーを追加したら、以下 **3箇所すべて** を更新すること:
    1. `admin.tsx` `SettingsTab` の `previewPayload` キー配列
    2. `provider.tsx` の DB適用 `useEffect`（保存済み設定の反映）
    3. `provider.tsx` の `handlePreviewMessage`（プレビュー反映）
- **CSS変数**: サイト側スタイルは `packages/web/src/web/styles.css` の `:root` 変数を参照。新規変数もここに既定値を定義する。

### 対象ファイル

| ファイル | 役割 |
|---|---|
| `packages/web/src/web/pages/admin.tsx` | 管理画面（`GalleryTab`/`HeroTab`/`ProfileTab`/`CategoriesTab`/`SettingsTab`/`FontPicker`/`TypoControl`） |
| `packages/web/src/web/components/provider.tsx | CSS変数・フォント適用、ライブプレビュー受信、`GOOGLE_FONTS_JA`/`GOOGLE_FONTS_EN` |
| `packages/web/src/web/styles.css` | `:root` CSS変数・要素スタイル |
| `packages/web/src/api/index.ts` | Hono API（写真CRUD・アップロード・reorder） |
| `packages/web/src/api/database/schema.ts` | Drizzle スキーマ |

---

## グループA: タイポグラフィ編集の強化（Settings タブ）

### A1. 字間（letter-spacing）コントロール

**目的**: 高級感の最大レバー。現状 `tracking-[0.1em]` 等でハードコードされ管理画面から触れない。

**新規CSS変数 / settingsキー**:

| settingsキー | CSS変数 | 対象 | 範囲(em) | 既定 |
|---|---|---|---|---|
| `heroNameTracking` | `--hero-name-tracking` | ヒーロー名(和) | -0.02〜0.30 | 0.04 |
| `heroNameEnTracking` | `--hero-name-en-tracking` | ヒーロー名(英) | 0〜0.40 | 0.08 |
| `navTracking` | `--nav-tracking` | ナビ | 0〜0.30 | 0.04 |
| `sectionLabelTracking` | `--section-label-tracking` | セクション見出し | 0〜0.40 | 0.10 |
| `bodyTracking` | `--body-tracking` | 本文 | -0.01〜0.10 | 0.01 |

**変更**:
- `styles.css`: 上記5変数を `:root` に追加。該当要素のハードコード `tracking-[...]` を `letter-spacing: var(--xxx)` に置換。**まずヒーロー/ナビ/セクション見出しの3箇所のみ**着手し、本文は後続。
- `admin.tsx`: `TypoControl` を `unit="em"` step `0.01` で使用。
- `provider.tsx`: §0の3箇所にキー追加。値は `${v}em` 形式で適用。

**受け入れ基準**: 各スライダー変更→ライブプレビュー即時反映→保存→リロード後も維持。

### A2. 行間（line-height）コントロール

| settingsキー | CSS変数 | 対象 | 範囲 | 既定 |
|---|---|---|---|---|
| `bodyLeading` | `--body-leading` | 本文・bio | 1.4〜2.4 | 1.8 |
| `sectionLeading` | `--section-leading` | 見出し系 | 1.0〜1.8 | 1.2 |

単位なし（倍率）、step 0.05。`styles.css` の該当 `line-height` を変数参照に置換。

### A3. フォントウェイト選択

**目的**: 細い/太いの印象調整。プリセットは複数ウェイトを読込済みだが固定使用になっている。

| settingsキー | CSS変数 | 対象 |
|---|---|---|
| `heroNameWeight` | `--hero-name-weight` | ヒーロー名(和) |
| `bodyWeight` | `--body-weight` | 本文 |

- 選択肢は**フォント定義から動的に導出**（固定リスト禁止）。`GOOGLE_FONTS_*` をオブジェクト化（A5参照）して各フォントの利用可能ウェイトを持たせ、そこから選択肢を生成。
- UI: セグメントボタン（例 `Light / Regular / Medium`）。`TypoControl` 隣 or 新規 `WeightControl`。

### A4. モバイル向けサイズ調整（A案＝グローバル縮小率を採用）

| settingsキー | CSS変数 | 範囲 | 既定 |
|---|---|---|---|
| `mobileScale` | `--mobile-scale` | 0.6〜1.0 | 0.78 |

- `styles.css` の `@media (max-width: 768px)` で、各タイポサイズ変数を `calc(var(--xxx) * var(--mobile-scale))` に再定義。
- 対象: `--hero-name-size`, `--hero-name-en-size`, `--hero-sub-size`, `--heading-size`, `--section-label-size`, `--body-size`, `--nav-size`, `--footer-size`。
- **優先度高**: ヒーロー名がモバイルで過大／はみ出す既知懸念の解消。

### A5. フォントフォールバックの修正（既知バグ）

**現象**: `provider.tsx` がフォント適用時に常に `'<name>', serif` を設定。ゴシック系（Noto Sans JP / Zen Kaku Gothic New / M PLUS Rounded 1c）でも読込前・失敗時に明朝で代替される。`styles.css` 既定は sans-serif系で挙動が矛盾。

**対応**:
- `GOOGLE_FONTS_JA`/`GOOGLE_FONTS_EN` を `Record<string, string>` から `Record<string, { param: string; category: "serif"|"sans-serif"; weights: number[] }>` に変更。
- フォント適用時、`category` に応じてフォールバックを切替:
  - serif → `'<name>', 'Hiragino Mincho ProN', serif`
  - sans-serif → `'<name>', 'Hiragino Sans', sans-serif`
- カスタムフォント: 分類不明のため管理画面でセリフ/サンセリフを選ばせる。新規キー `customFontJaCategory` / `customFontEnCategory`（値 `"serif"|"sans-serif"`、既定 `"sans-serif"`）。
- 影響箇所: `provider.tsx` のフォント適用 `useEffect` と `handlePreviewMessage` の Fonts ブロック、`FontPicker` 内のプレビュー `fontFamily` も同ロジックに合わせる。

### A6. フォントペアリング・プリセット

**目的**: 和英を個別に選ぶ難しさを下げ、ワンクリックで印象を決める。

| プリセット | fontJa | fontEn |
|---|---|---|
| Classic Mincho（既定相当） | Shippori Mincho | Cormorant Garamond |
| Modern Serif | Zen Old Mincho | Playfair Display |
| Quiet Sans | Noto Sans JP | Inter |
| Editorial | Noto Serif JP | EB Garamond |

- 適用で `fontJa`/`fontEn` を一括 `set`。個別 `FontPicker` での上書きは引き続き可能。
- UI: Typography セクション最上部にプリセットボタン群。

### A7. プレビュー体験の改善

- **A7-1 任意プレビュー文字**: `FontPicker` にプレビュー文字入力欄を追加。既定 `江口秋 Aki Eguchi 2026`。**管理画面ローカル state**（settings保存不要）。`SettingsTab` で state を持ち props で各 `FontPicker` に渡す。
- **A7-2 読込中表示**: Googleフォント選択後 `document.fonts.ready` / `document.fonts.load()` を監視し、完了までプレビューにスケルトン or スピナー。
- **A7-3 ウェイト別プレビュー**: 選択フォントの `weights`（A5）を各行で表示。

### A8. カスタムフォントアップロードのバリデーション

- 受理拡張子: `.woff2 .woff .ttf .otf`。それ以外拒否。
- 容量上限: 2MB（超過は拒否）。
- `alert()` を廃止し `FontPicker` 内インラインエラー表示に変更。
- アップロード中スピナー（既存 `uploading` state 流用）。

### A9. TypoControl の数値直接入力

- 数値表示部を `<input type="number">` 化。スライダーと双方向同期、範囲外は min/max にクランプ。

### A10. Typography セクションの再編（UI整理）

現在のフラットなスライダー羅列を要素グループ単位の折りたたみ（既存 `Section` 流用）に再構成:

```
Typography
├─ Font Pairing      … A6プリセット + 個別FontPicker(和/英) + A7プレビュー
├─ Hero              … サイズ/ウェイト(A3)/字間(A1)/色
├─ Navigation        … サイズ/字間(A1)/不透明度
├─ Section Labels    … サイズ/字間(A1)/不透明度
├─ Body              … サイズ/ウェイト(A3)/字間(A1)/行間(A2)
├─ Footer            … サイズ/不透明度
└─ Mobile            … 縮小率(A4 mobileScale)
```

---

## グループB: 管理快適化（既出の改善を統合）

### B1. 保存フィードバック（Inspect パネル）

**現状**: `GalleryTab` の写真メタ編集 `updatePhoto.mutate` 成功時に視覚フィードバックがない（`SettingsTab` には `saved` state があるのに Inspect には無い）。

**対応**: `photoSaved` state を追加し、`updatePhoto` の `onSuccess` で 1.5秒トグル。Save ボタンを `{photoSaved ? <Check/> "Saved" : "Save"}` 表示に。

### B2. 写真検索

**現状**: カテゴリフィルターのみ。タイトル/場所での検索がない。

**対応**: `GalleryTab` ツールバーに検索入力 `search` state を追加。`filtered` を以下に変更:
```ts
const filtered = useMemo(() => {
  let r = filterCat === "all" ? allPhotos : allPhotos.filter(p => p.category === filterCat);
  if (search) r = r.filter(p =>
    (p.title + p.meta + p.filename).toLowerCase().includes(search.toLowerCase()));
  return r;
}, [allPhotos, filterCat, search]);
```

### B3. 削除の論理削除化 + Undo（最重要・作品消失防止）

**現状**: `DELETE /admin/photos/:id` が R2 物理削除(`DeleteObjectCommand`) + `db.delete` で**完全に復元不可**。確認モーダルはあるが事故リスク大。

**対応（論理削除へ移行）**:
- `schema.ts` `photos` に `deletedAt: integer("deleted_at", { mode: "timestamp" })`（nullable）を追加。マイグレーション(`db:push`)必要。
- `DELETE /admin/photos/:id`: **R2削除と物理delを廃止**し、`db.update(photos).set({ deletedAt: new Date() })` に変更。
- `GET /photos`（公開）と管理一覧の通常取得: `where(isNull(photos.deletedAt))` で除外。
- 新規 `POST /admin/photos/:id/restore`: `deletedAt = null`。
- 新規 `DELETE /admin/photos/:id/purge`: 物理削除（R2 + DB delete、現行ロジックを移植）。ゴミ箱からの完全削除に使用。
- 管理画面: 「ゴミ箱」表示（フィルタ or 小タブ）で `deletedAt IS NOT NULL` を一覧し、復元/完全削除を提供。
- **Undoトースト（併用推奨）**: 削除直後に「N枚削除しました ↩ 元に戻す」を数秒表示。押下で restore を呼ぶ。

**受け入れ基準**: 削除した写真が公開サイトに出ない／ゴミ箱から復元できる／purgeで初めて完全消去。

### B4. アップロード時のメタ自動補完（EXIF）

**現状**: アップロード写真は `title: ""`。

**対応**: `POST /admin/upload`（既に sharp 使用）で `sharp(inputBuf).metadata()` から EXIF 撮影日時(`DateTimeOriginal`)を抽出し、写真作成時の `meta` 初期値に入れる（例 `"2024"`）。
- フィルムスキャンは EXIF 無しが多い → **取得できたら入れる**程度。失敗時は空のまま（害なし）。

### B5. 並び替えの保存フィードバック

**現状**: `GalleryTab`/`HeroTab`/`CategoriesTab` のドラッグ並び替え反映が視覚的に分かりにくい。

**対応**: reorder mutation の `onSuccess` で対象を一瞬ハイライト、または小さく「並び替えを保存しました」トースト。

### B6. キーボードショートカット一覧

**現状**: `Cmd+A`(全選択)/`Delete`(削除)/`Esc`(解除) 実装済みだが非表示。

**対応**: `?` キーでショートカット一覧モーダルを表示。`GalleryTab` の既存 keydown ハンドラに追加。

---

## 4. データモデルまとめ

### 4.1 `siteSettings` 追加キー（全て string、未設定はCSS既定にフォールバック）

```
# 字間 (A1)
heroNameTracking, heroNameEnTracking, navTracking, sectionLabelTracking, bodyTracking
# 行間 (A2)
bodyLeading, sectionLeading
# ウェイト (A3)
heroNameWeight, bodyWeight
# モバイル (A4)
mobileScale
# フォント分類・カスタム用 (A5)
customFontJaCategory, customFontEnCategory   # "serif" | "sans-serif"
```
※ A6プリセットは既存 `fontJa`/`fontEn` を一括設定するため新規キー不要。
※ A7プレビュー文字は管理画面ローカル state（settings保存しない）。

### 4.2 `schema.ts` 変更（B3）

```ts
// photos テーブルに追加
deletedAt: integer("deleted_at", { mode: "timestamp" }),  // nullable
```
`GOOGLE_FONTS_JA`/`GOOGLE_FONTS_EN` の型変更（A5）も実施。

### 4.3 API 追加・変更

| メソッド | パス | 変更 |
|---|---|---|
| DELETE | `/admin/photos/:id` | 物理→論理削除（`deletedAt` セット）に変更 (B3) |
| POST | `/admin/photos/:id/restore` | 新規・復元 (B3) |
| DELETE | `/admin/photos/:id/purge` | 新規・物理削除（旧ロジック移植）(B3) |
| GET | `/photos` | `isNull(deletedAt)` 条件追加 (B3) |
| POST | `/admin/upload` | EXIF撮影日を meta 初期値に (B4) |

---

## 7. 実装フェーズ

| フェーズ | 項目 | 理由 |
|---|---|---|
| **P1** | A5(フォールバック修正) / A1(字間) / A2(行間) / B3(論理削除) | バグ修正・高級感の核・作品消失防止 |
| **P2** | A4(モバイル縮小) / A7(プレビュー) / B1(保存FB) / B2(検索) | 既知懸念とエディタの安心感・探しやすさ |
| **P3** | A6(ペアリング) / A3(ウェイト) / A10(セクション再編) / B4(EXIF) | 表現力と操作性の底上げ |
| **P4** | A8(アップロード検証) / A9(数値入力) / B5(並び替えFB) / B6(ショートカット) | 堅牢性・細部 |

---

## 8. 全体の受け入れ基準

- [ ] 字間・行間・ウェイト・モバイル縮小がライブプレビューに即時反映され、保存後リロードでも維持される
- [ ] 新規 settingsキーが未設定でも既定値で正しく表示される（後方互換）
- [ ] ゴシック系フォント選択時に明朝で代替表示されない（A5）
- [ ] モバイル幅でヒーロー名がはみ出さない（A4）
- [ ] 写真削除は論理削除となり、公開サイトに出ず、ゴミ箱から復元でき、purgeで初めて完全消去される（B3）
- [ ] 写真メタ保存・並び替え保存に視覚フィードバックがある（B1/B5）
- [ ] タイトル/場所/ファイル名で写真を検索できる（B2）
- [ ] 不正形式・容量超過のカスタムフォントは明示エラーで拒否される（A8）
- [ ] postMessage 連携の新キーが provider.tsx 受信側・SettingsTab送信側の両方で更新されている

---

## 9. 実装上の注意

- A1の `tracking-[...]` 置換は対象が広い。**ヒーロー/ナビ/セクション見出しの3箇所に限定して着手**し、効果確認後に本文へ展開する。
- ライブプレビューのキー取りこぼし防止: 新キー追加時は §0 の3箇所を必ずセットで更新。
- A3ウェイトの選択肢はフォント定義から導出し、固定リストにしない（将来のフォント追加で破綻させない）。
- B3はマイグレーション(`cd packages/web && bun run db:push`)が必要。既存写真の `deletedAt` は null になる（＝表示維持）こと。
