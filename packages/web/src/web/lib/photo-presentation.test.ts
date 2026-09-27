import { describe, expect, test } from "bun:test";
import { planSelection, planContactSheet } from "./photo-presentation";

describe("写真の見せ方", () => {
  for (const width of [280, 375, 768, 1440]) {
    test(`${width}pxでも順番・比・領域を保つ`, () => {
      const ratios = [0.2, 1.5, 0.75, 4, 1, 2, 0.5];
      for (const plan of [planSelection(ratios, width, 812, 220), planContactSheet(ratios, width)]) {
        expect(plan.rows.flatMap((row) => row.items.map((item) => item.index))).toEqual(ratios.map((_, i) => i));
        for (const row of plan.rows) for (const item of row.items) {
          expect(item.width / row.height).toBeCloseTo(ratios[item.index]!, 6);
          expect(item.x).toBeGreaterThanOrEqual(0);
          expect(item.x + item.width).toBeLessThanOrEqual(width + 0.001);
          expect(row.top + row.height).toBeLessThanOrEqual(plan.height + 0.001);
        }
      }
    });
  }
  test("空の選択も描ける", () => {
    expect(planSelection([], 375, 812, 220)).toEqual({ rows: [], height: 0 });
    expect(planContactSheet([], 375)).toEqual({ rows: [], height: 0 });
  });
});
