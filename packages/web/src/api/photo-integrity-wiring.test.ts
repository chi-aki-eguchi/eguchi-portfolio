import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync(import.meta.dir + "/index.ts", "utf8");

describe("photo integrity route wiring", () => {
  test("registration rechecks fileHash inside a transaction", () => {
    const route = source.slice(
      source.indexOf('.post("/admin/photos"'),
      source.indexOf('// ── Admin: Update photo'),
    );
    expect(route).toContain("db.transaction");
    expect(route).toContain("schema.photos.fileHash");
    expect(route).toContain("withUploadRegistrationCompensation");
  });

  test("duplicate, restore, and purge share the integrity queue", () => {
    for (const route of [
      '.post("/admin/photos/:id/duplicate"',
      '.post("/admin/photos/:id/restore"',
      '.delete("/admin/photos/:id/purge"',
    ]) {
      const start = source.indexOf(route);
      expect(source.slice(start, start + 1600)).toContain(
        "runPhotoIntegrityMutation",
      );
    }
  });

  test("category reassignment and deletion stay in one transaction", () => {
    const route = source.slice(
      source.indexOf('.delete("/admin/categories/:id"'),
      source.indexOf('// ── Admin: Reorder categories'),
    );
    expect(route).toContain("db.transaction");
    expect(route.indexOf(".update(schema.photos)")).toBeLessThan(
      route.indexOf("tx.delete(schema.categories)"),
    );
  });
});
