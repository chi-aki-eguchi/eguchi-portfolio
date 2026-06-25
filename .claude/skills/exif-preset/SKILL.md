---
name: exif-preset
description: 新しいカメラ・レンズのプリセットを追加する手順。site_settings の metaPresetsCamera / metaPresetsLens を更新する。
---
# カメラ・レンズ プリセット追加手順

## 仕組み

プリセットは `site_settings` テーブルに JSON 文字列で保存されている:

| settingsキー | 内容 |
|---|---|
| `metaPresetsCamera` | カメラ名の JSON 配列（例: `["PENTAX 67","Leica M6"]`） |
| `metaPresetsLens` | レンズ名の JSON 配列（例: `["SMC Takumar 105mm f/2.4"]`） |

## デフォルトプリセット（admin.tsx に定義）

```ts
// packages/web/src/web/pages/admin.tsx
const DEFAULT_CAMERA_PRESETS = [
  "PENTAX 67", "Leica M6", "Bronica S2", "Sony α1", "PENTAX 67II"
];
const DEFAULT_LENS_PRESETS = [
  "SMC Takumar 105mm f/2.4", "SMC Takumar 55mm f/1.8",
  "Nokton 50mm f/1.5", "FE 35mm f/1.8"
];
```

DB に値がない場合はこのデフォルトが使われる。

## 管理画面からプリセットを追加する方法

1. 管理画面の **Settings タブ** → カメラ/レンズプリセット欄
2. 新しい名前を入力して追加
3. 保存すると `metaPresetsCamera` / `metaPresetsLens` キーが更新される

写真を登録する際に新しいカメラ/レンズ名を入力すると、自動的にプリセット候補に追加される仕組みも実装済み（admin.tsx の `updatePhotoMeta` 内で処理）。

## filmType フィールド

写真テーブルの `filmType` フィールドは `"フィルム"` または `"デジタル"` を格納。カメラの種類に合わせて設定する:

- PENTAX 67, Leica M6, Bronica S2 → `"フィルム"`
- Sony α1 → `"デジタル"`

## コードでデフォルトプリセットを変更する場合

`packages/web/src/web/pages/admin.tsx` の `DEFAULT_CAMERA_PRESETS` / `DEFAULT_LENS_PRESETS` を直接編集。

**注意**: DB 側のプリセットがある場合は DB 側が優先される。`effectivePresets()` 関数が DB 値とデフォルトをマージする。

## §0 チェック（API 変更を含む場合）

settings キー追加・変更時は4箇所セットで更新:
1. `lib/settings-preview.ts` の `SETTINGS_PREVIEW_KEYS`
2. API `GET /settings` のデフォルト値（`api/index.ts`）
3. `provider.tsx` の DB適用 `useEffect`
4. `provider.tsx` の `handlePreviewMessage`
