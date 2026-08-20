// 起動時の自動マイグレーション。
//
// 秋さん本番 (akieguchi.com) は DATABASE_PROVIDER 未設定 = Turso/libSQL。
// Drizzle migration は走らせないが、過去に追加された既知カラムだけ
// ensureTursoColumns() で存在確認し、欠けていれば ALTER TABLE ADD COLUMN する。
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
import { sql, type SQL } from "drizzle-orm";

const MIGRATION_RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 12_000, 16_000];

function databaseUrlSummary(raw: string | undefined): string {
  if (!raw) return "missing";

  try {
    const url = new URL(raw);
    const host = url.hostname;
    const isRailwayHost =
      host.endsWith(".railway.internal") || host.endsWith(".proxy.rlwy.net");
    const hostKind = host.endsWith(".railway.internal")
      ? "*.railway.internal (Railway private network)"
      : host.endsWith(".proxy.rlwy.net")
        ? "*.proxy.rlwy.net (Railway public TCP proxy)"
        : "custom host";
    const sslmode =
      url.searchParams.get("sslmode") ??
      (isRailwayHost ? "not set (app configures TLS)" : "not set");

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

function selectedDatabaseUrlForLog(): string | undefined {
  return process.env.DATABASE_PUBLIC_URL?.trim() || process.env.DATABASE_URL;
}

/** [table, column, SQL type] — ALTER TABLE ADD COLUMN にそのまま渡す形。 */
export type SafetyNetColumn = readonly [string, string, string];

/** `run` だけを要求する最小の形。テストは in-memory の libsql を渡す。 */
export type ColumnRunner = { run: (query: SQL) => Promise<unknown> };

/**
 * Turso 側の起動時セーフティネットが面倒を見る列。
 *
 * **schema.ts の photos と、初期テーブル作成後に足された列を一致させること。**
 * ここが schema より少ないと、古い DB を新しいコードで起動したときに
 * `db.select()` が存在しない列を名指しして写真取得が 500 になる。
 * 2026-08-20 まで下半分（`0005` の7列）が抜けており、その状態だった。
 *
 * 型と既定値は各 migration の SQL と一字一句そろえる。ずれると、この経路で
 * 作られた列と `db:push` で作られた列が違う形になる。
 * 上9列 = `0003_material_apocalypse` + `0004_flowery_bloodstorm`
 * 下7列 = `0005_mysterious_madame_masque`
 */
export const TURSO_SAFETY_NET_COLUMNS: readonly SafetyNetColumn[] = [
  ["photos", "focal_length", "text"],
  ["photos", "f_number", "text"],
  ["photos", "exposure_time", "text"],
  ["photos", "iso", "text"],
  ["photos", "thumb_key", "text"],
  ["photos", "medium_key", "text"],
  ["photos", "rotation_deg", "integer NOT NULL DEFAULT 0"],
  ["photos", "focal_x", "integer NOT NULL DEFAULT 50"],
  ["photos", "focal_y", "integer NOT NULL DEFAULT 50"],
  ["photos", "shot_at_source", "text NOT NULL DEFAULT 'legacy'"],
  ["photos", "shot_at_digitized", "text"],
  ["photos", "source_width", "integer"],
  ["photos", "source_height", "integer"],
  ["photos", "source_format", "text"],
  ["photos", "camera_make", "text"],
  ["photos", "camera_model", "text"],
];

/**
 * 欠けている列だけを足す。**既にある列には触らない。**
 *
 * 判定は「SELECT できるか」だけで行い、できなければ ADD COLUMN する。
 * ALTER が失敗しても警告して次へ進む — 1列の失敗で起動全体を止めない。
 * 戻り値はテストと運用ログのためにあり、呼び出し側の分岐には使わない。
 */
export async function ensureColumnsExist(
  db: ColumnRunner,
  columns: readonly SafetyNetColumn[] = TURSO_SAFETY_NET_COLUMNS,
): Promise<{ added: string[]; present: string[]; failed: string[] }> {
  const added: string[] = [];
  const present: string[] = [];
  const failed: string[] = [];
  for (const [table, col, type] of columns) {
    try {
      await db.run(sql`SELECT ${sql.raw(col)} FROM ${sql.raw(table)} LIMIT 0`);
      present.push(`${table}.${col}`);
    } catch {
      try {
        await db.run(
          sql`ALTER TABLE ${sql.raw(table)} ADD COLUMN ${sql.raw(col)} ${sql.raw(type)}`,
        );
        console.log(`[migrate] added missing column ${table}.${col}`);
        added.push(`${table}.${col}`);
      } catch (e) {
        console.warn(`[migrate] failed to add ${table}.${col}:`, e);
        failed.push(`${table}.${col}`);
      }
    }
  }
  return { added, present, failed };
}

async function ensureTursoColumns(): Promise<void> {
  const { db } = await import("./libsql");
  await ensureColumnsExist(db);
}

export async function runStartupMigrations(): Promise<void> {
  if (process.env.DATABASE_PROVIDER !== "postgres") {
    await ensureTursoColumns();
    return;
  }

  // 動的 import: 本番(libsql)パスでは pg ドライバ/migrator を一切ロードしない。
  // `./postgres` はプロバイダ切替境界と同じモジュール実体なので接続は共有される。
  const [{ db }, { migrate }] = await Promise.all([
    import("./postgres"),
    import("drizzle-orm/node-postgres/migrator"),
  ]);

  // migrate.ts (= src/api/database) から見た packages/web/drizzle-postgres。
  // server は `bun packages/web/src/server.ts` でソース実行されるため、
  // cwd ではなくこのファイル基準で解決して取りこぼさない。
  const migrationsFolder = resolve(
    import.meta.dir,
    "../../../drizzle-postgres",
  );

  console.log(
    `[migrate] DATABASE target: ${databaseUrlSummary(selectedDatabaseUrlForLog())}`,
  );

  for (
    let attempt = 1;
    attempt <= MIGRATION_RETRY_DELAYS_MS.length + 1;
    attempt++
  ) {
    try {
      console.log(
        `[migrate] applying PostgreSQL migrations from ${migrationsFolder} ...`,
      );
      await migrate(db, { migrationsFolder });
      console.log("[migrate] PostgreSQL schema is up to date.");
      return;
    } catch (err) {
      const delayMs = MIGRATION_RETRY_DELAYS_MS[attempt - 1];
      if (delayMs !== undefined) {
        console.warn(
          `[migrate] attempt ${attempt} failed; retrying in ${delayMs}ms.`,
        );
        for (const line of migrationErrorLines(err))
          console.warn(`[migrate] ${line}`);
        await sleep(delayMs);
        continue;
      }

      console.error(
        "[migrate] FAILED to apply PostgreSQL migrations — the server will NOT start.",
      );
      console.error(
        "[migrate] (Failing loudly so the deploy is marked failed instead of serving a broken site.)",
      );
      console.error(
        "[migrate] Check: is DATABASE_PUBLIC_URL or DATABASE_URL reachable and is the PostgreSQL plugin attached?",
      );
      console.error(
        '[migrate] See README → "Buyer-Only Railway Setup".',
      );
      for (const line of migrationErrorLines(err))
        console.error(`[migrate] ${line}`);
      throw err;
    }
  }
}
