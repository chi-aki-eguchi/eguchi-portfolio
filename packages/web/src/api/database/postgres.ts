import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import * as schema from "./schema.postgres";

const SSL_QUERY_PARAMS = ["sslmode", "sslcert", "sslkey", "sslrootcert"];

function getDatabaseConfig(raw: string | undefined): PoolConfig {
  if (!raw) {
    throw new Error("DATABASE_URL is required for PostgreSQL database mode.");
  }

  try {
    const url = new URL(raw);
    const host = url.hostname;
    const isRailwayPostgres =
      host.endsWith(".railway.internal") || host.endsWith(".proxy.rlwy.net");

    if (isRailwayPostgres) {
      for (const param of SSL_QUERY_PARAMS) url.searchParams.delete(param);
      console.log("[database] Railway PostgreSQL URL detected; using TLS for pg connection.");
      return railwayPoolConfig(url.toString());
    }
  } catch {
    // Let node-postgres surface the real connection-string error below.
  }

  return { connectionString: raw, connectionTimeoutMillis: 15_000 };
}

function railwayPoolConfig(connectionString: string): PoolConfig {
  return {
    connectionString,
    connectionTimeoutMillis: 15_000,
    ssl: { rejectUnauthorized: false },
  };
}

const pool = new Pool(getDatabaseConfig(process.env.DATABASE_URL));

export const db = drizzle(pool, { schema });

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 300,
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const message = String(err?.message ?? "");
      const code = String(err?.code ?? "");
      const isTransient =
        code === "ECONNRESET" ||
        code === "ECONNREFUSED" ||
        code === "ETIMEDOUT" ||
        message.includes("ECONNRESET") ||
        message.includes("connection") ||
        message.includes("timeout");
      if (isTransient && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, delayMs * attempt));
        continue;
      }
      throw err;
    }
  }
  throw new Error("withRetry: unreachable");
}
