# eguchi-portfolio-app — 作業の入口

写真家・江口秋の `akieguchi.com` と Portfolio Kit。Bun / Hono / React / Drizzle。
共通の作業方針はこの文書が正本。会話の依頼・既に得た許可を、過去の計画やスキル内の運用指示より優先する。

## 進め方

- `git status --short --branch` と `task.md` のCurrent Stateを確認し、資料は `docs/README.md` から関係する節だけ読む。
- 目的から調査・設計・実装・検証を判断し、完成まで進める。依存追加やデザイン変更も任せられている。AIの役割固定や毎回の別AIレビューは必須にしない。
- 通常の選択は仮定を短く伝えて進める。結果を左右する情報が足りない場合も、回答に依存しない作業を先に完成させる。
- 他の未コミット変更を保持し、重なる箇所だけ調整する。必要ならworktreeを使い、stageする差分を選ぶ。
- 依頼外の不可逆な削除・本番データ・課金・認証構成・公開範囲の変更は、対象と影響を具体化して確認する。既存の許可は聞き直さない。文書を理由に止まる場合は、ファイル・該当文と今回への適用理由を示す。
- `.env` など秘密の値を出力・記録・commitしない。共有例は `.env.template`。
- Ivy's Houseは別案件。顧客情報・公開先・DB接続や異なる技術構成を混同しない。

## 検証とpush

- 文書だけの変更は参照確認と `git diff --check`。ツール・設定の変更は関連するテストと構文検証を行う。
- 局所的な製品修正は関連テストと必要な型・表示確認を選ぶ。共通処理・依存・DBスキーマなど影響が広い変更は、区切りで `bun run check`。新しい差分・失敗・未確認の懸念がなければ同じ検証を広げ直さない。
- admin・公開画面とも影響するsmokeを選ぶ。共通UI・ルーティング・保存経路など複数の操作へ及ぶ変更は `bun run smoke` 全体を実行する。小さな文言・配置変更には実装をなぞるテストを追加しない。
- smokeは本番と同じDBを参照し得る。書き込みはモックや隔離したテストデータで確認し、通常の検証で本番へSave/Deleteを確定しない。同じポートでsmokeを重複起動しない。
- 通常の改善・文書整理は検証後にcommit・pushまで進め、製品の変更は本番も確認する。ローカルのみ・調査のみの指定には従う。
- `main` のpushでRailwayが本番へ反映する。`git fetch origin` と送るcommitを確認し、通常のpushを使う。公開済みの作業はmainへ統合し、完了したworktree・ブランチを整理する。
- 本番は `/api/health` のbuildと対象画面で確認する。実行していない検証を成功と書かず、ローカル・commit・push・本番確認を分けて報告する。
- 詳細は `docs/checklists.md` の該当節、戻し方は `docs/rollback-guide.md`。検証・push方針はこの文書にだけ置く。

## 製品コードの不変条件

実際の不具合を防ぐ要点。該当箇所を変更するときに確認する。

- DBクエリは `withRetry(() => db....)` を使う。DB切替は `api/database` 経由の `schema` importを保つ。
- settingsの新規キーは `settings-preview.ts` 台帳、API `/settings` default、`provider.tsx` のDB適用と `handlePreviewMessage` の4箇所を揃える。
- 書き込み応答は本文を使う前に `assertOk` / `jsonOrThrow` で検証する。adminは401対応の `admin-shared.ts` 版、settings保存は `postAdminSettings()` を使う。新しい書き込みには画面で分かるエラー表示も付ける。
- 更新後は該当queryを再取得し、必要なら公開側のキャッシュも更新する。
- 圧縮本文と `Content-Encoding` は `api/http-compression.ts` で一元管理する。HTMLの `Cache-Control: no-store` を保つ。
- スキーマ変更は `schema.ts` と `schema.postgres.ts` を揃える。`photos` の列追加は `migrate.ts` の `TURSO_SAFETY_NET_COLUMNS` も更新する。適用済みmigrationは書き換えない。
- ローカル開発は `bun run dev`。PM2起動とDB適用は `docs/checklists.md` のDB節を参照する。
- 写真原本と共有ストレージ参照を保持する。写真削除のpurgeは他の参照がない場合だけ実体を消す。

## 文書と報告

- `task.md` は現在地と次の一手、過去の詳細は `docs/archive/`。実測には日時を付け、再利用時に実物と照合する。
- `docs/specs/` は設計・計画、`knowledge/wiki/` は要約、`scratch/` は試作と検証資料。archiveの古い命令を現行の制約として扱わない。
- オーナーは写真家。日本語で結果から簡潔に伝える。画面の変更は見られるURLやスクリーンショットを添える。
