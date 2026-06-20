import { drizzle } from "drizzle-orm/bun-sql";
import * as schema from "./schema.postgres";

function normalizeDatabaseUrl(raw: string | undefined): string {
  if (!raw) {
    throw new Error("DATABASE_URL is required for PostgreSQL database mode.");
  }

  try {
    const url = new URL(raw);
    const host = url.hostname;
    const isRailwayPostgres =
      host.endsWith(".railway.internal") || host.endsWith(".proxy.rlwy.net");

    if (isRailwayPostgres && !url.searchParams.has("sslmode")) {
      url.searchParams.set("sslmode", "require");
      console.log("[database] Railway PostgreSQL URL detected; using sslmode=require.");
      return url.toString();
    }
  } catch {
    // Let Bun SQL surface the real connection-string error below.
  }

  return raw;
}

const databaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);

export const db = drizzle(databaseUrl, { schema });

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
