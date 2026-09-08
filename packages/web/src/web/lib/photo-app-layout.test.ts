import { describe, expect, test } from "bun:test";
import {
  type PhotoAppRow,
  buildPhotoAppRows,
  photoAppArrowIndex,
  visiblePhotoAppRows,
} from "./photo-app-layout";

const LANDSCAPE = { width: 3200, height: 2133 };
const PORTRAIT = { width: 1200, height: 3200 };
const WIDE = { width: 4000, height: 1000 };
const SQUARE = { width: 1000, height: 1000 };

const photoForIndex = (index: number) => {
  if (index % 4 === 0) return LANDSCAPE;
  if (index % 4 === 1) return PORTRAIT;
  if (index % 4 === 2) return WIDE;
  return SQUARE;
};

describe("buildPhotoAppRows", () => {
  test("builds fixed columns, fills full rows exactly, and keeps source order", () => {
    const photos = [
      LANDSCAPE,
      PORTRAIT,
      WIDE,
      SQUARE,
      LANDSCAPE,
      PORTRAIT,
      WIDE,
      SQUARE,
    ];

    for (const scenario of [
      { width: 900, columns: 3, gap: 4 },
      { width: 1024, columns: 4, gap: 5 },
      { width: 1280, columns: 2, gap: 3 },
    ] as const) {
      const rows = buildPhotoAppRows(
        photos,
        scenario.width,
        scenario.columns,
        scenario.gap,
      );
      const expectedLength = Math.ceil(photos.length / scenario.columns);
      expect(rows).toHaveLength(expectedLength);
      expect(rows.flatMap((row) => row.items.map((item) => item.index))).toEqual([
        0, 1, 2, 3, 4, 5, 6, 7,
      ]);

      for (const row of rows) {
        const total = row.items.reduce((sum, item) => sum + item.width, 0);
        const widthWithGaps = total + scenario.gap * (row.items.length - 1);
        if (row.items.length === scenario.columns) {
          expect(widthWithGaps).toBeCloseTo(scenario.width, 6);
        } else {
          expect(widthWithGaps).toBeLessThanOrEqual(scenario.width);
        }

        if (row.items.length === scenario.columns) {
          for (let i = 0; i < row.items.length; i += 1) {
            const photo = photos[row.start + i];
            const expectedWidth = (photo.width / photo.height) * row.height;
            expect(row.items[i]!.width).toBeCloseTo(expectedWidth, 6);
          }
        }
      }
    }
  });

  test("keeps the final partial row from over-expanding while keeping natural ratios", () => {
    const rows = buildPhotoAppRows(
      [WIDE, WIDE, WIDE, PORTRAIT],
      900,
      3,
      0,
    );
    const first = rows[0]!;
    const last = rows[1]!;

    expect(rows).toHaveLength(2);
    expect(last.items).toHaveLength(1);
    expect(last.height).toBeGreaterThan(first.height);
    expect(last.items[0]!.width).toBeCloseTo(900 / 3, 6);
    expect(last.items[0]!.width / last.height).toBeCloseTo(
      PORTRAIT.width / PORTRAIT.height,
      6,
    );
  });

  test("clamps columns safely and ignores invalid container sizes", () => {
    const photos = [LANDSCAPE, LANDSCAPE, LANDSCAPE];
    expect(buildPhotoAppRows(photos, 0, 3)).toEqual([]);
    expect(buildPhotoAppRows(photos, 1000, 1)).toHaveLength(2);
    expect(buildPhotoAppRows(photos, 1000, 20)).toHaveLength(1);
  });

  test("retains rotation-aware ratios from invalid or missing dimensions", () => {
    const rows = buildPhotoAppRows(
      [{ width: 0, height: 200 }, {}, { ...PORTRAIT, rotationDeg: 90 }, LANDSCAPE],
      900,
      2,
      8,
    );
    expect(rows.flatMap((row) => row.items.map((item) => item.index))).toEqual([0, 1, 2, 3]);
    expect(rows[0]!.items[0]!.index).toBe(0);
    expect(rows[1]!.items[1]!.index).toBe(3);
  });

  test("supports deterministic mixed-ratio sweeps across multiple widths/columns", () => {
    const photos = Array.from({ length: 120 }, (_, index) => photoForIndex(index));
    const scenarios = [
      { width: 720, columns: 2, gap: 6 },
      { width: 960, columns: 4, gap: 4 },
      { width: 1230, columns: 5, gap: 7 },
    ] as const;

    for (const { width, columns, gap } of scenarios) {
      const rows = buildPhotoAppRows(photos, width, columns, gap);
      expect(rows[rows.length - 1]!.end - 1).toBe(photos.length - 1);

      for (const row of rows) {
        const total = row.items.reduce((sum, item) => sum + item.width, 0);
        const widthWithGaps = total + gap * (row.items.length - 1);
        if (row.items.length === columns) {
          expect(widthWithGaps).toBeCloseTo(width, 6);
        } else {
          expect(widthWithGaps).toBeLessThanOrEqual(width);
        }
      }
    }
  });
});

describe("visiblePhotoAppRows", () => {
  const photos = Array.from({ length: 300 }, (_, index) => photoForIndex(index));

  test("returns intersecting rows for scroll bounds with overscan", () => {
    const rows = buildPhotoAppRows(photos, 960, 4, 4);
    const middle = rows[24]!;
    const visible = visiblePhotoAppRows(rows, middle.top + 10, 240, 80);
    const lower = middle.top + 10 - 80;
    const upper = middle.top + 10 + 240 + 80;

    const expectedStart = rows.findIndex((row) => row.top + row.height > lower);
    let expectedEnd = rows.findIndex((row) => row.top > upper);
    if (expectedEnd === -1) expectedEnd = rows.length;

    expect(visible.start).toBe(expectedStart);
    expect(visible.end).toBe(expectedEnd);
  });

  test("handles non-finite bounds safely", () => {
    const rows = buildPhotoAppRows(photos, 960, 4, 4);
    expect(visiblePhotoAppRows(rows, Number.NaN, 240, 80)).toEqual(
      visiblePhotoAppRows(rows, 0, 240, 80),
    );
    expect(visiblePhotoAppRows(rows, Number.POSITIVE_INFINITY, 240, 80)).toEqual(
      visiblePhotoAppRows(rows, 0, 240, 80),
    );
    expect(visiblePhotoAppRows(rows, -Infinity, 240, 80)).toEqual(
      visiblePhotoAppRows(rows, 0, 240, 80),
    );
    expect(visiblePhotoAppRows(rows, 200, Number.POSITIVE_INFINITY, 80)).toEqual(
      visiblePhotoAppRows(rows, 200, 0, 80),
    );
  });

  test("handles zero viewport height with zero overscan", () => {
    const rows = buildPhotoAppRows(photos, 960, 4, 4);
    const scrollTop = 100;
    const visible = visiblePhotoAppRows(rows, scrollTop, 0, 0);
    const expectedStart = rows.findIndex((row) => row.top + row.height > scrollTop);
    let expectedEnd = rows.findIndex((row) => row.top > scrollTop);
    if (expectedEnd === -1) expectedEnd = rows.length;
    expect(visible.start).toBe(expectedStart);
    expect(visible.end).toBe(expectedEnd);
  });
});

describe("photoAppArrowIndex", () => {
  const rows: PhotoAppRow[] = [
    {
      start: 0,
      end: 3,
      top: 0,
      height: 100,
      items: [
        { index: 0, left: 0, width: 70 },
        { index: 1, left: 80, width: 120 },
        { index: 2, left: 210, width: 60 },
      ],
    },
    {
      start: 3,
      end: 6,
      top: 110,
      height: 100,
      items: [
        { index: 3, left: 0, width: 80 },
        { index: 4, left: 90, width: 70 },
        { index: 5, left: 170, width: 100 },
      ],
    },
    {
      start: 6,
      end: 9,
      top: 220,
      height: 100,
      items: [
        { index: 6, left: 0, width: 100 },
        { index: 7, left: 110, width: 70 },
        { index: 8, left: 190, width: 90 },
      ],
    },
  ];

  test("moves left and right within collection bounds", () => {
    expect(photoAppArrowIndex(rows, 0, "left")).toBe(0);
    expect(photoAppArrowIndex(rows, 8, "right")).toBe(8);
    expect(photoAppArrowIndex(rows, 4, "left")).toBe(3);
    expect(photoAppArrowIndex(rows, 4, "right")).toBe(5);
  });

  test("moves up/down to nearest center in the adjacent row", () => {
    expect(photoAppArrowIndex(rows, 4, "up")).toBe(1);
    expect(photoAppArrowIndex(rows, 4, "down")).toBe(7);
  });

  test("clamps when target row does not exist", () => {
    expect(photoAppArrowIndex(rows, 1, "up")).toBe(1);
    expect(photoAppArrowIndex(rows, 7, "down")).toBe(7);
  });

  test("clamps current index to existing collection", () => {
    expect(photoAppArrowIndex(rows, 999, "left")).toBe(7);
  });
});
