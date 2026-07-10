import { sql, type SQL } from "drizzle-orm";

// 並び替え(sortOrder一括更新)の CASE WHEN SQL を1箇所で組み立てる。
//
// THEN 側を CAST(? AS INTEGER) で固定しているのが本質:
// PostgreSQL は「全分岐が未型付けパラメータの CASE」を text と型解決するため、
// CAST なしでは integer 列 sort_order への代入が実行時エラー
// (42804: column "sort_order" is of type integer but expression is of type text)
// になる。SQLite/libSQL は動的型付けのため CAST の有無で挙動が変わらない。
// 2026-07-11 に PGlite(実Postgres/WASM)で再現・修正確認済み
// (scratch/pg-reorder-repro/repro.ts)。
//
// table / idColumn は API 内部の定数のみを渡すこと(sql.raw のため、
// リクエスト由来の文字列を渡してはならない)。ids は呼び出し側で
// cleanIntIds 済みの整数のみ・1件以上を前提とする。
export function buildReorderUpdate(
  table: string,
  idColumn: string,
  ids: readonly number[],
): SQL {
  const caseExpr = ids.reduce(
    (expr, id, i) => sql`${expr} WHEN ${id} THEN CAST(${i} AS INTEGER)`,
    sql`CASE ${sql.raw(idColumn)}`,
  );
  const inList = sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  );
  return sql`UPDATE ${sql.raw(table)} SET sort_order = ${caseExpr} END WHERE ${sql.raw(idColumn)} IN (${inList})`;
}
