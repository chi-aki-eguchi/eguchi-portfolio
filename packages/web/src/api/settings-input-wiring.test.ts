import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync(import.meta.dir + "/index.ts", "utf8");

describe("settings input validation wiring", () => {
  test("rejects a non-object body and typed values before any settings write", () => {
    const route = source.slice(
      source.indexOf('.post("/admin/settings"'),
      source.indexOf('// ── Admin: Server-side upload'),
    );

    expect(route).toContain("isSettingsPayload(body)");
    expect(route).toContain("invalidKeys");
    expect(route).toContain("Invalid settings values");
  });

  test("rejects invalid contact keys before the atomic database write", () => {
    const route = source.slice(
      source.indexOf('.post("/admin/settings"'),
      source.indexOf("// ── Admin: Server-side upload"),
    );
    const validation = route.indexOf("invalidContactSettingKeys");
    const write = route.indexOf("writeSettingsAtomic");

    expect(validation).toBeGreaterThanOrEqual(0);
    expect(write).toBeGreaterThan(validation);
    expect(route).toContain("invalidKeys: allInvalidKeys");
    expect(route).toContain("normalizeContactSettingValue");
  });
});
