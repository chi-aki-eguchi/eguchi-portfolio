import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync(import.meta.dir + "/index.ts", "utf8");

function routeSource(start: string, end: string) {
  return source.slice(source.indexOf(start), source.indexOf(end));
}

describe("single-record write target checks", () => {
  test("does not report a missing photo, series, or plan as saved", () => {
    const routes = [
      routeSource(
        '.patch("/admin/photos/:id"',
        '// ── Admin: Duplicate a photo',
      ),
      routeSource(
        '.patch("/admin/series/:id"',
        '.delete("/admin/series/:id"',
      ),
      routeSource(
        '.patch("/admin/pricing/:id"',
        '.delete("/admin/pricing/:id"',
      ),
    ];

    for (const route of routes) {
      expect(route).toContain(".returning({ id:");
      expect(route).toContain('error: "Not found"');
      expect(route).toContain("404");
    }
  });

  test("does not edit a photo that was moved to the trash", () => {
    const photoPatch = routeSource(
      '.patch("/admin/photos/:id"',
      '// ── Admin: Duplicate a photo',
    );
    expect(photoPatch).toContain("isNull(schema.photos.deletedAt)");
  });
});
