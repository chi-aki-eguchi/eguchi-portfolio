import { afterEach, describe, expect, test } from "bun:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as schema from "./schema";
import { writeSettingsAtomic } from "./settings-write";

// Q-3 (audit-2026-07.md P2-1): POST /admin/settings が逐次 upsert のため、
// 途中失敗で部分反映になり得た。ここでは実際の SQLite トランザクションで
// 「バッチの一部だけ書き込まれる」ことが起きないと証明する。
//
// `:memory:` はプロセス内で複数コネクションを開くと共有されない
// (ロールバック後に "no such table" になる駆動系の癖を確認済み)ため、
// 一時ファイル DB を使う — 本番 Turso への疎通と同じ「1つの実ファイルに
// 複数コネクションが書く」構造に近い。

const tmpDirs: string[] = [];

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

// テスト専用の CHECK 制約(value の長さ上限)で、バッチ途中の失敗を
// 決定的に再現する。本番スキーマにはこの制約はない。
async function makeTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "settings-write-test-"));
  tmpDirs.push(dir);
  const client = createClient({ url: `file:${join(dir, "test.db")}` });
  await client.execute(
    "CREATE TABLE site_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL CHECK (length(value) <= 5))",
  );
  return drizzle(client, { schema });
}

describe("writeSettingsAtomic", () => {
  test("commits every entry when all succeed", async () => {
    const db = await makeTestDb();
    await writeSettingsAtomic(db, schema.siteSettings, [
      ["a", "1"],
      ["b", "2"],
    ]);
    const rows = await db.select().from(schema.siteSettings);
    expect(rows.sort((x, y) => x.key.localeCompare(y.key))).toEqual([
      { key: "a", value: "1" },
      { key: "b", value: "2" },
    ]);
  });

  test("rolls back the whole batch when one entry fails mid-transaction", async () => {
    const db = await makeTestDb();
    await expect(
      writeSettingsAtomic(db, schema.siteSettings, [
        ["a", "ok"],
        ["b", "too-long-value"], // テスト用 CHECK 違反でトランザクション中断
        ["c", "ok2"],
      ]),
    ).rejects.toThrow();

    const rows = await db.select().from(schema.siteSettings);
    // 失敗した "b" より前に実行された "a" の insert も残っていないこと
    // (=部分反映が起きていないこと)を確認する。
    expect(rows).toEqual([]);
  });

  test("rolls back an in-flight update too, not only fresh inserts", async () => {
    const db = await makeTestDb();
    await db.insert(schema.siteSettings).values({ key: "a", value: "orig" });

    await expect(
      writeSettingsAtomic(db, schema.siteSettings, [
        ["a", "new"],
        ["b", "still-too-long"],
      ]),
    ).rejects.toThrow();

    const rows = await db.select().from(schema.siteSettings);
    expect(rows).toEqual([{ key: "a", value: "orig" }]);
  });

  test("is a no-op for an empty batch", async () => {
    const db = await makeTestDb();
    await writeSettingsAtomic(db, schema.siteSettings, []);
    const rows = await db.select().from(schema.siteSettings);
    expect(rows).toEqual([]);
  });
});
