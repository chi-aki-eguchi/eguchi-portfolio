import { describe, expect, test } from "bun:test";
import {
  computeJustifiedRows,
  justifiedRatio,
  JUSTIFIED_FALLBACK_RATIO,
  JUSTIFIED_SIZE_WEIGHT,
} from "./justified-layout";

const OPTS = { containerWidth: 976, gap: 10, baseRowHeight: 260 };

const landscape = { width: 3200, height: 2133, rotationDeg: 0 };
const portrait = { width: 2133, height: 3200, rotationDeg: 0 };

function flat(rows: ReturnType<typeof computeJustifiedRows>) {
  return rows.flatMap((r) => r.items);
}

describe("justifiedRatio", () => {
  test("uses natural w/h and swaps for 90/270 rotation", () => {
    expect(justifiedRatio(landscape)).toBeCloseTo(3200 / 2133, 5);
    expect(justifiedRatio({ ...landscape, rotationDeg: 90 })).toBeCloseTo(
      2133 / 3200,
      5,
    );
    expect(justifiedRatio({ ...portrait, rotationDeg: 270 })).toBeCloseTo(
      3200 / 2133,
      5,
    );
    expect(justifiedRatio({ ...landscape, rotationDeg: 180 })).toBeCloseTo(
      3200 / 2133,
      5,
    );
  });

  test("falls back to 3:2 on missing, zero, negative or non-finite dims", () => {
    expect(justifiedRatio({})).toBe(JUSTIFIED_FALLBACK_RATIO);
    expect(justifiedRatio({ width: null, height: 2000 })).toBe(
      JUSTIFIED_FALLBACK_RATIO,
    );
    expect(justifiedRatio({ width: 0, height: 2000 })).toBe(
      JUSTIFIED_FALLBACK_RATIO,
    );
    expect(justifiedRatio({ width: 3000, height: -5 })).toBe(
      JUSTIFIED_FALLBACK_RATIO,
    );
    expect(justifiedRatio({ width: NaN, height: 2000 })).toBe(
      JUSTIFIED_FALLBACK_RATIO,
    );
  });

  test("clamps degenerate metadata ratios so one bad record cannot flatten a row", () => {
    expect(justifiedRatio({ width: 40000, height: 100 })).toBe(4);
    expect(justifiedRatio({ width: 100, height: 40000 })).toBe(0.3);
  });
});

describe("computeJustifiedRows", () => {
  test("preserves photo order 左→右・上→下 (indices stay sequential)", () => {
    const photos = Array.from({ length: 17 }, (_, i) =>
      i % 3 === 0 ? { ...portrait } : { ...landscape },
    );
    const rows = computeJustifiedRows(photos, OPTS);
    expect(flat(rows).map((it) => it.index)).toEqual(photos.map((_, i) => i));
  });

  test("justified rows are flush: uniform height, widths + gaps fill the container", () => {
    const photos = Array.from({ length: 12 }, (_, i) =>
      i % 2 === 0 ? { ...landscape } : { ...portrait },
    );
    const rows = computeJustifiedRows(photos, OPTS);
    const closed = rows.filter((r) => r.justified);
    expect(closed.length).toBeGreaterThan(0);
    for (const row of closed) {
      for (const it of row.items) {
        expect(it.width / it.ratio).toBeCloseTo(row.height, 3);
      }
      const total =
        row.items.reduce((s, it) => s + it.width, 0) +
        OPTS.gap * (row.items.length - 1);
      expect(total).toBeCloseTo(OPTS.containerWidth, 3);
    }
  });

  test("displaySize weights the row height: all-L rows render taller than all-M, all-S shorter", () => {
    const mk = (displaySize: string) =>
      Array.from({ length: 9 }, () => ({ ...landscape, displaySize }));
    const heightOfFirstClosed = (size: string) => {
      const rows = computeJustifiedRows(mk(size), OPTS);
      const closed = rows.find((r) => r.justified);
      expect(closed).toBeDefined();
      return closed!.height;
    };
    const hS = heightOfFirstClosed("S");
    const hM = heightOfFirstClosed("M");
    const hL = heightOfFirstClosed("L");
    expect(hL).toBeGreaterThan(hM);
    expect(hM).toBeGreaterThan(hS);
    // The hierarchy tracks the documented weights (rows pack greedily, so the
    // exact ratio differs, but L must stay visibly above M and S below it).
    expect(hL / hM).toBeGreaterThan(1.1);
    expect(hS / hM).toBeLessThan(0.95);
    expect(JUSTIFIED_SIZE_WEIGHT.L).toBeGreaterThan(JUSTIFIED_SIZE_WEIGHT.M);
  });

  test("photos with missing dimensions still pack into flush rows via the 3:2 fallback", () => {
    const photos = [
      { ...landscape },
      { width: null, height: null },
      { ...portrait },
      {},
      { ...landscape },
      { ...landscape },
    ];
    const rows = computeJustifiedRows(photos, OPTS);
    expect(flat(rows)).toHaveLength(photos.length);
    for (const row of rows.filter((r) => r.justified)) {
      for (const it of row.items) {
        expect(it.width / it.ratio).toBeCloseTo(row.height, 3);
      }
    }
  });

  test("the last row is not stretched to full width", () => {
    // 3 landscapes fill row 1; a lone trailing portrait must keep the target
    // height instead of blowing up to container width.
    const photos = [
      { ...landscape },
      { ...landscape },
      { ...landscape },
      { ...portrait },
    ];
    const rows = computeJustifiedRows(photos, OPTS);
    const last = rows[rows.length - 1];
    expect(last.items).toHaveLength(1);
    expect(last.height).toBeLessThanOrEqual(OPTS.baseRowHeight + 0.001);
    const lastWidth = last.items[0].width;
    expect(lastWidth).toBeLessThan(OPTS.containerWidth * 0.5);
  });

  test("a single very wide panorama gets its own row capped at target height", () => {
    const rows = computeJustifiedRows(
      [{ width: 8000, height: 2000 }, { ...landscape }, { ...landscape }],
      OPTS,
    );
    expect(rows[0].items).toHaveLength(1);
    expect(rows[0].height).toBeLessThanOrEqual(OPTS.baseRowHeight + 0.001);
    expect(rows[0].height).toBeCloseTo(OPTS.containerWidth / 4, 3);
  });

  test("mobile-ish narrow container still yields sane tile widths for portraits", () => {
    const photos = Array.from({ length: 6 }, () => ({ ...portrait }));
    const rows = computeJustifiedRows(photos, {
      containerWidth: 327,
      gap: 6,
      baseRowHeight: 200,
    });
    for (const row of rows) {
      for (const it of row.items) {
        expect(it.width).toBeGreaterThan(80);
      }
    }
  });

  test("regression: L is reliably bigger even when it arrives mid-row after several Ms", () => {
    // Bug found in review: with a shared max-weight target, an L landing
    // *after* a few M's had already consumed most of the row's width budget
    // (under the lower M target) could overshoot the new taller threshold and
    // close *smaller* than a plain M-only row — L's "bigger" cue depended on
    // scan position and sometimes vanished entirely. Two orderings of the
    // same photo set must not swing the L-row's height around.
    const build = (order: string[]) =>
      order.map((displaySize) => ({ ...landscape, displaySize }));
    const heightOfLRow = (photos: ReturnType<typeof build>) => {
      const rows = computeJustifiedRows(photos, OPTS);
      const row = rows.find((r) =>
        r.items.some((it) => photos[it.index].displaySize === "L"),
      );
      expect(row).toBeDefined();
      return row!.height;
    };
    const h1 = heightOfLRow(build(["M", "M", "M", "L"]));
    const h2 = heightOfLRow(build(["L", "M", "M", "M"]));
    // Same weight/ratio composition, different scan order — must land on the
    // same height (previously h1 could be *smaller* than a plain M row).
    expect(h1).toBeCloseTo(h2, 3);
  });

  test("regression: every L-containing row stays visibly taller than plain M rows across randomized mixes", () => {
    // Deterministic PRNG so the sweep is reproducible in CI.
    let seed = 42;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const mHeights: number[] = [];
    const lHeights: number[] = [];
    for (let t = 0; t < 60; t++) {
      const n = 15 + Math.floor(rnd() * 20);
      const photos = Array.from({ length: n }, () => {
        const r = rnd();
        const displaySize = r < 0.15 ? "S" : r < 0.3 ? "L" : "M";
        return { ...(rnd() < 0.4 ? portrait : landscape), displaySize };
      });
      const rows = computeJustifiedRows(photos, OPTS);
      for (const row of rows) {
        const sizes = row.items.map((it) => photos[it.index].displaySize);
        if (sizes.includes("L")) lHeights.push(row.height);
        else if (sizes.every((s) => s === "M")) mHeights.push(row.height);
      }
    }
    const avgM = mHeights.reduce((a, b) => a + b, 0) / mHeights.length;
    expect(lHeights.length).toBeGreaterThan(0);
    expect(mHeights.length).toBeGreaterThan(0);
    // Every single L-containing row must exceed the average M-only row —
    // not just on average, but with zero exceptions across the whole sweep.
    for (const h of lHeights) expect(h).toBeGreaterThan(avgM);
  });

  test("S immediately preceding a size-up transition gets its own smaller row instead of folding invisibly", () => {
    const photos = [
      { ...landscape, displaySize: "M" },
      { ...landscape, displaySize: "M" },
      { ...portrait, displaySize: "S" },
      { ...landscape, displaySize: "M" },
    ];
    const rows = computeJustifiedRows(photos, OPTS);
    const sRow = rows.find((r) =>
      r.items.some((it) => photos[it.index].displaySize === "S"),
    );
    expect(sRow).toBeDefined();
    // The S got a dedicated row at (approximately) its own target height,
    // not silently absorbed into a neighboring M-targeted row.
    expect(sRow!.height).toBeCloseTo(
      OPTS.baseRowHeight * JUSTIFIED_SIZE_WEIGHT.S,
      1,
    );
  });

  test("empty input and degenerate options do not throw", () => {
    expect(computeJustifiedRows([], OPTS)).toEqual([]);
    expect(
      computeJustifiedRows([{ ...landscape }], {
        containerWidth: 0,
        gap: -5,
        baseRowHeight: 0,
      }),
    ).toHaveLength(1);
  });
});
