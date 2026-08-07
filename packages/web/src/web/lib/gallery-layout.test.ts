import { describe, test, expect } from "bun:test";
import { buildGalleryLayout, tileWidth, type GalleryCell } from "./gallery-layout";

const ids = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
const photoIndices = (cells: GalleryCell[]) =>
  cells.filter((c) => c.type === "photo").map((c) => (c as { photoIndex: number }).photoIndex);
const gapCount = (cells: GalleryCell[]) => cells.filter((c) => c.type === "gap").length;

// The invariants the module documents (G1.1 / G1.2), checked structurally.
function expectInvariants(cells: GalleryCell[], count: number) {
  // Every photo placed exactly once, in read order (0..count-1).
  expect(photoIndices(cells)).toEqual(Array.from({ length: count }, (_, i) => i));
  if (count >= 1) {
    // A gap is never the first or last cell.
    expect(cells[0].type).toBe("photo");
    expect(cells[cells.length - 1].type).toBe("photo");
  }
  // Never two gaps in a row.
  for (let i = 1; i < cells.length; i++) {
    expect(cells[i].type === "gap" && cells[i - 1].type === "gap").toBe(false);
  }
}

describe("buildGalleryLayout", () => {
  test("returns empty for non-positive counts", () => {
    const o = { columns: 3, emptyRate: 0.1, seed: 1, isMobile: false };
    expect(buildGalleryLayout(0, [], o)).toEqual([]);
    expect(buildGalleryLayout(-5, [], o)).toEqual([]);
  });

  test("satisfies all invariants across sizes / columns / seeds (desktop & mobile)", () => {
    for (const n of [1, 2, 5, 17, 40, 100]) {
      for (const columns of [1, 2, 3, 4]) {
        for (const seed of [1, 2, 99, 12345]) {
          for (const isMobile of [false, true]) {
            const cells = buildGalleryLayout(n, ids(n), { columns, emptyRate: 0.3, seed, isMobile });
            expectInvariants(cells, n);
          }
        }
      }
    }
  });

  test("emptyRate 0 produces no gaps", () => {
    const cells = buildGalleryLayout(30, ids(30), { columns: 3, emptyRate: 0, seed: 3, isMobile: false });
    expect(gapCount(cells)).toBe(0);
    expect(cells.length).toBe(30);
  });

  test("single photo is one photo cell, no gaps", () => {
    expect(buildGalleryLayout(1, [1], { columns: 3, emptyRate: 0.3, seed: 1, isMobile: false }))
      .toEqual([{ type: "photo", photoIndex: 0 }]);
  });

  test("is deterministic: identical inputs yield identical output", () => {
    const o = { columns: 3, emptyRate: 0.25, seed: 42, isMobile: false };
    expect(buildGalleryLayout(40, ids(40), o)).toEqual(buildGalleryLayout(40, ids(40), o));
  });

  test("seed and composition both affect the arrangement", () => {
    // Across many seeds the layout must not collapse to a single arrangement.
    const bySeed = new Set(
      Array.from({ length: 12 }, (_, s) =>
        JSON.stringify(buildGalleryLayout(40, ids(40), { columns: 3, emptyRate: 0.25, seed: s, isMobile: false }))
      )
    );
    expect(bySeed.size).toBeGreaterThan(1);
    // Same seed but a different id sequence is tied to composition → different layout.
    const a = buildGalleryLayout(40, ids(40), { columns: 3, emptyRate: 0.25, seed: 1, isMobile: false });
    const b = buildGalleryLayout(40, [...ids(40)].reverse(), { columns: 3, emptyRate: 0.25, seed: 1, isMobile: false });
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
});

describe("tileWidth", () => {
  test("variation 0 is uniform (~92%) regardless of size", () => {
    expect(tileWidth("S", 0)).toBe("92%");
    expect(tileWidth("M", 0)).toBe("92%");
    expect(tileWidth("L", 0)).toBe("92%");
  });

  test("variation 1 spreads sizes to their extremes", () => {
    expect(tileWidth("S", 1)).toBe("58%");
    expect(tileWidth("M", 1)).toBe("82%");
    expect(tileWidth("L", 1)).toBe("100%");
  });

  test("clamps variation outside [0,1]", () => {
    expect(tileWidth("S", -1)).toBe(tileWidth("S", 0));
    expect(tileWidth("L", 5)).toBe(tileWidth("L", 1));
  });

  test("unknown size falls back to M", () => {
    // @ts-expect-error — exercising the runtime `?? spread.M` fallback
    expect(tileWidth("XL", 1)).toBe(tileWidth("M", 1));
  });
});

describe("抜け頻度の上限（2026-08-07）", () => {
  const gapsAt = (emptyRate: number) => {
    const ids = Array.from({ length: 60 }, (_, i) => i + 1);
    return buildGalleryLayout(60, ids, {
      columns: 3,
      emptyRate,
      seed: 7,
      isMobile: false,
    }).filter((cell) => cell.type === "gap").length;
  };

  test("a rate above the old 0.3 ceiling produces more gaps, not the same", () => {
    // This module clamped to 0.3 while the admin offered 0.4, so 0.31–0.4 all
    // rendered identically to 0.3 and the top of the slider looked broken.
    expect(gapsAt(0.4)).toBeGreaterThan(gapsAt(0.3));
  });

  test("the declared maximum is still a real ceiling", () => {
    expect(gapsAt(99)).toBe(gapsAt(0.4));
  });
});
