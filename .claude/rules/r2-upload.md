---
paths:
  - "packages/web/src/api/**"
---
R2 アップロード時は sharp で **mozjpeg q92 / 3200px / 4:4:4** に最適化してから保存する。WebP への変換は行わない（配信は JPEG のまま）。

`Content-Encoding` ヘッダを手動で設定しない（§0 invariant）。Railway のプロキシが自動処理する。違反すると二重圧縮でブラウザが壊れる。

R2 バケット名・アクセスキーをコードにハードコードしない。`process.env.S3_*` を使う。

写真の複製（論理コピー）は同じ R2 オブジェクトを共有する。`purge` は他に参照がない場合のみ R2 から削除する。

オンザフライリサイズは `/api/images/:key?w=&q=` 経由。sharp の変換結果は in-memory LRU キャッシュ（256MB byte budget）に乗る。
