import { describe, test, expect } from "bun:test";

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 10,
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const isTransient =
        err?.code === "ECONNRESET" ||
        err?.message?.includes("ECONNRESET") ||
        err?.message?.includes("socket connection was closed") ||
        err?.message?.includes("Failed query");
      if (isTransient && attempt < maxRetries) {
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

  test("retries on Failed query", async () => {
    let attempts = 0;
    const result = await withRetry(async () => {
      attempts++;
      if (attempts === 1) throw new Error("Failed query: some reason");
      return "recovered";
    });
    expect(result).toBe("recovered");
    expect(attempts).toBe(2);
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
