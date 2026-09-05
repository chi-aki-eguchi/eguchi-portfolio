# 分野別の確認

作業に関係する節だけを使う。検証コマンドとpush可否は [AGENTS.md](../AGENTS.md)「検証とpush」が正本。別AIへの相談は、判断に役立つ場合に行う。

## Settings・Admin

- キー台帳、API default、DB適用、ライブプレビューの4箇所を揃え、空値への戻し方も確認する。
- settings保存は `postAdminSettings()`。401、`ignoredKeys`、通信失敗が成功表示にならないことを確認する。
- 更新後の再取得・公開側キャッシュ、未保存表示、ダイアログ中のキーボード操作を変更に応じて見る。
- スタイルはadminのスコープに収め、影響する画面幅で公開側へ漏れないか確かめる。
- バグ修正のテストは修正前の症状を検出できるものを選ぶ。文言・配置だけの変更に機械的なテスト追加を課さない。
- ブラウザーテストの書き込みはモックまたは隔離DBで扱う。skipは確認済みの件数に含めない。

## DB

- Turso用 `schema.ts` と配布版 `schema.postgres.ts`、生成するmigrationを対応させる。
- `photos` の列追加は `api/database/migrate.ts` の `TURSO_SAFETY_NET_COLUMNS` にも反映する。
- 既存のTurso本番は `db:push` で作られており、Drizzleのmigration台帳がない。`db:migrate` をそのまま流すと初期CREATE TABLEから再実行して失敗する。
- 本番への適用は対象DB・実際の差分・既存データへの影響を先に明らかにする。依頼・承認済みなら担当AIが進められる。未承認のDROP、列削除、データ損失は適用前に確認する。
- Tursoの手動同期は対象を確認してから `cd packages/web && bun run db:push`。PostgreSQLは配布版の起動時migrationと [DISTRIBUTION.md](../DISTRIBUTION.md) を確認する。
- `ecosystem.config.cjs` は読み取りだけで確認できる。`bun run start` はビルドの配信ファイルを確認してPM2を起動・再起動する。設定評価時の `db:push` はないが、サーバーの起動時migrationは接続先DBに適用される。ローカル開発はルートの `bun run dev`。

## 画像・配信

- 実際のAPI payloadからDOMの `currentSrc` / `complete` / `naturalWidth`、通信、`/api/health` の順に確認する。HTTP 200だけを画像表示の証拠にしない。
- master、thumb、medium、Lightbox、OGPのうち変更した経路を実画像で見る。
- 保存キーの特殊文字と共有オブジェクトの参照を保持する。リサイズパラメータを増やしたらキャッシュキーも確認する。
- `api/http-compression.ts` で本文と `Content-Encoding` が一致し、既に圧縮された応答へ重ねていないことを確かめる。HTMLの `no-store` も保持する。
- より詳しい測定例が必要なら [agents/measuring.md](agents/measuring.md) の該当節を読む。

## 公開確認

pushの条件と承認はルート `AGENTS.md` に従う。送るcommit一覧と実行した検証を確認し、デプロイ後は `/api/health` のbuild、対象画面、必要な画像を確認する。
戻し方は [rollback-guide.md](rollback-guide.md)。検証済みのローカル変更と、本番で確認できた内容を分けて報告する。
