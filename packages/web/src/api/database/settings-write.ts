import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type * as libsqlSchema from "./schema";

// 型のみの参照(`import type`)。libsql.ts の実クライアント生成やこのファイル自体の
// 実行時 import は一切発生しない — DATABASE_URL 未設定のテスト環境でも
// このモジュール単体を安全に読み込める(withRetry.test.ts と同じ制約)。
type SettingsDb = LibSQLDatabase<typeof libsqlSchema>;
type SiteSettingsTable = typeof libsqlSchema.siteSettings;

// 呼び出し側(`./database` 経由で provider 別に解決済みの db/schema)が
// postgres/libsql どちらのテーブルオブジェクトを渡しても、この関数自身は
// `db.transaction()` と汎用クエリビルダしか使わない(provider 固有 API 不使用)。
export async function writeSettingsAtomic(
  db: SettingsDb,
  siteSettingsTable: SiteSettingsTable,
  entries: ReadonlyArray<readonly [string, string]>,
): Promise<void> {
  if (entries.length === 0) return;
  await db.transaction(async (tx) => {
    for (const [key, value] of entries) {
      await tx
        .insert(siteSettingsTable)
        .values({ key, value })
        .onConflictDoUpdate({
          target: siteSettingsTable.key,
          set: { value },
        });
    }
  });
}
