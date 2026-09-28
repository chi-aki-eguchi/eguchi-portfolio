# Portfolio Kit 販売・納品検証

2026-09-28 JST。統合依頼 `Downloads/portfolio-kit-sales-delivery-codex.md` の現状表を実物に照らして更新した正本。元の依頼書は保持。

**判定: ローカルの技術納品リハーサルは完了。初回有料提供は条件付き可。** 顧客名義の独立環境を担当者が設置し、設定済みサイトと管理画面を渡す方式。新規顧客クラウド、正式な提供・保守・取消条件、公開承認、本人操作・実受信の確認が揃うまで新しい約束で受注・公開しない。会員登録・自動課金・一般SaaSは初回納品の前提にしない。

## 実物と変更の所在

- 確認用入口: http://127.0.0.1:5799/ （このMacのみ、公開URLではない）
- 顧客用見本 LAND / ARCHIVE: http://127.0.0.1:5599/ / 管理画面 `/admin`
- 別DB・別画像保存先・別認証へ復元した見本: http://127.0.0.1:5699/
- [受取人ガイド](../photographer-guide.md)、[納品パック・商談文](../delivery/customer-pack.md)、[設置・復元・終了手順](../delivery/operations.md)、[原価・承認事項](../delivery/cost-and-approval.md)
- `output/pdf/portfolio-kit-sample-screen.pdf` / `portfolio-kit-sample-print.pdf`。各4頁、アプリから出力。`output/kit-delivery/` はローカル納品パック、Gitへ載せない。
- 基準・着手時origin/main: `bd4ea81871928fe6aa290d3a43c07e4dc7531a73`。元checkoutの `.gitignore` / `vite.try.config.ts` と未追跡資料、既存PDF・自由編集worktreeを保持。
- 作業: `codex/kit-delivery`、`/Users/chiaki/.codex/worktrees/kit-delivery/eguchi-portfolio-app`。個人サイトへのmain push・本番設定・本番データ変更は未実施。
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
|C13|PDF画像負荷|共有image queue|短期実測済み・長期未確認|12巡で枠解放、RSS増加傾向は残る|P1|security-load.json|
|C14|相談・通知|portfolio-intake.ts|既存モック回帰成功・実受信未確認|実メール送信をしていない|P0|単体 / smoke|
|C15|受付ID・再送|portfolio-intake.ts|既存回帰成功|外部ops本番の挙動は未確認|P0|単体 / smoke|
|C16|販売表示の一致|ogp.ts / Pricing|不一致を修正|ownerの静的説明と構造化Offerも同じ2プラン|P0|ogp / SPA単体|
|C17|作業と本番の分離|作業branch / opt-in flags|維持|現行本番の公開範囲を変えない|P0|Git差分・health|

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
|V11|PASS|既存相談保存・同ID再送・通知失敗のモック回帰。外部ops実配信はNOT_RUN|
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
|V24|PASS|商品共通定義、日英料金UI・noscript・構造化2Offer、FAQ/購入後の現行条件保持。新しい価格は公開しない。本番反映はNOT_RUN|
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

次は①この差分の本番適用範囲、②最初の顧客環境の名義・課金上限、③正式な保守と取消・移管条件の承認。承認後に実クラウド設置→非公開バケット・DNS/TLS・メール受信→本人の短い更新試験→公開承認を行う。物理印刷と実売上は別記録。サブスクリプション基盤を作る必要はない。

## 最終固定版と検証結果

- 配布固定版: `dc3923831d210b542ffa105eb3f39d5e5fcf93c7`。`release-equivalence.json`でeaf03279から全runtimeソースの一致を確認。変更はリハーサル補助・テスト・資料。固定版の実buildも両サイトhealthで確認。
- `bun run check`: 単体1534、tools60、guard48、型・lint・schema/migration・buildが成功。wiki鮮度は既存8件の警告（内容を未確認で日付更新しない）。Nodeのmodule type警告は残るが失敗ではない。
- 全体smoke: 633成功／186対象外／0失敗、20.9分。既存PDFを含む。実PGで新しいprivateフラグの成功・失敗経路を別検証。最終ドキュメント変更のためだけに同じ全体smokeを再実行していない。
- `test:kit`: 4成功、17assertions。既存の返金済み状態を遅延paid通知で復活させない。外部ops/決済を置換する新CRMではなく手動照合補助。
- `review-verification.json`: 資料リンクとPDF全リンク200、1440/390px、横はみ出しなし、秘密ファイルへのパス404。画面は `evidence/review-desktop.png` / `review-mobile.png`。
- すべてレビュー用branch。main統合、本番デプロイ、外部送信、新規有料契約はしていない。

PDF検証時のPopplerは埋め込みフォントに警告を出す。描画した全頁の日本語・写真の目視とpypdfの日本語抽出は正常で、復元後も同一描画。警告を「物理印刷適合」の証拠として扱わず、紙での確認は未実施のまま残す。

## 2026-09-28 オーナーの見た目・販売力の再確認

文字中心の確認入口には画像・動画が無く、技術リハーサルの完了から販売表現まで完成と受け取られかねない状態だった。販売準備全体の完成は未達として扱う。`scripts/kit/review.ts` を写真のある実画面、スマホ実画面、実出力PDF、既存の28.88秒操作動画を中心に改訂。5画像・1動画を埋め込み、検証資料は折りたたみへ分離。価格・公開済みの条件は変えない。1440/390/320px、画像読込、動画再生・字幕ファイル、内部リンク、動画部分取得、秘密ファイル拒否、JS例外なしを確認。証拠 `visual-review-verification.json`。今回の変更は未公開のローカル確認ページだけで、本番販売ページへは未反映。

3枚の写真の権利は、Wikimedia各ファイルに加えて米国国立公文書館の公式79-AAシリーズ解説を確認し、`sample-sources.json` に記録。説明用・実顧客実績ではないと画面で示す。見込み客が欲しいと思うか、価格に納得するか、購入に至るかは未確認。文字を減らして画像を入れたことを需要・集客の証明にしない。

次の販売検証では許可のある見込み客の5〜10枚を使った実見本を提示し、「自分で使いたいか」「総額と継続費用に納得できるか」「買わない理由」を聞く。連絡・素材利用・注文は承認した対象だけで行い、架空の感想・申込数・成約率は載せない。

## 2026-09-28 販売表現と相談前の内容を仕上げ

ローカル入口5799の構成・文章・余白を改訂。実サイトのシリーズ／ギャラリー／プロフィールを切り替え、受取物、本人更新と環境保守の分担、制作費の総額と実費、納品時の本人確認を具体化。FAQは素材準備・操作・端末・既存サイト・写真の権利／原本保管・公開後の窓口の6件。価格は共通商品定義を参照し、契約条件を新設していない。PDFの試作上限は現状説明として残し、将来の完成仕様にしていない。

相談前のメモはプラン・用途・希望時期・素材状況だけで作成し、コピー／テキスト保存できる。個人情報入力・外部送信・申込・決済なし。確認用の導線であり、実際の相談受付は公開承認後の接続が必要。

実装は `scripts/kit/review.ts` と `scripts/kit/review/{page.html,style.css,client.js}`。検証は `scratch/kit-delivery/refinement-verification.json` と `evidence/refined-*`。1440/390/320pxの表示・画像、3ページの切替とキーボード、メモへのプラン反映、コピー成功／拒否の模擬試験、実テキスト保存、Escapeとフォーカス復帰、動画再生、14リンク、秘密パス拒否、JS例外0・書込み要求0を確認。lintと構文確認も成功。顧客アプリ固定版dc392383、本番サイト、実決済・本人操作・物理印刷の未確認状態はそのまま。
