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

const MIGRATION_RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 12_000, 16_000];

function databaseUrlSummary(raw: string | undefined): string {
  if (!raw) return "missing";

  try {
    const url = new URL(raw);
    const host = url.hostname;
    const hostKind = host.endsWith(".railway.internal")
      ? "*.railway.internal (Railway private network)"
      : host.endsWith(".proxy.rlwy.net")
        ? "*.proxy.rlwy.net (Railway public TCP proxy)"
        : "custom host";
    const sslmode = url.searchParams.get("sslmode") ?? "not set";

    return `${hostKind}; protocol=${url.protocol.replace(":", "")}; sslmode=${sslmode}; database=${url.pathname ? "set" : "missing"}`;
  } catch {
    return "invalid URL";
  }
}

function migrationErrorLines(err: unknown, depth = 0): string[] {
  const prefix = depth === 0 ? "" : `cause ${depth}: `;
  if (!(err instanceof Error)) return [`${prefix}${String(err)}`];

  const lines = [`${prefix}${err.name}: ${err.message}`];
  const record = err as unknown as Record<string, unknown>;
  const fields = ["code", "errno", "syscall", "address", "port"];
  const details = fields
    .filter((key) => record[key] !== undefined)
    .map((key) => `${key}=${String(record[key])}`);
  if (details.length > 0) lines.push(`${prefix}${details.join(" ")}`);

  const cause = (err as Error & { cause?: unknown }).cause;
  if (cause) lines.push(...migrationErrorLines(cause, depth + 1));
  return lines;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

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

  console.log(`[migrate] DATABASE_URL target: ${databaseUrlSummary(process.env.DATABASE_URL)}`);

  for (let attempt = 1; attempt <= MIGRATION_RETRY_DELAYS_MS.length + 1; attempt++) {
    try {
      console.log(`[migrate] applying PostgreSQL migrations from ${migrationsFolder} ...`);
      await migrate(db, { migrationsFolder });
      console.log("[migrate] PostgreSQL schema is up to date.");
      return;
    } catch (err) {
      const delayMs = MIGRATION_RETRY_DELAYS_MS[attempt - 1];
      if (delayMs !== undefined) {
        console.warn(`[migrate] attempt ${attempt} failed; retrying in ${delayMs}ms.`);
        for (const line of migrationErrorLines(err)) console.warn(`[migrate] ${line}`);
        await sleep(delayMs);
        continue;
      }

      console.error("[migrate] FAILED to apply PostgreSQL migrations — the server will NOT start.");
      console.error("[migrate] (Failing loudly so the deploy is marked failed instead of serving a broken site.)");
      console.error("[migrate] Check: is DATABASE_URL reachable and is the PostgreSQL plugin attached?");
      console.error("[migrate] See README → \"Deploy on Railway (distribution template)\".");
      for (const line of migrationErrorLines(err)) console.error(`[migrate] ${line}`);
      throw err;
    }
  }
}
