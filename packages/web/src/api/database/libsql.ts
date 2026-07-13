import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

const client = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });

// ── Retry wrapper for Turso ECONNRESET ──────────────
// drizzle-orm 0.45+ wraps every query failure in a generic "Failed query: …"
// message, so the transient/non-transient signal now lives in `err.cause`
// (the original driver error) rather than the top-level message.
function isTransientDbError(err: unknown): boolean {
  const seen = new Set<unknown>();
  let current: any = err;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if (current.code === "ECONNRESET") return true;
    if (
      typeof current.message === "string" &&
      (current.message.includes("ECONNRESET") ||
        current.message.includes("socket connection was closed"))
    ) {
      return true;
    }
    current = current.cause;
  }
  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 300,
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (isTransientDbError(err) && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, delayMs * attempt));
        continue;
      }
      throw err;
    }
  }
  throw new Error("withRetry: unreachable");
}
