---
paths:
  - "packages/web/src/api/**"
---
画像はJPEG masterと配信用WebP派生を生成し、`thumbKey` / `mediumKey` を保存する。サイズ・品質・キャッシュ上限は変更対象コードの定数を確認する。
保存キーは `sanitizeUploadBaseName()` を通す。R2接続値は環境変数で扱う。
共有画像のpurgeと圧縮ヘッダーの条件はルート `AGENTS.md`、表示確認は `docs/checklists.md` を参照する。
