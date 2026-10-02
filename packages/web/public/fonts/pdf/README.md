# PDF用日本語フォント

Noto Sans JP Regular（静的OTF）、SIL Open Font License 1.1。
2026-09-27取得。著作権表示はフォント内部、ライセンスは同梱のOFL.txt。

- https://github.com/notofonts/noto-cjk/blob/main/Sans/SubsetOTF/JP/NotoSansJP-Regular.otf
- https://github.com/notofonts/noto-cjk/blob/main/Sans/LICENSE

2026-09-28: 新規PDFと編集プレビューは静的TrueType版 `NotoSansJP-Regular.ttf` に切り替えた。上記OTFは古いクライアントの参照用に保持する。

- 元データ: https://github.com/google/fonts/blob/main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf
- 元SHA256: `c2f3b4d463500a2ddcd3849cded1fceeb9fd6d1c32e6cbecd568453ba50fc68f`
- fontTools 4.66.0 の `instantiateVariableFont(font, {"wght": 400}, inplace=True, updateFontNames=True)` で静的Regularへ。アプリの実行時依存は追加していない。
- 静的TTF SHA256: `4afab0df07f70123129ee1d522b5d4ceaeda5541ba26e825514b66d2ae2d7b12`
- 利用許諾: `OFL-TrueType.txt`（元配布物から取得）。

pdf-lib 1.17.1 + @pdf-lib/fontkit 1.1.1 のサブセット化では、日本語の字形欠落を実際の描画で確認した。静的TTFを完全埋め込みし、元フォントの全バイトがPDF内に保持されることをテストする。圧縮後のフォント分としてPDFに約3.4MB加わるが、閲覧側の代替フォントに頼らない。旧CFFのヘッダー補正だけでは解決しないため採用しない。
画像・文言を外部フォントサービスへ送らず、同じサイトから読み込む。
生成器の変更時は、日本語テキスト抽出とPDFレンダラーの両方で再検証する。

## しっぽり明朝 Medium（題と作品名、2026-10-02）

サイトの日本語の書体（設定 `fontJa` = Shippori Mincho）とそろえるため、PDF の題・作品名・作品一覧の
作品名だけを明朝で組む。ほかの文はゴシック（上の Noto Sans JP）のまま。オーナーの了解を得て取得した。

- 元データ: https://github.com/google/fonts/blob/main/ofl/shipporimincho/ShipporiMincho-Medium.ttf（静的 TrueType、8,678,848 bytes）
- SHA256: `700e505afc4cded2338eba29478a041e04c1c2ea5114fbb3e0b04e76c302c5d8`
- 利用許諾: SIL Open Font License 1.1。`OFL-ShipporiMincho.txt`（同じ場所の OFL.txt）。
- PDF には HarfBuzz で使う字だけを入れる（`lib/portfolio-pdf/font-subset.ts`）。明朝に無い字を含む題は、
  組むときにゴシックへ回す（プレビューと PDF で同じ）。
