import { describe, expect, test } from "bun:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { buildReorderUpdate } from "./reorder-sql";

// 2026-07-11 配布版(Postgres)で「並び替えに失敗」した実障害の回帰ガード。
// 原因: THEN 側が全て未型付けパラメータの CASE を PostgreSQL は text と
// 型解決し、integer 列 sort_order への代入が 42804 で失敗する。
// CAST(? AS INTEGER) の存在をここで固定する(外すとこのテストが落ちる)。
// 実Postgresでの失敗/修正の再現は scratch/pg-reorder-repro/repro.ts
// (PGlite)で確認済み — repo テストでは SQL 生成のみを検証する。
describe("buildReorderUpdate", () => {
  const ids = [12, 10, 11];

  test("PostgreSQL: THEN branches are cast to INTEGER", () => {
    const q = new PgDialect().sqlToQuery(
      buildReorderUpdate("photos", "id", ids),
    );
    expect(q.sql).toBe(
      "UPDATE photos SET sort_order = CASE id WHEN $1 THEN CAST($2 AS INTEGER) WHEN $3 THEN CAST($4 AS INTEGER) WHEN $5 THEN CAST($6 AS INTEGER) END WHERE id IN ($7, $8, $9)",
    );
    expect(q.params).toEqual([12, 0, 10, 1, 11, 2, 12, 10, 11]);
  });

  test("SQLite: same shape with ? placeholders", () => {
    const q = new SQLiteSyncDialect().sqlToQuery(
      buildReorderUpdate("photos", "id", ids),
    );
    expect(q.sql).toBe(
      "UPDATE photos SET sort_order = CASE id WHEN ? THEN CAST(? AS INTEGER) WHEN ? THEN CAST(? AS INTEGER) WHEN ? THEN CAST(? AS INTEGER) END WHERE id IN (?, ?, ?)",
    );
    expect(q.params).toEqual([12, 0, 10, 1, 11, 2, 12, 10, 11]);
  });

  test("hero_photos uses photo_id as the CASE/WHERE column", () => {
    const q = new PgDialect().sqlToQuery(
      buildReorderUpdate("hero_photos", "photo_id", [3, 4]),
    );
    expect(q.sql).toContain("CASE photo_id");
    expect(q.sql).toContain("WHERE photo_id IN");
  });

  test("single id still produces a valid statement", () => {
    const q = new PgDialect().sqlToQuery(
      buildReorderUpdate("series", "id", [7]),
    );
    expect(q.sql).toBe(
      "UPDATE series SET sort_order = CASE id WHEN $1 THEN CAST($2 AS INTEGER) END WHERE id IN ($3)",
    );
    expect(q.params).toEqual([7, 0, 7]);
  });
});
