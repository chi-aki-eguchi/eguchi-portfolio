import { describe, expect, test } from "bun:test";
import { planRows, rowOptionsFor } from "./photo-rows";

// 縦(0.667)・横(1.5)・正方形・パノラマを混ぜた、現実に近い並び。
const mix = [1.5, 0.667, 1.5, 1.5, 0.667, 0.667, 1, 1.5, 2.4, 0.8, 1.5, 0.667, 1.5, 1.33, 0.667, 1.5, 1.5, 0.75, 1.5, 0.667];

describe("段の組み方", () => {
  const desktop = rowOptionsFor(1376, 900);
  const phone = rowOptionsFor(358, 844);

  for (const [name, opts] of [["PC", desktop], ["スマホ", phone]] as const) {
    test(`${name}: どの写真も1度だけ、元の縦横比のまま並ぶ`, () => {
      const plan = planRows(mix, opts);
      const indices = plan.rows.flatMap((r) => r.items.map((it) => it.index));
      expect(indices).toEqual(mix.map((_, i) => i));
      for (const row of plan.rows)
        for (const it of row.items)
          expect(Math.abs(it.width / row.height - mix[it.index]!) / mix[it.index]!).toBeLessThan(0.01);
    });

    test(`${name}: 横幅いっぱいの段は右端がそろい、画面より高い段は無い`, () => {
      const plan = planRows(mix, opts);
      for (const row of plan.rows) {
        expect(row.height).toBeLessThanOrEqual(opts.maxHeight + 0.01);
        const last = row.items[row.items.length - 1]!;
        if (row.full) expect(Math.abs(last.x + last.width - opts.width)).toBeLessThan(0.5);
        else expect(last.x + last.width).toBeLessThanOrEqual(opts.width + 0.5);
      }
    });
  }

  test("写真を後ろへ読み足しても、それまでの段は動かない", () => {
    const head = planRows(mix.slice(0, 12), desktop);
    const all = planRows(mix, desktop);
    // 最後の段（足りない写真で組んだ段）以外は同じ。
    for (let r = 0; r < head.rows.length - 1; r++) expect(all.rows[r]).toEqual(head.rows[r]!);
  });

  test("大きな段と小さな段が交互に来る（同じ高さの段が続く一覧にしない）", () => {
    const plan = planRows(mix, desktop);
    const heights = plan.rows.map((r) => r.height);
    expect(Math.max(...heights) / Math.min(...heights)).toBeGreaterThan(1.6);
  });

  test("スマホでは縦の写真を1枚で大きく見せる", () => {
    const plan = planRows([0.667, 1.5, 1.5, 0.667], phone);
    expect(plan.rows[0]!.items).toHaveLength(1);
    expect(plan.rows[0]!.height).toBeGreaterThan(358);
  });

  test("最後に1枚だけ残っても巨大にしない", () => {
    const plan = planRows([1.5, 1.5, 1.5, 0.667], desktop);
    const last = plan.rows[plan.rows.length - 1]!;
    expect(last.height).toBeLessThanOrEqual(desktop.maxHeight);
  });
});
