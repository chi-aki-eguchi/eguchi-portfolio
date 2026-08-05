import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const apiSource = readFileSync(import.meta.dir + "/index.ts", "utf8");
const adminSource = readFileSync(
  import.meta.dir + "/../web/pages/admin-tabs.tsx",
  "utf8",
);

function routeSource(start: string, end: string) {
  return apiSource.slice(apiSource.indexOf(start), apiSource.indexOf(end));
}

describe("non-photo reorder safety wiring", () => {
  test("each ordered list rejects a stale order before updating it", () => {
    const routes = [
      routeSource(
        '.post("/admin/categories/reorder"',
        "// ── Series (public)",
      ),
      routeSource(
        '.post("/admin/series/reorder"',
        "// ── Pricing plans (public)",
      ),
      routeSource(
        '.post("/admin/pricing/reorder"',
        "// ── note posts",
      ),
      routeSource(
        '.post("/admin/hero-photos/reorder"',
        "// ── Admin: Batch-generate thumbnails",
      ),
    ];

    for (const route of routes) {
      expect(route).toContain("expectedIds");
      expect(route).toContain("runOrderedListMutation");
      expect(route).toContain("applyExactReorderIfCurrent");
      expect(route).not.toContain("runReorder(");
    }
  });

  test("the admin sends the order it originally loaded with every save", () => {
    expect(adminSource.match(/json: \{ ids, expectedIds \}/g)).toHaveLength(3);
    expect(adminSource).toContain("json: { photoIds, expectedIds }");
    expect(adminSource).toContain("expectedIds: before");
    expect(adminSource).toContain("expectedIds: lastMove.after");
  });
});
