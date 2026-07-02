# TIFF変換ツール

巨大なTIFFを本番サーバに送る前に、Mac上でサイト用JPEGへ変換する道具です。
TIFFは `~/tiff-inbox` に入れます（なければ自動作成されます）。
実行コマンド: `bun scripts/convert-tiffs.ts`
JPEGは `~/tiff-converted` に出ます。
元のTIFFは変更・削除しません。
すでに同名JPEGがある場合はスキップします。
変換は1枚ずつ行うので、大きいスキャンでも安全です。
失敗した場合は最後の「失敗したファイル」行を見て、該当TIFFを書き出し直してください。
