import { describe, expect, test } from "bun:test";
import { errorDetailsForLog } from "./error-log";

describe("errorDetailsForLog", () => {
  test("keeps a nested PostgreSQL reason and error code", () => {
    const databaseError = Object.assign(
      new Error(
        'column "photos.shot_at_source" does not exist at postgresql://reader:secret@example.test:5432/app',
      ),
      { code: "42703" },
    );
    const error = Object.assign(new Error("Failed query"), {
      cause: databaseError,
    });

    const details = errorDetailsForLog(error);

    expect(details).toContain("Failed query");
    expect(details).toContain('[code=42703]: column "photos.shot_at_source" does not exist');
    expect(details).not.toContain("reader");
    expect(details).not.toContain("secret");
    expect(details).not.toContain("example.test");
  });

  test("redacts credential-like values from a direct error", () => {
    const details = errorDetailsForLog(
      new Error(
        "connection failed: password=not-for-logs authorization: Bearer not-for-logs",
      ),
    );

    expect(details).toContain("password=[redacted]");
    expect(details).toContain("authorization: [redacted]");
    expect(details).not.toContain("not-for-logs");
  });
});
