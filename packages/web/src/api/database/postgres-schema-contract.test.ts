import { describe, expect, test } from "bun:test";
import {
  findColumnSetDrift,
  verifyPostgresSchemaMigrations,
} from "./postgres-schema-contract";

describe("PostgreSQL schema migration contract", () => {
  test("the checked-in PostgreSQL schema, snapshot, and SQL migrations agree", () => {
    expect(() => verifyPostgresSchemaMigrations()).not.toThrow();
  });

  test("reports a schema column that has no generated migration", () => {
    const drift = findColumnSetDrift(
      new Map([
        [
          "photos",
          new Set(["id", "shot_at_source", "source_width"]),
        ],
      ]),
      new Map([["photos", new Set(["id", "source_width"])]]),
      "schema.postgres.ts",
      "migration snapshot",
    );

    expect(drift).toEqual([
      "schema.postgres.ts table photos has columns missing from migration snapshot: shot_at_source",
    ]);
  });
});
