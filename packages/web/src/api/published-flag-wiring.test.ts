import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync(import.meta.dir + "/index.ts", "utf8");

function routeBetween(start: string, end: string): string {
  return source.slice(source.indexOf(start), source.indexOf(end));
}

describe("published flag validation", () => {
  test("every admin write path rejects non-boolean visibility values", () => {
    const routes = [
      routeBetween(
        '.patch("/admin/photos/:id"',
        '// ── Admin: Duplicate a photo',
      ),
      routeBetween(
        '.post("/admin/series"',
        '.patch("/admin/series/:id"',
      ),
      routeBetween(
        '.patch("/admin/series/:id"',
        '.delete("/admin/series/:id"',
      ),
      routeBetween(
        '.post("/admin/pricing"',
        '.patch("/admin/pricing/:id"',
      ),
      routeBetween(
        '.patch("/admin/pricing/:id"',
        '.delete("/admin/pricing/:id"',
      ),
    ];

    for (const route of routes) {
      expect(route).toContain("parseStrictBoolean(body.isPublished)");
      expect(route).toContain('error: "Invalid isPublished"');
      expect(route).not.toContain("!!body.isPublished");
    }
  });
});
