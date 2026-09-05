# packages/web

ReactとHono APIが同居するパッケージ。作業方針・検証・pushはルートの `AGENTS.md` が正本。

| 場所（このパッケージからの相対パス） | 役割 |
|---|---|
| `src/api/index.ts` | APIルートとAppType |
| `src/api/database/` | DB接続、withRetry、Turso/PostgreSQLスキーマ、起動時migration |
| `src/api/http-compression.ts` | 応答本文とContent-Encodingの整合 |
| `src/api/ogp.ts`、`src/api/public-routes.ts` | OGPと公開ルート |
| `src/shared/` | API・画面の共通型と純関数 |
| `src/server.ts` | 本番サーバー。起動時migrationを呼ぶ |
| `src/web/app.tsx` | 画面のルーティング |
| `src/web/pages/`、`src/web/components/` | 画面と共通UI |
| `src/web/lib/api.ts` | 型付きAPIクライアント |
| `src/web/lib/settings-preview.ts` | 設定キー台帳 |

開発は `bun run dev`、局所的な型確認は `bun x tsc -b`、単体テストは `bun test ./src`。
`tsc --noEmit` はこの構成で検査対象が空になるため使い分けに注意する。
完成時の検証はルート `AGENTS.md`、DB適用の注意は `docs/checklists.md` を参照する。
