import { describe, test, expect } from "bun:test";

// Hand-duplicated from libsql.ts (kept in sync manually), because the real
// module creates a Turso client at import time and can't be loaded standalone
// in a unit test. Mirror any change to libsql.ts's withRetry here too.
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

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 10,
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

describe("withRetry", () => {
  test("returns result on first success", async () => {
    const result = await withRetry(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  test("retries on ECONNRESET and succeeds", async () => {
    let attempts = 0;
    const result = await withRetry(async () => {
      attempts++;
      if (attempts < 3) throw Object.assign(new Error("fail"), { code: "ECONNRESET" });
      return "ok";
    });
    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });

  test("retries on socket connection closed", async () => {
    let attempts = 0;
    const result = await withRetry(async () => {
      attempts++;
      if (attempts === 1) throw new Error("socket connection was closed");
      return "recovered";
    });
    expect(result).toBe("recovered");
    expect(attempts).toBe(2);
  });

  test("does not retry on bare 'Failed query' with no transient cause", async () => {
    // drizzle-orm 0.45+ wraps every query failure in "Failed query: …", so a
    // bare match on that message alone must not trigger a retry anymore.
    let attempts = 0;
    await expect(
      withRetry(async () => {
        attempts++;
        throw new Error("Failed query: some reason");
      }),
    ).rejects.toThrow("Failed query");
    expect(attempts).toBe(1);
  });

  test("retries when a drizzle-wrapped error's cause is ECONNRESET", async () => {
    let attempts = 0;
    const result = await withRetry(async () => {
      attempts++;
      if (attempts === 1) {
        const cause = Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });
        throw new Error("Failed query: SELECT * FROM photos", { cause });
      }
      return "recovered";
    });
    expect(result).toBe("recovered");
    expect(attempts).toBe(2);
  });

  test("does not retry when a drizzle-wrapped error's cause is a constraint violation", async () => {
    let attempts = 0;
    await expect(
      withRetry(async () => {
        attempts++;
        const cause = new Error("UNIQUE constraint failed: photos.filename");
        throw new Error("Failed query: INSERT INTO photos", { cause });
      }),
    ).rejects.toThrow("Failed query");
    expect(attempts).toBe(1);
  });

  test("throws after max retries on persistent transient error", async () => {
    let attempts = 0;
    await expect(
      withRetry(async () => {
        attempts++;
        throw Object.assign(new Error("fail"), { code: "ECONNRESET" });
      }),
    ).rejects.toThrow("fail");
    expect(attempts).toBe(3);
  });

  test("throws immediately on non-transient error", async () => {
    let attempts = 0;
    await expect(
      withRetry(async () => {
        attempts++;
        throw new Error("NOT_FOUND");
      }),
    ).rejects.toThrow("NOT_FOUND");
    expect(attempts).toBe(1);
  });

  test("respects custom maxRetries", async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts++;
          throw new Error("ECONNRESET in message");
        },
        5,
        1,
      ),
    ).rejects.toThrow();
    expect(attempts).toBe(5);
  });
});
