# Portfolio Kit 販売・納品検証

2026-09-28 JST。統合依頼 `Downloads/portfolio-kit-sales-delivery-codex.md` の現状表を実物に照らして更新した正本。元の依頼書は保持。

最終の修正・固定版・検証は [残件の最終確認](remaining-issues-20260928.md) を参照。配布版 `847ac5f3`、本番buildも同版。以下の過去検証記録は実施時点のもの。

**判定: ローカルの技術納品リハーサルは完了。初回有料提供は条件付き可。** 顧客名義の独立環境を担当者が設置し、設定済みサイトと管理画面を渡す方式。販売ページの本番公開と作者宛て相談の実受信は2026-09-28に確認済み。顧客ごとのクラウド・総額・提供／保守／取消条件を合意し、公開承認と本人操作を確認して納品する。会員登録・自動課金・一般SaaSは初回納品の前提にしない。

## 実物と変更の所在

- 公開した販売導線: https://akieguchi.com/portfolio-kit ／作り方ガイド `/portfolio-kit/guide`。手元の5899は外部送信を遮断した確認用。
- 確認用入口: http://127.0.0.1:5799/ （このMacのみ、公開URLではない）
- 顧客用見本 LAND / ARCHIVE: http://127.0.0.1:5599/ / 管理画面 `/admin`
- 別DB・別画像保存先・別認証へ復元した見本: http://127.0.0.1:5999/
- [受取人ガイド](../photographer-guide.md)、[納品パック・商談文](../delivery/customer-pack.md)、[設置・復元・終了手順](../delivery/operations.md)、[原価・承認事項](../delivery/cost-and-approval.md)
- `output/pdf/portfolio-kit-sample-screen.pdf` / `portfolio-kit-sample-print.pdf`。各4頁、アプリから出力。`output/kit-delivery/` はローカル納品パック、Gitへ載せない。
- 基準・着手時origin/main: `bd4ea81871928fe6aa290d3a43c07e4dc7531a73`。元checkoutの `.gitignore` / `vite.try.config.ts` と未追跡資料、既存PDF・自由編集worktreeを保持。
- 作業: `codex/kit-delivery`、`/Users/chiaki/.codex/worktrees/kit-delivery/eguchi-portfolio-app`。承認後にmainへ統合・pushし、本番build `f4261078` を確認。本番設定・写真データへの書込みなし。
- 製品検証版: `eaf032793193c87d8b0e63cd9d2ac59b0b64d46d`。最終配布版は末尾の固定版記録。PDF・写真集の製品コードは基準版から変更していない。

## 更新した現状表

状態の「実測済み」は以下のローカル環境・担当者による技術試験を指す。商用クラウド・本人による操作・販売実績へ拡大解釈しない。

|ID|利用者への約束|コード／文書|現在の状態|再現・顧客への効果|優先度|証拠|
|---|---|---|---|---|---|---|
|C01|検証した版を渡す|scripts/kit/release.ts|実装・実測済み|ソースとbuildをSHA256固定、health照合|P0|release manifest|
|C02|個人サイトと独立|service-visibility.ts / seed.ts|実測済み|名前・写真・OG・宛先・解析・販売ルート分離|P0|sample/verification.json|
|C03|PostgreSQL + S3|database / local.ts|実PG・ローカルS3試験済み|空DB、独立画像保存先|P0|migration / recovery|
|C04|空から個別設置|local.ts / materials.ts / seed.ts|実装・実測済み|再実行は既存編集を保持、同一ID再利用|P0|V01–V02|
|C05|現行料金と範囲|shared/portfolio-product.ts|2プラン共通化済み|30,000 / 69,800 / 任意9,800円の変更なし。正式条件は要承認|P0|ogp / SPA単体|
|C06|設定済み納品|delivery/customer-pack.md|完成見本あり|公的写真3点・シリーズ・紹介文・連絡先設定|P0|見本5599|
|C07|自分で更新|photographer-guide.md / ui-update.ts|UI技術試験済み|追加・非公開・ドラッグ・紹介文・再ログイン|P0|ui-update.json|
|C08|顧客の版更新|release.ts / recovery-check.ts|実測済み|配布版固定・既存データ保持|P0|recovery-verification.json|
|C09|版履歴|template-release-notes.md|現行に更新|schema変更なし、互換・制限記載|P0|固定版manifest|
|C10|提出PDF・写真集|admin-pdf / portfolio-pdf|現行回帰・実出力済み|4頁×送信／印刷、全頁描画確認|P1|PDF / renders|
|C11|制作物保存|portfolio-pdf/model.ts|JSON復元実測済み|未書出しブラウザー本は対象外と明記|P0|project SHA / 再読込|
|C12|画像品質|API / photographer-guide|制約確認・資料整合|最大3200px、原本ではない。紙の保証なし|P1|元コード / PDF|
|C13|PDF画像負荷|共有image queue|約10分の連続負荷を実測|6000要求、巡終了時の処理・キュー0、終盤RSS323–338MB。無期限／クラウド費用は未保証|P1|security-soak-c412914.json / soak-summary.json|
|C14|相談・通知|portfolio-intake.ts|本番1件の受付・Gmail受信箱への到着を実確認|承認済みテスト。実顧客・契約・入金ではない|P0|production-receipt evidence|
|C15|受付ID・再送|portfolio-intake.ts|本番の受付IDと案件管理・メールを照合|同ID再送はモック回帰。今回の実送信は1件だけ|P0|ops / Gmail / smoke|
|C16|販売表示の一致|ogp.ts / Pricing|不一致を修正|ownerの静的説明と構造化Offerも同じ2プラン|P0|ogp / SPA単体|
|C17|作業と本番の分離|作業branch / opt-in flags|維持|現行本番の公開範囲を変えない|P0|Git差分・health|
|C18|本体に統合した販売・検索導線|portfolio-sales / shared FAQ / usePageTitle|本番公開・PC/390px確認済み|作品サイトと同じ器、実画面/PDF、ガイドから見本へ|P0|sales evidence / intake smoke|
|C19|秋さんが初回を納品する手順|output/portfolio-kit-owner/owner-start-here.md|返信・見積・本人更新・運用まで整理|実顧客の受入れは未実施|P0|納品手順・料金判断案|
|C20|検索の現在値|output/portfolio-kit-owner/search-baseline-20260928.md|Search Consoleを実確認|Kit登録済み。件数の実測は手元の非公開資料|P0|2026-08-31〜09-25の表示期間|

## 検証の版・日時・環境

実行: 2026-09-28 JST、担当Codex。Mac / PostgreSQL 17.11（127.0.0.1:56430、専用クラスタ）/ Bun、偽S3はloopbackのみ。Chromium desktop・390px、全体smokeはdesktop/mobile/WebKitのエミュレーション。スマホ実機やSafariアプリでの試験ではない。個人サイトのDB・ストレージ・`.env`は使用しない。

証拠の根: `scratch/kit-delivery/`。JSONのtimeはUTC表記。検証のPASSは表の限定された技術範囲に対するもの。NOT_RUNの部分をPASSに含めない。

|ID|状態|今回の証拠／残る確認|
|---|---|---|
|V01|PASS|local.tsのinit→起動→素材設定、実PG空DB。クラウドはNOT_RUN|
|V02|PASS|init再実行、素材checksum、seed再実行は書込みなし。途中試行で既存ID再利用。任意段階の自動障害注入は未実施|
|V03|PASS|sample/verification.json、名前・OG・canonical・宛先・GA・owner販売404。画像は公的素材だけ|
|V04|PASS|実PG17と0004→0005 migration再実行。通常回帰はSQLite/libSQL経路。外部Turso通信はNOT_RUN|
|V05|PASS|見本3作品・1シリーズ・紹介文・ガイド。架空の納品、実顧客契約なし|
|V06|PASS|ui-update.jsonとverification.json。実UI追加・ドラッグ・紹介文保存・公開状態・再ログイン。本人操作はV35|
|V07|PASS|既存保存失敗・PDF中止・容量/JSON回帰の単体とsmoke。実クラウドのディスク満杯はNOT_RUN|
|V08|PASS|横構図の公的写真と人工縦写真、長い日本語シリーズ名、既存多数写真回帰。実顧客の全素材はNOT_RUN|
|V09|PASS|390px/desktop/WebKit・キーボード関連smoke。スマホ実機はNOT_RUN|
|V10|NOT_RUN|見本の宛先分離とmailtoは確認。sample@example.invalidのため実送信・実受信はしない|
|V11|PASS|既存相談保存・同ID再送・通知失敗のモック回帰。2026-09-28に作者用の実受付1件・ops保存・Gmail受信を確認。顧客サイト自身のメールはV10のまま|
|V12|PASS|版・範囲・合意・金額を保持するorder型と未合意拒否、記入用確認書。実契約は未承認|
|V13|NOT_RUN|order.testとorder-rehearsal.jsonで架空の成功／重複／遅延／失敗／中断／返金・納品資格を照合。決済事業者sandbox・実決済は未実施|
|V14|PASS|新規顧客private初期登録、非公開画像本体・派生URLを匿名404。掲載許可の実顧客同意は未実施|
|V15|PASS|security-load.json、認証なしの画像/PDF拒否、別顧客PW拒否。非公開クラウドバケットはNOT_RUN|
|V16|PASS|個別ランダム秘密、担当者によるPW更新後に旧PW・旧cookie401、新PW200、データ不変。実受渡しはNOT_RUN|
|V17|PASS|停止中にPG dump＋12画像ファイル＋1 JSON、14filesのmanifest。認証・カメラ原本・未export本を除外|
|V18|PASS|別DB/保存先で7テーブル完全一致（siteUrl除外）、全画像・JSON SHA一致、PDF再出力の4頁描画一致|
|V19|PASS|固定版artifactとhealth、実PG migrationで既存写真・設定・シリーズ保持。クラウド自動デプロイ設定はNOT_RUN|
|V20|PASS|旧bd4ea81を実起動しデータ照合→候補版へ再更新。schemaは今回変更なし。旧版は画像保護が無いため顧客本番への推奨rollback先ではない|
|V21|NOT_RUN|local canonical/OG・loopback隔離は確認。顧客DNS/TLS/検索は未承認・未実施|
|V22|PASS|DB・画像・JSON・出力PDFを納品パックへ、再読込・復元実証。別クラウドへの移管はNOT_RUN|
|V23|NOT_RUN|終了・持ち出し・保持・停止手順と架空返金の納品停止は確認。実ホスティング停止・請求停止は未実施|
|V24|PASS|商品共通定義、日英料金UI・noscript・構造化2Offer、FAQ/購入後の現行条件保持。新しい価格は公開しない。本番反映・表示も2026-09-28に確認済み|
|V25|NOT_RUN|条件確認書と取消等の承認票を用意。正式事業者情報・保守責任・取消を未記入のまま公開していない|
|V26|PASS|生成時間・容量・ローカル負荷の実測と費用未測定・工数仮定を分離。実顧客原価・利益はNOT_RUN|
|V27|PASS|送信934,956bytes/332ms、印刷3,839,825bytes/823ms（1回のlocal実測）。各A4 4頁、全頁PNG確認、日本語抽出|
|V28|PASS|既存PDF専用smokeと実PGのJSON取込／生成。Webデータの更新経路から独立|
|V29|PASS|20画像要求×12巡（実3素材を繰返し）、同時4。中止/失敗後active・queue・inflight0。RSS435→452MB、短期増加あり。長期リーク解決やクラウド耐久を証明しない|
|V30|PASS|旧JSONの読み戻し・文書変換の既存単体、見本JSON再読込。既存PDF worktreeや元作品は変更なし|
|V31|NOT_APPLICABLE|今回の販売範囲に未完成の自由配置・白紙・見開き完成を加えない。既存開発と方向は保持|
|V32|NOT_APPLICABLE|製本・印刷先適合を今回販売保証しない。印刷用データの技術検証だけ、物理印刷はNOT_RUN|
|V33|PASS|sample-sources.jsonの個別PD表示・checksum。説明用と明記、実顧客の声や実績を作っていない|
|V34|PASS|GAなし・公開証拠に秘密を含めない。初回失敗ログのcookieを削除し、以後はエラークラスのみ保存。private labと配布allowlistを分離|
|V35|NOT_RUN|本人のログイン→写真追加→並べ替え→紹介文→公開確認→再ログインの確認票をガイドに用意|
|V36|NOT_RUN|実購入・本人納品・継続利用・売上は未実施。架空orderの成功を実績に数えない|

## 復元と失敗系の詳細

- `backups/delivery-20260928/manifest.json` がスナップショット。実復元apply処理は0.342秒（小規模local、設置・検証時間を含まない、SLAではない）。
- `recovery-verification.json`: photos4、series1、series_photos3、settings13、hero3、categories0、pricing0。公開3＋非公開試験1。12画像・1作品集JSON。サイトURL以外の全列比較。
- `negative-verification.json`: 稼働中backup拒否、破損hash拒否、未登録ファイル拒否、path traversal拒否、失敗前後の顧客データ不変。既存データがある復元先も上書き拒否。
- `evidence/restored/render-comparison.json`: sample/restoredの送信用PDFを全4頁描画しピクセル同一。復元後の印刷用PDFも生成・全頁目視。
- 今回は同じMac内の別環境。災害対策、外部への暗号化保管、自動日次backup、失敗通知は商用構成の承認後に実施する。

## 原因を直した途中失敗

API型checkでreplaceAllの対象ECMAScript差を修正。owner静的料金の修正後、汎用顧客のカスタム料金テストに顧客siteUrlを明示。UI取り込み待機のtile数条件を修正。Bunの個別testに`./`が無いとファイルfilterになりscratchの旧ソースまで走るため、個別testは`bun test ./...`を使う。修正後の実行だけを最終合格に採用。

## 承認と最小の外部確認

詳細・推奨案・影響は[原価・承認事項](../delivery/cost-and-approval.md)へ集約。現行価格を維持し、登録量・納期・修正と、操作相談／環境保守／作品編集代行を分けて合意する。過去の1,480円/1,500円案や30日制限を採用していない。

本番反映と作者用相談の受信試験は完了。次は最初の顧客環境の名義・課金上限、正式な保守と取消・移管条件の承認。承認後に実クラウド設置→非公開バケット・DNS/TLS・メール受信→本人の短い更新試験→公開承認を行う。物理印刷と実売上は別記録。サブスクリプション基盤を作る必要はない。

## 最終固定版と検証結果

- 配布固定版: `dc3923831d210b542ffa105eb3f39d5e5fcf93c7`。`release-equivalence.json`でeaf03279から全runtimeソースの一致を確認。変更はリハーサル補助・テスト・資料。固定版の実buildも両サイトhealthで確認。
- `bun run check`: 単体1534、tools60、guard48、型・lint・schema/migration・buildが成功。wiki鮮度は既存8件の警告（内容を未確認で日付更新しない）。Nodeのmodule type警告は残るが失敗ではない。
- 全体smoke: 633成功／186対象外／0失敗、20.9分。既存PDFを含む。実PGで新しいprivateフラグの成功・失敗経路を別検証。最終ドキュメント変更のためだけに同じ全体smokeを再実行していない。
- `test:kit`: 4成功、17assertions。既存の返金済み状態を遅延paid通知で復活させない。外部ops/決済を置換する新CRMではなく手動照合補助。
- `review-verification.json`: 資料リンクとPDF全リンク200、1440/390px、横はみ出しなし、秘密ファイルへのパス404。画面は `evidence/review-desktop.png` / `review-mobile.png`。
- すべてレビュー用branch。main統合、本番デプロイ、外部送信、新規有料契約はしていない。

**初回版の記録（最終版では解消）:** PDF検証時のPopplerは埋め込みフォントに警告を出す。描画した全頁の日本語・写真の目視とpypdfの日本語抽出は正常で、復元後も同一描画。警告を「物理印刷適合」の証拠として扱わず、紙での確認は未実施のまま残す。

## 2026-09-28 オーナーの見た目・販売力の再確認

文字中心の確認入口には画像・動画が無く、技術リハーサルの完了から販売表現まで完成と受け取られかねない状態だった。販売準備全体の完成は未達として扱う。`scripts/kit/review.ts` を写真のある実画面、スマホ実画面、実出力PDF、既存の28.88秒操作動画を中心に改訂。5画像・1動画を埋め込み、検証資料は折りたたみへ分離。価格・公開済みの条件は変えない。1440/390/320px、画像読込、動画再生・字幕ファイル、内部リンク、動画部分取得、秘密ファイル拒否、JS例外なしを確認。証拠 `visual-review-verification.json`。今回の変更は未公開のローカル確認ページだけで、本番販売ページへは未反映。

3枚の写真の権利は、Wikimedia各ファイルに加えて米国国立公文書館の公式79-AAシリーズ解説を確認し、`sample-sources.json` に記録。説明用・実顧客実績ではないと画面で示す。見込み客が欲しいと思うか、価格に納得するか、購入に至るかは未確認。文字を減らして画像を入れたことを需要・集客の証明にしない。

次の販売検証では許可のある見込み客の5〜10枚を使った実見本を提示し、「自分で使いたいか」「総額と継続費用に納得できるか」「買わない理由」を聞く。連絡・素材利用・注文は承認した対象だけで行い、架空の感想・申込数・成約率は載せない。

## 2026-09-28 販売表現と相談前の内容を仕上げ

ローカル入口5799の構成・文章・余白を改訂。実サイトのシリーズ／ギャラリー／プロフィールを切り替え、受取物、本人更新と環境保守の分担、制作費の総額と実費、納品時の本人確認を具体化。FAQは素材準備・操作・端末・既存サイト・写真の権利／原本保管・公開後の窓口の6件。価格は共通商品定義を参照し、契約条件を新設していない。PDFの試作上限は現状説明として残し、将来の完成仕様にしていない。

相談前のメモはプラン・用途・希望時期・素材状況だけで作成し、コピー／テキスト保存できる。個人情報入力・外部送信・申込・決済なし。確認用の導線であり、実際の相談受付は公開承認後の接続が必要。

実装は `scripts/kit/review.ts` と `scripts/kit/review/{page.html,style.css,client.js}`。検証は `scratch/kit-delivery/refinement-verification.json` と `evidence/refined-*`。1440/390/320pxの表示・画像、3ページの切替とキーボード、メモへのプラン反映、コピー成功／拒否の模擬試験、実テキスト保存、Escapeとフォーカス復帰、動画再生、14リンク、秘密パス拒否、JS例外0・書込み要求0を確認。lintと構文確認も成功。顧客アプリ固定版dc392383、本番サイト、実決済・本人操作・物理印刷の未確認状態はそのまま。

## 2026-09-28 メインサイトとのデザインの連続性

公開中のトップと `/portfolio-kit` を実際に移動して比較し、公開settingsの書体とソースのテーマ規則を確認。ローカル販売案の独立ロゴと緑・生成りをやめ、江口秋 / Aki Eguchiの名前、Shippori Mincho / Josefin Sans、白黒の背景・文字色へ揃えた。メインのGallery・Series・About・Contactへの導線、現在ページ表示、上下の戻り先を用意。商品内の案内は一段下に分け、スマホはMenuで開閉する。スマホの見本画像は見出し直後に置く。

`review/theme.js` は公開側と同じ `theme-preference` のlight/dark/systemを扱い、初回描画前に適用。端末の明暗追従、手動変更の保持、他タブ変更、保存禁止時の切り替えも対応。localhostとakieguchi.comは別オリジンのため、現在のプレビューが本番の選択を自動継承するわけではない。同一オリジンへ本番統合する際は共通の設定とヘッダーを使用する。今回、公開サイトの設定やリンク先は変更していない。

証拠は `continuity-verification.json` / `evidence/continuity-*`。明暗それぞれ1440/390/320px、メニュー・Escape・ページ内移動、テーマ変更と再読込・端末変更・他タブ同期、保存禁止、JS無効時のメイン導線、戻り先のHTTP応答を検証。ブラウザーでもスマホのメインサイトへの往復と両書体の読込を確認した。既存の見本切替・相談メモ・動画・秘密パス拒否は `refinement-verification.json` で再確認。商用公開・実受信・購入者本人の更新・物理印刷の未確認状態は変更なし。


## 2026-09-28 集客・初回納品の再設計

独立した静的プレビューの改善だけで終わらせず、販売画面を実アプリへ統合。作者サイトの書体・設定色・明暗・写真中心ヘッダーを引き継ぐ。実物の納品画面4種、更新デモ、PDF、料金、相談へ接続。価格表示と受付のプラン表示を共通定義へ寄せ、本文FAQと検索用FAQも一致させた。作者の販売ページtitleがブラウザー遷移後に別の題へ変わる問題と、遅延表示で見本アンカーに着かない問題を修正。顧客サイトでは作者用販売画面を出さない。

検索ガイドには架空見本の構成理由・画像・PDFとの使い分け・年間費用の計算を追加。Google登録済みだけをもって集客成功としない。実測の根拠・期間・公開後の見る指標は 手元の `output/portfolio-kit-owner/search-baseline-20260928.md`。

最初は顧客名義の環境を担当者が設定し、URL・管理画面・短いガイド・運用カードを渡す。秋さんの仕事と技術作業を分け、返信文と本人操作の説明順序を 手元の `output/portfolio-kit-owner/owner-start-here.md` に整理。新しい保守案は 手元の `output/portfolio-kit-owner/offer-review-20260928.md` にだけ記載し、公表価格や契約へ反映していない。

今回の公開・実受信テストの対象と影響は、手元の `output/portfolio-kit-owner/publication-review.md`。本番公開、実際のメール通知、新しい有料契約は未実施。


今回の検証（2026-09-28）：`bun run check` 成功（単体1534、ツール60、guard48、型・lint・build）。その後の見本ガイド・アンカーの差分は型・lint・build、関連SEO単体411、PC/スマホの販売・受付smoke12で成功。全体smokeは634成功・186対象外・1中断（Library高速スクロール検査中の `Execution context was destroyed`）。この実行中にもコードを更新しており、トレースにViteの再接続を確認。編集を止めた版で該当ケースを3回再実行してすべて成功。全体一括成功とは記録しない。架空注文の4単体も成功。

実画面では1440/390/320px、明暗、見本画像、相談画面、ガイドから見本への移動を確認。新しい確認用5899は本番の公開GETだけを中継し、API書込み403、ブラウザーの外部送信はCSPで遮断。資料3種・受取人ガイド・PDFの200、秘密パス404を確認。sample5599/復元5699のhealthはともにdc392383。復元の内容・画像照合は先行リハーサルの証拠を保持し、今回復元を再実行したとは扱わない。

根拠：`scratch/kit-sales-check.log`、`kit-sales-intake-final.log`、`kit-sales-scroll-recheck.log`、`kit-sales-smoke.log`、`scratch/kit-delivery/evidence/sales/`。未採用の料金案とSearch Consoleの実測値は公開Gitへ入れず `output/portfolio-kit-owner/` に保存。

## 2026-09-28 本番公開と実受付の確認

オーナー「やろう」で公開差分とテスト1件を承認。`f426107` をmainへ通常push、Railway成功、本番 `/api/health` のbuild `f4261078` を確認。元checkoutもfast-forwardし、既存の未コミット2ファイルと未追跡資料を保持。顧客見本・復元環境が稼働中のためworktreeは維持。

本番トップから販売ページへ移動し、同じヘッダー・書体・darkテーマを確認。PC1280pxとスマホ幅390pxで横はみ出しなし、見本切替、ガイド→見本アンカー、画像読込、ブラウザーエラー0。販売・ガイド・相談、robots/sitemap、見本画像6点・PDFはHTTP200。公開画像/PDFは検証済みローカルとバイト一致。Kit/guideはindex、相談はnoindex、canonicalとHTML no-storeを確認。

公開フォームからテスト1件を送り、受付番号を画面・既存案件管理・Gmailのメール本文で照合。Gmail受信箱への到着も確認した。テスト案件は識別名付きで残し、入金0、顧客への連絡なし。受付番号とメール証拠は非公開の `output/portfolio-kit-owner/production-acceptance.md`。公開証拠は `scratch/kit-delivery/evidence/sales/production-http.json` と `production-desktop.png` / `production-mobile.png`。

今回の製品コードは先行検証済みf426107と同一。新しい全体テストを実行したとは扱わない。検索順位・新規相談・実売上の増加、第三者本人の更新、実顧客クラウドの復元、物理印刷は未確認。無料相談の受付は開始可能。有料受注は個別総額と条件の合意後に進める。

## 2026-09-28 最終修正・再納品検証

固定配布版847ac5f3へ更新。静的TrueTypeの全体埋込みで文字欠けを修正し、Poppler警告0・全頁の日本語と写真を確認。ゴミ箱GETの自動削除を廃止、モバイルメニューも修正。Git archive内で直接ビルドして古いTurbo成果物の混入を防止。最終バックアップから空の5999環境へ復元し、版更新・認証再発行・データ照合・両サイト各13項目とPDFの描画一致に成功。詳細・実測・未確認事項は [最終確認](remaining-issues-20260928.md)。
