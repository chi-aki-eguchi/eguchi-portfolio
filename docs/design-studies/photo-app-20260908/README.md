# 写真アプリを参考にした公開サイト試作

2026-09-08。Appleの「写真」とHuman Interface Guidelinesを参考に、公開ポートフォリオの操作・デザイン・モーションを組み直したWebの試作。Appleのネイティブアプリではなく、本番の公開サイトやAdminを変更するものでもない。

## 開き方

リポジトリのルートから:

```sh
python3 -m http.server 5082 --bind 127.0.0.1 --directory docs/design-studies/photo-app-20260908
```

http://127.0.0.1:5082/ を開く。`index.html`をファイルとして開くことも可能。画像はakieguchi.comの公開画像へアクセスするためネット接続が必要。初版の資料は `scratch/photo-app-20260908/`、Liquid Glass改訂版の静止画・操作動画・自己完結HTMLは `scratch/liquid-glass-20260908/`。

## 内容

- PCのサイドバー、スマホの下部ナビ。写真・シリーズ・プロフィールを共通の操作で行き来する。
- 24枚のセレクトと公開写真428枚。写真原本・公開順・DBは読み取りのみ。セレクトは今回のデザイン提案で、オーナーの最終選定ではない。
- 検索、撮影日順、列数変更。写真の構図を保ち、列数変更でも見ていた位置を維持。
- 一覧の写真から拡大表示へ移る動き、閉じると現在の写真へ戻る動き、方向のある前後送り、列数変更の位置移動。
- 戻る・進むの履歴、ページごとの検索・ソート・スクロールを保持。キーボード・スワイプ・常設ボタン、フォーカス復帰に対応。
- Reduced Motion時はJSとCSSの移動を止める。写真の高解像度読み込みに失敗してもサムネイルと再試行を残す。
- 操作欄を浮いたガラス面へ変更。背後の写真の色、縁の反射、控えめな影を組み合わせ、Chrome系では外周だけ屈折させる。選択表示は同じ部品が次のタブへ滑って移る。
- 拡大表示は暗い画面と浮いた操作欄に統一。情報を開いても写真を縮めず、Escapeで情報だけ閉じられる。スマホの前後操作は下の写真帯と一つの操作列にまとめる。
- 高解像度の写真へ短くクロスフェード。ガラスに隠れるフォーカスを補正し、一覧の末尾にも下部ナビを避ける余白を確保する。

`photos.js`は2026-09-08に取得した公開APIの固定データ。CMSと同期する製品コードではない。外部の撮影相談等のリンクは既存の公開サイトへ移動する。書き込み・ログイン・決済機能は持たない。

## 調査と採用した判断

1. AppleはLiquid Glassを操作・ナビゲーションの層に使い、内容をその下へ流す設計を案内している。操作欄を写真の上へ浮かせ、実際に背景が透ける構成へ変更した。写真そのものには光沢や色フィルターを加えない。[Materials](https://developer.apple.com/design/human-interface-guidelines/materials)、[Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/)
2. Apple Photosはサムネイルのサイズ変更や元の比率での一覧表示を提供する。今回も密度変更を常設し、一覧から内容を把握できることを重視した。[Browse your photo library](https://support.apple.com/guide/iphone/browse-your-photo-library-iph7d24753a5/ios)、[Browse your photo collections on Mac](https://support.apple.com/en-ie/guide/photos/phtf6b8c37c3/mac)
3. 読みやすさ、動きを減らす選択、複数の操作方法を設計に含める。スワイプに加えて前後・戻るボタンを残し、キーボードとブラウザー履歴も確認する。[Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)

「AI感」は主観を含むため、なくなったとは断言しない。今回は文字、余白、アイコン、部品の寸法、状態変化のルールをそろえ、写真に由来しない装飾を減らす設計判断を行った。Appleのロゴ・SF Symbols・専用フォントファイルは配布せず、システムフォントと自作のSVGを使用する。

## Webのガラス表現と制約

`glass.css`が透過・ぼかし・縁・陰影を担当し、`glass.js`が外周の変位マップと選択表示を担当する。屈折は写真のコピーを加工せず、`backdrop-filter`とSVGの`feDisplacementMap`で操作面の背後だけに適用する。変位マップはサイズ変更時のみ作り直し、常時動作するアニメーションループは持たない。[MDN backdrop-filter](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter)、[MDN feDisplacementMap](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feDisplacementMap)

Appleのネイティブ描画を同一再現したものではない。Chrome系には外周屈折、Safari系にはCSSの透過・ぼかし・縁を適用する。透明度を下げる設定／高コントラストでは不透明な面へ切り替え、背景に文字が埋もれないようにする。

2026-09-08: Chromiumでは背景がぼけることと、同じぼかしのみの画像との差分から外周変位の描画を確認した。headless WebKitは最小の独立ページでも背景ぼかしを描画せず、実機Safariでの光学品質は未確認。WebKitの操作テスト通過と、Safariの見た目が同一であることを混同しない。

## 検証

サーバー起動中、リポジトリのルートから:

```sh
node docs/design-studies/photo-app-20260908/verify.cjs
node docs/design-studies/photo-app-20260908/edge-cases.cjs
node docs/design-studies/photo-app-20260908/glass-cases.cjs
bunx oxlint docs/design-studies/photo-app-20260908 --deny-warnings
```

`PHOTO_STUDY_URL`で接続先を変更可能。Playwrightはリポジトリの既存依存を使用する。

2026-09-08検証: Chromium/WebKit × 320/390/768/1440pxの基本操作8ケース。追加は両エンジン×Reduced Motion有無の4ケースで、密度変更時の位置、スキップリンク、先頭末尾の矢印、履歴の連続操作、検索復帰、現在写真へのフォーカス復帰、模擬503と再読み込みを確認した。

Liquid Glass改訂時に基本8件・追加4件を再実行。両エンジン×320/390/1440pxの6件を追加し、同期スクロール＋フォーカス、先頭末尾が操作欄に隠れないこと、情報表示前後の写真寸法、連続送り後の高解像度画像の一致、選択表示の位置、動きとコントラストの設定を確認。別担当も両エンジン×4幅、履歴の競合、透明度・モーションの設定切り替えを確認した。

別担当の確認で履歴の競合、検索条件消失、末尾の矢印、非表示要素へのフォーカス、検索ボタンの読み上げ、フィルムストリップの端切れを修正。修正後に両エンジンで再確認し、履歴の1/10/150/330/350ms間隔の操作も確認した。追加で見つかったスキップリンクのページ切り替わりも修正し、上記4ケースに含めた。

製品コードの変更ではないため、製品全体のcheck/smokeは実行しない。本番化には既存CMS、HERO選定、設定・テーマ、実際の公開ルートとの統合と製品検証が別途必要。
