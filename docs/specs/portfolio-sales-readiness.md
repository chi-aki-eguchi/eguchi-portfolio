# Portfolio Kit 販売・納品検証

2026-09-28 着手。統合依頼: Downloads/portfolio-kit-sales-delivery-codex.md。元の依頼書を保持し、この表を更新版とする。

基準・最新origin/main: `bd4ea81871928fe6aa290d3a43c07e4dc7531a73`。mainの `.gitignore` / `vite.try.config.ts` と未追跡資料を保持。既存PDF等のworktreeは操作しない。今回: `codex/kit-delivery`。本番へのmain pushは行わず、レビュー用ブランチで検証する。

## 着手時の現状表

|ID|利用者への約束|コードと文書の場所|現状|再現手順|顧客への影響|優先度|完了証拠|
|---|---|---|---|---|---|---|---|
|C01|検証した版を渡す|task.md / Git|実装・実測確認済み|fetch・HEAD・worktree list|基準と一致|P0|上記SHA|
|C02|個人サイトと独立|service-visibility.ts|実装あり・未検証|顧客URLで起動|営業ページ混入の検査が必要|P0|リハーサルへ|
|C03|PostgreSQL + S3|database/index.ts|実装あり・未検証|空PGへ起動|実接続の証拠不足|P0|リハーサルへ|
|C04|個別設置|DISTRIBUTION.md|文書だけ|空環境構築|再現性不足|P0|ツール追加へ|
|C05|30,000 / 69,800 / 任意9,800円|PortfolioServicePricing.tsx|実装確認済み・契約未再確認|日英UI|条件を無断変更しない|P0|商品定義を共通化|
|C06|設定済み納品|料金部品|実装あり・未検証|素材登録→納品|基本プラン枚数等は個別合意|P0|納品例へ|
|C07|自分で更新|photographer-guide.md|文書の不一致|初回案内を読む|初期構築と日常更新が混同|P0|ガイド改訂へ|
|C08|顧客の版更新|template-update-guide.md|文書だけ|main追従手順|未検証更新の危険|P0|固定配布版へ|
|C09|版履歴|template-release-notes.md|文書だけ・古い|先頭2026-08-17|現行PDF等と不一致|P0|リリース記録へ|
|C10|提出PDF・写真集|admin-pdf / portfolio-pdf|実装あり・今回未検証|専用smoke|成果を保持|P1|回帰へ|
|C11|制作物保存|portfolio-pdf/model.ts|実装あり・今回未検証|JSON export/import|ブラウザー保存・画像別途|P0|バックアップへ|
|C12|画像品質|api/index.ts|実装確認済み|UPLOAD_MAX_PX=3200|原本復元・印刷保証不可|P1|ガイドに明記|
|C13|PDF負荷|共有image queue|実装あり・今回未検証|繰返し生成|過去RSS対処を成功扱いしない|P1|負荷検証へ|
|C14|相談・通知|portfolio-intake.ts|実装あり・外部未確認|モック送信|実受信は別確認|P0|既存specへ|
|C15|受付ID・再送|portfolio-intake.ts|実装あり・今回未検証|失敗系spec|二重受付防止|P0|既存specへ|
|C16|表示の一致|ogp.ts / service.tsx|不具合再現|publicPageFallbackText|旧静的説明と2プランUIが不一致|P0|共通商品定義で修正中|
|C17|本番と作業の分離|main push→Railway|実装確認済み|Git運用|main pushは公開操作|P0|作業ブランチに隔離|

## 提供方式の判断

推奨: 初期設定付き個別環境、顧客名義のドメイン・ホスティング、担当者による設置・版更新。顧客は管理画面のみ。運用窓口と作品編集代行を分ける。顧客ごとにDB・バケット・認証を分離し、共通SaaSは初回納品の前提にしない。

代案: オーナー名義で複数環境を運用。請求集約はできるが、停止・移管・障害・継続料金の責任が増える。未承認の月額を作らず、契約と費用上限承認後に選ぶ。既存契約は変更しない。

## 索引

- 商品定義: `packages/web/src/shared/portfolio-product.ts`（現行表示の共通化）
- 顧客ガイド: `docs/photographer-guide.md`
- 納品・商談資料: `docs/delivery/`（承認前は下書き）
- リハーサルと証拠: `scripts/kit/` / `scratch/kit-delivery/`

初回販売可否は検証終了後に更新。購入・実機・紙・実顧客による更新は技術試験と別。
