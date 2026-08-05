import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync(import.meta.dir + "/index.ts", "utf8");

describe("thumbnail upload compensation wiring", () => {
  test("cleans a successful derivative if its sibling upload fails", () => {
    const helper = source.slice(
      source.indexOf("async function generateAndUploadThumbnails"),
      source.indexOf("async function generateAndUploadThumb(\n"),
    );
    expect(helper).toContain("uploadAllOrCleanup");
    expect(helper).toContain("deleteStorageKeys");
  });
});
