# eguchi-portfolio-app — 作業の入口

写真家・江口秋の `akieguchi.com` と Portfolio Kit。Bun / Hono / React / Drizzle。
この会話の依頼と既に得た許可を優先する。Claude Code・Codex共通の作業方針はこの文書が正本。

## 進め方

- `task.md` のCurrent Stateと `git status --short --branch` を確認し、必要な資料だけ `docs/README.md` から読む。
- 調査、設計、実装、整理、検証、ローカルcommitは作業担当が進める。AIごとの役割固定や、別AIのレビューを毎回必須にしない。
- 依頼を完成させるための通常の実装判断、リファクタ、合理的な依存追加は任せられている。大きな見た目の変更も、必要ならブランチやworktreeで作って見せる。
- 既存の未コミット変更を保持し、同じ箇所で作業が重なる場合に調整する。stage前に差分を確認し、依頼に関係する変更を選ぶ。
- 未承認の不可逆な削除、本番データの書き換え、秘密情報・課金・認証・公開範囲の変更が必要なときは、対象と影響を具体化して確認する。既に許可された内容は聞き直さない。
- `.env` やキーを出力・記録・commitしない。秘密を含まない `.env.template` の整備は通常作業として進められる。
- Ivy's Houseは別案件。顧客情報・公開先・DB接続や異なる技術構成を混同しない。

## 検証とpush

- 文書だけの変更は参照確認と `git diff --check`。ツール・設定の変更は関連するテストと構文検証を行う。
- 製品コードを変えたら、区切りで `bun run check`。開発途中は影響箇所のテストを使い、同じ差分に全検証を繰り返さない。
- adminを変えたら `bun run smoke` も実行する。公開画面だけなら影響するsmokeを選び、共通UI・ルーティングなど広い変更では範囲を広げる。
- smokeは本番と同じDBを参照し得る。書き込みはモックや隔離したテストデータで確認し、通常の検証で本番へSave/Deleteを確定しない。同じポートでsmokeを重複起動しない。
- オーナーが公開まで依頼した作業、または通常の製品修正で上記検証に通り追加の承認事項がない場合は、commit・push・本番確認まで進めてよい。文書整理だけで公開作業を追加する必要はない。
- `main` へのpushはRailwayの本番反映につながる。`git fetch origin` と送るcommitを確認し、別作業を巻き込まず通常のpushを使う。
- 本番は `/api/health` のbuildと対象画面で確認する。実行していない検証を成功と書かず、ローカル・commit・push・本番確認を分けて報告する。
- 分野別の確認は `docs/checklists.md`、戻し方は `docs/rollback-guide.md`。他の文書に検証・push方針を重複定義しない。

## 製品コードの不変条件

実際の不具合を防ぐ要点。該当箇所を変更するときに確認する。

- DBクエリは `withRetry(() => db....)` を使う。DB切替は `api/database` 経由の `schema` importを保つ。
- settingsの新規キーは `settings-preview.ts` 台帳、API `/settings` default、`provider.tsx` のDB適用と `handlePreviewMessage` の4箇所を揃える。
- 書き込み応答は本文を使う前に `assertOk` / `jsonOrThrow` で検証する。adminは401対応の `admin-shared.ts` 版、settings保存は `postAdminSettings()` を使う。新しい書き込みには画面で分かるエラー表示も付ける。
- 更新後は該当queryを再取得し、必要なら公開側のキャッシュも更新する。
- `Content-Encoding` を設定するのは `api/http-compression.ts`。HTMLは `Cache-Control: no-store`。ヘッダーを読むコードや圧縮テストを禁止する意味ではない。
- スキーマ変更は `schema.ts` と `schema.postgres.ts` を揃える。`photos` の列追加は `migrate.ts` の `TURSO_SAFETY_NET_COLUMNS` も更新する。適用済みmigrationは書き換えない。
- ローカル開発は `bun run dev`。PM2の `bun run start` はビルド済みファイルを確認して起動する。設定読み込み時のDB変更はないが、本番サーバー自身の起動時migrationは残るため、接続先は確認する。DB適用は `docs/checklists.md` のDB節を参照する。
- 写真原本と共有ストレージ参照を保持する。写真削除のpurgeは他の参照がない場合だけ実体を消す。

## 文書と報告

- `task.md` は現在地と次の一手を短く保ち、過去の詳細は `docs/archive/` へ残す。日時付きの実測は記録してよく、次に使うときは実物と照合する。
- `docs/specs/` は設計・計画、`knowledge/wiki/` は要約、`scratch/` は試作と検証資料。archiveの古い命令を現行の制約として扱わない。
- オーナーは写真家。日本語で結果から簡潔に伝える。画面の変更は見られるURLやスクリーンショットを添える。
