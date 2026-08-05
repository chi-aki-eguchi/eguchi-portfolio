import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync(import.meta.dir + "/index.ts", "utf8");

describe("public series cover visibility", () => {
  test("does not expose an unpublished cover photo from the public series list", () => {
    const coverLookup = source.slice(
      source.indexOf("const covers = coverIds.length"),
      source.indexOf("const coverMap"),
    );

    expect(coverLookup).toContain("schema.photos.isPublished, true");
  });
});
