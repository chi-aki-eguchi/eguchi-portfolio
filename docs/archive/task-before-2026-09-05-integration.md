# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-09-05 JST（管理画面訴求を公開・先行改善はローカル保持）

- **Status:** 管理画面を主役にした販売ページを別worktreeから公開済み（`67b73dd3`）。以下の先行改善は未commit・未pushのまま保持。
- **Current owner:** Codex / **Handoff readiness:** ready（公開前に下記オーナー確認が必要）
- 写真詳細ページを追加し、固有題と十分な説明がある代表作だけを検索対象・
  sitemap対象にする。薄い写真は共有できるが `noindex, follow` のままにした。
- 空のWorkはSeriesへ案内し、`/profile` はAboutへ正規化。HERO画像を画面幅に
  合わせて配信し、無駄なフォント取得とランダムHEROの誤った先読みを止めた。
- Privacy・利用条件・販売条件を日英で追加。販売者名・税・キャンセル・返金が
  未確認の間はPortfolio Kitの直接決済を出さず、Contactで確認する安全な導線にした。
- 公開英語ページと共通UIの日本語混在を解消。問い合わせ・言語切替・Kit導線・
  SPA遷移を個人情報なしでGA4計測し、実在しない詳細URLは計測しない。
- 管理画面の保存後に公開側キャッシュを更新し、古いHERO・Gallery・Series・
  Work・写真詳細が残らないようにした。
- 2026-09-05 の確認: `bun run check` exit 0（1289 pass / 0 fail）、
  `bun run smoke` exit 0（358 passed / 149 skipped / 0 failed / 0 flaky）。
  目視用6画面も撮影し、公開8ページのCLSは最大0.047（基準0.1未満）。
- 本番DB・Turso・R2・Railway・環境変数・課金・公開設定は変更していない。

### 残件

- 2026-09-05の追加相談で正式氏名「江口秋」は本人確認済み。価格・返金・規約・
  個人情報運用の提案は `docs/specs/portfolio-kit-sales-policy-draft.md`。未採用・未公開。
  追加回答で普段の拠点は日本と確認。台湾は時々渡航し撮影対応できる地域。
  具体的住所・税区分・新規契約条件は未確定。
- Portfolio Kit公開前に、住所・電話の表示または請求時開示手順、
  3万円の税込/税別、工程別キャンセル・返金条件、施行日をオーナーが確定する。
- 問い合わせ送信サービス名、保存期間、削除手順を確認しPrivacyへ反映する。
- 公開する場合は、既存の未コミット作業と分けて内容を確認してからcommit/pushする。

### 2026-09-05 15:33 JST — 管理画面を主役にした販売ページを公開

- オーナーは機能の充実・わかりやすい管理・写真の入れ替え・公開後も自分で変更できる点を主役にする方針。
- 日英の見出し・料金欄・FAQ・検索共有文を更新し、管理画面紹介を購入説明より前へ移した。実画面3種の切替・拡大とデモ入口を追加。
- `origin/main` 基点の `/tmp/aki-admin-sales.9iS0hI`、`codex/admin-sales` で実装。commit `67b73dd` を通常pushし、本番healthのbuild `67b73dd3`・status okと実画面を確認。
- 最終checkは1225 tests・tools 56件成功、公開smoke 20件成功。本番も日英×390px/1440pxで画像読込・切替・キーボード・横幅を確認。
- 本番資料は `scratch/admin-sales-live.qBUDx6/`。詳細は上のworktree内 `docs/specs/admin-led-sales-page.md`。
- 元の作業台の製品コードは保持。次の統合では今回の管理画面訴求と既存Studio導線を落とさない。価格・決済設定・未採用の規約条件はこの作業では変更していない。

### 2026-09-05 12:39 JST — 別worktreeの公開済み作業

- 上の「未commit・未push・未deploy」は既存のローカル改善分の状態。別依頼で
  `origin/main` 基点の `/tmp/aki-studio-integration.PsMfDs` を作り、Portfolio Studioへの
  所有者サイト限定の導線だけを実装・pushした。元の未コミット変更は保持している。
- 本番は `02690153`。`/api/health` の build と status ok、PC・390px画面で確認。
  ナビのPortfolio Kit、販売ページ冒頭とプラン比較、所有者サイトのフッターから
  <https://photo-work-pricing.chi-aki-18.chatgpt.site/> へ接続している。
- 公開済みcommitは `df4e7f9`、`6c90c6a`、`0269015`。このローカルmainは現時点で
  origin/mainに対しahead 1 / behind 3。未コミット作業と同じLayout・service・テストが
  重なるため、次回は公開済みの導線を保持して統合する。強制push・reset・checkoutで消さない。
- 最終 `bun run check` はexit 0（1225 pass / 0 fail、tools 56 pass）。途中は
  所有者ナビ表示を変えた旧期待値で1件失敗し、期待値とoff/購入者サイト回帰テストを修正した。
  今回はAdmin変更なし。既存の358件smoke結果は上のローカル改善分の検証であり、今回の実行結果ではない。
- Studioの69,800円はKit分を含む総額で追加30,000円ではない。購入者へ配るKitでは
  `isServiceOwnerSite` によりStudio広告を表示しない。明示的サービスoffも保持する。
- Studio本番v10では、無料相談の保存→ブラウザー経由Formspree通知→実際の受信箱到着を確認。
  新商品の決済、本人の販売者情報・正式条件、実顧客の有料受注は未完了。
- 本追記は引き継ぎ用のローカル文書変更。元の未公開改善分はcommit/pushしていない。


### 2026-09-05 — フォルダ・AI指示の整理

- 共通方針を `AGENTS.md` へ統一し、過剰な確認・役割固定・重複検証を整理。
- 旧資料とローカル予定はarchiveへ保存。既存の製品コード変更・写真・worktreeを保持。
- この整理はローカル作業。公開済みStudio導線と未公開の製品変更の統合は引き続き残件。
### 2026-09-05 — 起動処理の改善

- PM2設定の評価時に実行していた `db:push`・暗黙のbuild・古いBUILD_ID診断を撤去。
- `bun run start` は配信ファイルの存在を確認して `startOrRestart` する。ファイル不足時は既存プロセスへ触れず終了する。設定のcwdは絶対パスにした。
- 起動前確認の実測中央値0.050ms（50回）。運用ツール60テストと変更範囲lintが成功。PM2・本番サーバー・DBは検証のために起動していない。
- サーバー自身の起動時migrationは継続。今回もローカル変更のみで、上記の公開済みStudio導線と既存未公開改善の統合は別途残る。
<!-- CURRENT_STATE_END -->

過去の詳しい状態は [整理前の記録](docs/archive/task-before-2026-09-05-folder-cleanup.md) と `docs/archive/task-handoffs.md`。
