# 2026-09-28 仕上げと未統合作業の確認

> 続く依頼で未統合機能を仕上げ、旧試作の扱いを確定。[統合結果](prototype-integration-20260928.md)が現在の状態。以下の未統合表は調査時点の記録。

調査基準: main / codex/kit-delivery `610c581`。既存の未コミット変更と各worktreeを保持して確認。

## 今回の修正

- Aboutのside/stack写真と管理画面のプレビューは元画像の縦横比を保持。横長・縦長・正方形を切り抜かない。読み込み失敗後も別の画像URLへ変更すると復帰する。
- 旧管理画面の動画・日英6画面を2026-09-28の体験版へ更新。クイックツアーのメニュー名も現行へ一致。英語プロフィール未入力時の誤った「日本語へフォールバック」案内を訂正。
- 開発用localhostで所有者サイトの体験版を確認できるよう修正。製品ビルドの顧客ホストでは公開しない。

## 紹介素材の根拠

`packages/web/public/portfolio-kit/admin-20260928-*.jpg` と `admin-demo-20260928-*`。現在のソースを使うローカル体験版を1440×1000で撮影。写真は既存の所有者サイトの公開デモ素材。新たな第三者写真は追加していない。

動画は連続した操作録画ではなく、実際の操作で得た7画面を各5秒に編集した35秒の紹介。写真一覧→サイトデザイン→写真比率グリッド選択→保存確認→プロフィール→文章入力→保存確認。変更は体験版内のみ。本番の写真・文章を変更していない。VP9 WebM / H.264 MP4、音声なし、7区間の日本語VTT字幕。更新日入りURLで旧キャッシュを回避。再撮影時は操作・字幕・日英スクリーンショット・ガイド参照を一緒に更新する。

## 未公開・保管中の作業

| 対象 | 確認結果 | 扱い |
|---|---|---|
| codex/portfolio-pdf / wt-photobook | mainの祖先。未統合commitなし | PDF・写真集は公開済み |
| codex/search-and-inquiries / audit/stage1-fixes | mainの祖先。未統合commitなし | 保管ブランチを未実装と数えない |
| codex/portfolio-pdf-before-release-20260927 | 初期試作の保存。後続3commitはpatch同等、初期commitは統合時に改修 | 元履歴を保持。旧コードを再投入しない |
| feature/photo-aspect (`f929504`) | 実際の未統合機能。photoCrop、viewerMat、スマホ列数、公開contact-sheet、PC最大列数拡張 | 現行のbookデザイン・写真管理と重なるため、18ファイルの旧実装は一括移植しない。要件ごとに現行へ移す残作業 |
| prototype/b2-uneven-rows / prototype/finder-contact-sheet | 古い比較用試作 | 採用済みの現行UIとの差分を選別する候補。完成済みとは扱わない |
| 主checkoutのVite個別設定と未追跡レビュー資料 | 作業開始前から存在 | 今回の公開対象に含めず保持 |

## 検証

- `bun run check`: 成功（単体・tools・guard・型・lint・build）。wiki鮮度の既存警告8件は残る。
- 関連smokeは最終差分で合計40ケース成功（販売/相談12、公開写真16、体験版公開条件4、管理写真4、動画4）。全体smokeの再実行ではない。
- 公開写真16ケース内で5比率×book/classic×side/stack×Chromium/WebKitのPC/スマホ幅＝80組を検証。未設定・404、横はみ出し・本文重なりも確認。
- 初回の失敗はSVGのsrcset密度による整数丸め、管理画像の枠線込み計測、WebKitの字幕選択設定、変更前ツアー文言の期待値。原因を修正して対象を再実行し成功。実機Safari/iPhoneでの検証ではない。
- 手元のログ: `scratch/finish-check-final.log`、`finish-focused-smoke.log`（初回32成功/4失敗）、`finish-corrected-smoke.log`（修正後8成功）、`profile-aspect-smoke-final.log`。

顧客リハーサル環境5599/5699とソフトウェア配布物は固定版dc392383のまま。今回の本番改善を顧客固定版へ適用・復元したとは扱わない。第三者購入・本人更新・物理印刷・集客効果の新たな実績はない。

## 本番確認

2026-09-28、製品commit `993ef53` をmainと作業ブランチへ通常push。Railway成功、`/api/health` build `993ef532`。本番Aboutのプロフィール画像は自然寸法・表示寸法とも300×240で切り抜きなし。販売ページを再読み込みし、35秒の新版見出しと日付入りWebM/MP4参照を確認。公開WebM/MP4/VTTは200・適切なMIME・ローカルとバイト一致。証拠: `scratch/admin-demo-20260928/production-media.json`、`production-about.png`、`production-video.png`。主checkoutもmainへfast-forwardし既存変更を保持。ローカル資料入口5799も再起動して新版VTTを確認。
