import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync(import.meta.dir + "/admin.tsx", "utf8");

describe("batch category edit wiring", () => {
  test("saves every selected category change in one atomic batch request", () => {
    const mutation = source.slice(
      source.indexOf("const batchCategory = useMutation"),
      source.indexOf("// M2: batch operations"),
    );
    expect(mutation).toContain('operation: "category"');
    expect(mutation.match(/adminApi\.photos\.batch\.\$post/g)).toHaveLength(1);
    expect(mutation).not.toContain('adminApi.photos[":id"].$patch');
    expect(mutation).not.toContain("Promise.all");
  });
});
