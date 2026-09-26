# PDF用日本語フォント

Noto Sans JP Regular（静的OTF）、SIL Open Font License 1.1。
2026-09-27取得。著作権表示はフォント内部、ライセンスは同梱のOFL.txt。

- https://github.com/notofonts/noto-cjk/blob/main/Sans/SubsetOTF/JP/NotoSansJP-Regular.otf
- https://github.com/notofonts/noto-cjk/blob/main/Sans/LICENSE

pdf-lib 1.17.1 + @pdf-lib/fontkit 1.1.1 で日本語のサブセット埋め込みを検証。
画像・文言を外部フォントサービスへ送らず、同じサイトから読み込む。
生成器の変更時は、日本語テキスト抽出とPDFレンダラーの両方で再検証する。
