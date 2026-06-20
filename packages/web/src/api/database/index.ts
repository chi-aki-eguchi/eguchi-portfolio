// Database provider switch.
//
// 秋さん本番 (akieguchi.com) は DATABASE_PROVIDER 未設定 → Turso/libSQL のまま。
// 配布版テンプレート (Railway All-in-One) は DATABASE_PROVIDER=postgres で
// PostgreSQL + Railway Storage 構成に切り替わる。
//
// 動的 import なので、未選択側のドライバ・スキーマはロードされない。
// = 本番(libsql)では postgres.ts の DATABASE_URL 必須チェックも走らず、
//   挙動・テストは従来と完全に同一。
import * as libsqlSchema from "./schema";
import * as pgSchema from "./schema.postgres";

const usePostgres = process.env.DATABASE_PROVIDER === "postgres";

// 列名は両スキーマで一致しているため、クエリビルダ向けには libsql 側の型で
// 統一して扱う。boolean/timestamp の保存形式差は実体テーブルが吸収する。
export const schema = (usePostgres ? pgSchema : libsqlSchema) as typeof libsqlSchema;

const impl = usePostgres ? await import("./postgres") : await import("./libsql");

export const db = impl.db as typeof import("./libsql").db;
export const withRetry = impl.withRetry;
