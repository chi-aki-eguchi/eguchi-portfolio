---
name: exif-preset
description: カメラ・レンズのプリセット設定と、その既定値を変更する。
---
# カメラ・レンズのプリセット

`site_settings` の `metaPresetsCamera` / `metaPresetsLens` は名前の配列をJSON文字列で保存する。
既存項目の追加は管理画面のプリセット欄を使う。本番への保存は依頼・承認範囲を確認する。

既定値の実装を変える場合は `DEFAULT_CAMERA_PRESETS` / `DEFAULT_LENS_PRESETS` と `effectivePresets` を検索し、保存済み値との優先・結合処理を確認する。候補の配列をこの文書へ複製しない。
写真の `filmType` は実際の撮影方式を確認し、名前だけから未確認の値を保存しない。

設定キーを増やすときの同期箇所、保存・検証・pushの条件はルート `AGENTS.md` に従う。
