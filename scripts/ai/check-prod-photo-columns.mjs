#!/usr/bin/env node
/**
 * 本番 Turso の photos テーブルに、写真メタデータの7列があるかを確認する。
 *
 * **読み取り専用。** 実行するSQLは `PRAGMA table_info(photos)` の1本だけで、
 * ALTER / INSERT / UPDATE / DELETE / db:push は一切行わない。
 * 接続URLと認証トークンは読み込むが、表示も保存もしない。
 *
 *   node scripts/ai/check-prod-photo-columns.mjs
 *
 * 終了コード: 0 = 7列すべてある / 1 = 足りない列がある / 2 = 実行できなかった
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** 2026-07-28 の移行 `0005_mysterious_madame_masque.sql` が足す7列。 */
const EXPECTED = [
  "shot_at_source",
  "shot_at_digitized",
  "source_width",
  "source_height",
  "source_format",
  "camera_make",
  "camera_model",
];

function readEnv(name) {
  for (const file of [".env", "packages/web/.env"]) {
    let text;
    try {
      text = readFileSync(resolve(REPO, file), "utf8");
    } catch {
      continue;
    }
    const m = text.match(new RegExp(`^${name}=(.*)$`, "m"));
    if (m && m[1].trim()) return m[1].trim();
  }
  return null;
}

const url = readEnv("DATABASE_URL");
const authToken = readEnv("DATABASE_AUTH_TOKEN");

if (!url) {
  console.error("DATABASE_URL が .env に見つかりません。");
  process.exit(2);
}
// 接続先の種類だけ出す。ホスト名・トークンは出さない。
console.log(`接続先: ${url.startsWith("libsql://") ? "Turso (libsql)" : "その他"}`);
console.log("実行するSQL: PRAGMA table_info(photos)  ← 読み取りのみ\n");

const client = createClient({ url, authToken: authToken ?? undefined });

try {
  const result = await client.execute("PRAGMA table_info(photos)");
  const columns = result.rows.map((r) => String(r.name));
  const missing = EXPECTED.filter((c) => !columns.includes(c));

  console.log(`photos テーブルの列数: ${columns.length}`);
  for (const c of EXPECTED) {
    console.log(`  ${columns.includes(c) ? "あり" : "無し"}  ${c}`);
  }

  if (missing.length === 0) {
    console.log("\n結果: 7列すべて存在する。移行は適用済み。");
    process.exit(0);
  }
  console.log(`\n結果: ${missing.length}列 足りない → ${missing.join(", ")}`);
  console.log("対処はオーナーの直接依頼がある場合だけ。エージェントは実行しない。");
  process.exit(1);
} catch (error) {
  console.error("確認できませんでした:", error?.message ?? error);
  process.exit(2);
} finally {
  client.close();
}
