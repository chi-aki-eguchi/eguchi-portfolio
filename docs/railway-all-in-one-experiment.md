# Railway All-in-One Experiment

目的: 配布版だけを Railway で完結させられるか確認する。秋さんの本番
`akieguchi.com` は、現行の Railway + Turso + R2 のまま維持する。

## 2026-06-20 時点の結論

クオリティを落とす必要はなさそう。

写真の圧縮、3200px への最適化、配信用のリサイズ、キャッシュはアプリ側の
`sharp` と画像プロキシで実行している。保存先が R2 から Railway Storage
Bucket に変わっても、この処理を維持できる見込みが高い。

ただし、データ保存は Turso/libSQL から PostgreSQL に変わるため、ここは
ちゃんと移植と検証が必要。

分け方は、当面は「秋さん本番 = main の Turso/R2 版」「配布用テンプレート =
PostgreSQL/Railway Storage 版」が安全。1つの同じ実行ファイルで
`DATABASE_PROVIDER=turso|postgres` を完全切替する案は、schema 型の差が大きく
複雑になりやすい。

## 今回確認できたこと

- 既存の写真保存コードは S3 互換 API を使っている。
- Railway Storage Bucket は S3 API で service から upload できる。
- PostgreSQL 用の Drizzle schema を別ファイルで作成できた。
- Drizzle で PostgreSQL 用の初期 SQL migration を生成できた。
- Bun 本体の `SQL` と Drizzle の `bun-sql` 接続口で、追加パッケージなしに
  PostgreSQL 用の接続入口を作成できた。
- Storage client は `S3_REGION` と `S3_FORCE_PATH_STYLE` を環境変数で
  切り替えられるようにした。現行R2は既定値のまま、Railway Storageでは
  必要に応じて `S3_FORCE_PATH_STYLE=true` を試せる。
- `db.run(...)` で直接実行していた並び替えSQLを `executeRaw(...)` に寄せた。
  現行Tursoでは `run`、PostgreSQLでは `execute` を使えるようにするため。

生成確認:

```sh
cd packages/web
bunx drizzle-kit generate --config=drizzle.postgres.config.ts
```

生成結果:

- `packages/web/drizzle-postgres/0000_worried_sentry.sql`
- `packages/web/src/api/database/postgres.ts`

## 壊れやすいところ

- `schema.ts` が SQLite/Turso 前提なので、配布版では PostgreSQL 用 schema と
  DB client に切り替える必要がある。
- 並び替えSQLは `executeRaw(...)` に寄せたが、PostgreSQL の実DBで
  `photos` / `categories` / `series` / `pricing_plans` / `hero_photos` の
  並び替えを確認する必要がある。
- ``sql`${...} AND ${...}``` のような条件合成は、読みやすさと移植性のために
  `and(...)` へ寄せる余地がある。
- `deletedAt` / `createdAt` は SQLite では integer timestamp、PostgreSQL では
  timestamp になるため、API の返り値と並び順を確認する。
- PostgreSQL の実DBにはまだ接続していない。次の実験で Railway PostgreSQL か
  ローカル PostgreSQL に対して schema 反映とAPI動作を確認する。

## 役割分担

Codex:

- 実験ブランチで PostgreSQL schema と生成 migration を作る。
- DB 接続切り替え案を作る。
- 型チェック、API テスト、ビルドで壊れ方を確認する。

Claude Code:

- DB / storage / deploy の P0/P1 リスクをレビューする。
- 本番と配布版を混同しないための分け方を確認する。
- 実装前後に危ない差分だけ短く見る。

## 次の実験

1. 配布用テンプレートの作業線で `schema.postgres.ts` / `postgres.ts` を実際の
   `schema.ts` / `database/index.ts` に切り替える。
2. 空の PostgreSQL に schema を流し、`/api/settings`、`/api/photos`、`/admin/login` を確認する。
3. Railway Storage Bucket の実物で、upload / image proxy / resize / delete を確認する。
4. 写真を1枚アップロードし、Gallery、Hero、Profile、削除/復元まで確認する。
5. Railway Template 化し、受け取る人の入力項目を最小化する。
