// 起動時の自動マイグレーション（配布版 = PostgreSQL のみ）。
//
// 秋さん本番 (akieguchi.com) は DATABASE_PROVIDER 未設定 = Turso/libSQL のため、
// この関数は即 return し本番には一切影響しない。
//
// 配布版 (DATABASE_PROVIDER=postgres) では、Deploy on Railway 直後の空 DB に対し
// 起動時に drizzle のマイグレーションを適用する。受け取った人が手で db:push /
// migrate を打つ必要がない。drizzle の migrator は `__drizzle_migrations` で適用
// 済みを追跡するため、再起動・再デプロイで何度呼ばれても安全（idempotent）。
//
// 失敗時はサイトを無言で壊さないよう、原因と対処を明示してから例外を投げ直す。
// 呼び出し側 (server.ts) は process.exit(1) する想定で、デプロイは loud に失敗し、
// Railway は前バージョンを維持する（壊れた新版がトラフィックを受けない）。
import { resolve } from "node:path";

export async function runStartupMigrations(): Promise<void> {
  if (process.env.DATABASE_PROVIDER !== "postgres") return;

  // 動的 import: 本番(libsql)パスでは pg ドライバ/migrator を一切ロードしない。
  // `./postgres` はプロバイダ切替境界と同じモジュール実体なので接続は共有される。
  const [{ db }, { migrate }] = await Promise.all([
    import("./postgres"),
    import("drizzle-orm/bun-sql/migrator"),
  ]);

  // migrate.ts (= src/api/database) から見た packages/web/drizzle-postgres。
  // server は `bun packages/web/src/server.ts` でソース実行されるため、
  // cwd ではなくこのファイル基準で解決して取りこぼさない。
  const migrationsFolder = resolve(import.meta.dir, "../../../drizzle-postgres");

  try {
    console.log(`[migrate] applying PostgreSQL migrations from ${migrationsFolder} ...`);
    await migrate(db, { migrationsFolder });
    console.log("[migrate] PostgreSQL schema is up to date.");
  } catch (err) {
    console.error("[migrate] FAILED to apply PostgreSQL migrations — the server will NOT start.");
    console.error("[migrate] (Failing loudly so the deploy is marked failed instead of serving a broken site.)");
    console.error("[migrate] Check: is DATABASE_URL reachable and is the PostgreSQL plugin attached?");
    console.error("[migrate] See README → \"Deploy on Railway (distribution template)\".");
    console.error(err instanceof Error ? `[migrate] ${err.name}: ${err.message}` : err);
    throw err;
  }
}
