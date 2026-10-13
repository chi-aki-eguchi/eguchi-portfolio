import { describe, expect, test } from "bun:test";
import { planRows, rowOptionsFor, showcaseOptionsFor, stackGap, leadCount } from "./photo-rows";

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
    // 終わりの2段（足りない写真で組み直す段）以外は同じ。
    for (let r = 0; r < head.rows.length - 2; r++) expect(all.rows[r]).toEqual(head.rows[r]!);
  });

  // 「どの写真がどこにあっても成り立つ」: 縦・横・正方形・パノラマ・極端に細長い写真を
  // 乱数で並べ替えた 400 通りで、途中の段は全部横幅いっぱいにそろい、画面より高い段も、
  // 低すぎる段も無い。最後の段だけは、どうしても収まらないとき真ん中に置く。
  test("どんな並びでも、全部の段が横幅いっぱいにそろう", () => {
    const shapes = [0.667, 0.8, 1, 1.25, 1.5, 1.78, 2.4, 3.2, 0.45];
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const opts of [desktop, phone, rowOptionsFor(900, 1100)]) {
      for (let trial = 0; trial < 400; trial++) {
        const n = 2 + Math.floor(rand() * 40);
        const ratios = Array.from({ length: n }, () => shapes[Math.floor(rand() * shapes.length)]!);
        const plan = planRows(ratios, opts);
        const lowest = Math.min(...opts.targets) * 0.28;
        for (const row of plan.rows) {
          const last = row.items[row.items.length - 1]!;
          const label = `${opts.width}px ${ratios.map((r) => r.toFixed(2)).join(",")}`;
          if (!row.full) {
            // 横幅いっぱいにできないのは、最後の段で、どう組み直しても画面より高く
            // なる極端に細長い写真が残ったときだけ。そのときは真ん中に置く。
            expect({ label, last: row === plan.rows[plan.rows.length - 1] }).toEqual({ label, last: true });
            const first = row.items[0]!;
            expect(Math.abs(first.x - (opts.width - (last.x + last.width)))).toBeLessThan(0.5);
            continue;
          }
          expect(Math.abs(last.x + last.width - opts.width)).toBeLessThan(0.5);
          expect(row.height).toBeLessThanOrEqual(opts.maxHeight + 0.01);
          expect(row.height).toBeGreaterThan(lowest);
        }
      }
    }
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

  // 表紙の段（オーナー 2026-09-26「TOP の謎の余白」: 縦の写真1枚だと左半分が空いていた）。
  test("表紙の段は、どの写真が先頭に来ても横幅いっぱいで、画面の残りを超えない", () => {
    const shapes = [0.667, 0.8, 1, 1.5, 1.78, 2.4, 3.2, 0.45];
    let seed = 11;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const [w, vh, maxCount] of [[1390, 956, 4], [1209, 800, 4], [358, 844, 2]] as const) {
      const lead = { height: vh - 220, maxCount };
      for (let trial = 0; trial < 400; trial++) {
        const n = 1 + Math.floor(rand() * 20);
        const ratios = Array.from({ length: n }, () => shapes[Math.floor(rand() * shapes.length)]!);
        const plan = planRows(ratios, { ...rowOptionsFor(w, vh), lead });
        const first = plan.rows[0]!;
        const last = first.items[first.items.length - 1]!;
        expect(first.height).toBeLessThanOrEqual(lead.height + 0.01);
        if (first.full) expect(Math.abs(last.x + last.width - w)).toBeLessThan(0.5);
        else {
          // 横いっぱいにできないのは、どの枚数でも高すぎるとき（縦の写真しか無いなど）だけ。
          const k = leadCount(ratios, w, rowOptionsFor(w, vh).gap, lead);
          expect(k).toBe(first.items.length);
          expect(Math.abs(first.items[0]!.x - (w - (last.x + last.width)))).toBeLessThan(0.5);
        }
        // すべての写真が1度ずつ、元の比のまま
        const idx = plan.rows.flatMap((r) => r.items.map((it) => it.index));
        expect(idx).toEqual(ratios.map((_, i) => i));
      }
    }
  });

  test("表紙の段: 縦の写真のあとに写真が続けば、足して横幅を埋める", () => {
    const opts = { ...rowOptionsFor(1390, 956), lead: { height: 736, maxCount: 4 } };
    const plan = planRows([0.667, 1.5, 0.8, 1.5, 1.5], opts);
    expect(plan.rows[0]!.full).toBe(true);
    expect(plan.rows[0]!.items.length).toBeGreaterThan(1);
    expect(plan.rows[0]!.height).toBeGreaterThan(736 * 0.6);
  });
});

describe("選んだ写真を見せるページの段（showcase）", () => {
  const L = 1.5; // 横の写真
  const V = 2 / 3; // 縦の写真
  const mixed = [L, V, V, L, V, L, L, V, V, V, L, V, L, V, L, L];

  test("スマホ：どの段も画面の幅いっぱい。横の写真は1枚、縦の写真は1枚か2枚。3枚は並べない", () => {
    for (const width of [360, 375, 390, 430]) {
      const opts = showcaseOptionsFor(width, 844);
      const plan = planRows(mixed, opts);
      expect(plan.rows.flatMap((r) => r.items).length).toBe(mixed.length);
      for (const row of plan.rows) {
        expect(row.items.length).toBeLessThanOrEqual(2);
        const last = row.items[row.items.length - 1]!;
        // 段の右端が幅にそろう（左右に空きが無い）。
        expect(Math.abs(last.x + last.width - width)).toBeLessThan(1);
        expect(row.items[0]!.x).toBe(0);
        // 横の写真は、ほかの写真と並べて小さくしない。
        if (row.items.some((it) => mixed[it.index] === L)) expect(row.items.length).toBe(1);
      }
      // 段の間は、写真どうしの間と同じ 6px。
      for (let i = 1; i < plan.rows.length; i++) {
        const prev = plan.rows[i - 1]!;
        expect(Math.round(plan.rows[i]!.top - (prev.top + prev.height))).toBe(6);
      }
    }
  });

  test("スマホ：縦の写真だけなら「1枚で大きく」と「2枚並び」が交互（4:5 でも 2:3 でも）", () => {
    for (const ratio of [4 / 5, 2 / 3]) {
      const plan = planRows(Array.from({ length: 12 }, () => ratio), showcaseOptionsFor(390, 664));
      expect(plan.rows.map((r) => r.items.length)).toEqual([1, 2, 1, 2, 1, 2, 1, 2]);
    }
  });

  test("スマホ：並びは画面の高さで変わらない（実機は 664px、検査用は 844px。アドレスバーの出入りでも同じ）", () => {
    const shape = (vh: number) =>
      planRows(mixed, showcaseOptionsFor(390, vh)).rows.map((r) => `${r.items.length}:${Math.round(r.height)}`);
    expect(shape(664)).toEqual(shape(844));
    expect(shape(548)).toEqual(shape(844));
  });

  test("スマホ：縦と横の写真を並べた低い段を、終わりの組み直しでも作らない", () => {
    for (let n = 1; n <= 9; n++) {
      const plan = planRows(mixed.slice(0, n), showcaseOptionsFor(390, 664));
      for (const row of plan.rows) {
        if (row.items.length > 1) expect(row.height).toBeGreaterThanOrEqual(390 * 0.56);
      }
    }
  });

  test("スマホ：縦に細長い写真（9:16）も、横の写真と並べず、1枚で幅いっぱいに出す", () => {
    const tall = 9 / 16;
    for (const ratios of [[tall, L, tall, L], [L, tall, L], [tall], [V, tall, L, L, tall, 2.35]]) {
      const plan = planRows(ratios, showcaseOptionsFor(390, 664));
      for (const row of plan.rows) {
        expect(row.full).toBe(true);
        const last = row.items[row.items.length - 1]!;
        expect(Math.abs(last.x + last.width - 390)).toBeLessThan(1);
        if (row.items.length > 1) expect(row.height).toBeGreaterThanOrEqual(390 * 0.56);
      }
    }
  });

  test("広い画面：どの段も幅いっぱいで、1段は4枚まで。画面より高い段を作らない", () => {
    for (const [width, vh] of [[1216, 900], [1000, 800], [1680, 1050]] as const) {
      const opts = showcaseOptionsFor(width, vh);
      const plan = planRows(mixed, opts);
      for (const row of plan.rows) {
        expect(row.items.length).toBeLessThanOrEqual(opts.maxPerRow + 1);
        const last = row.items[row.items.length - 1]!;
        expect(Math.abs(last.x + last.width - width)).toBeLessThan(1);
        expect(row.height).toBeLessThanOrEqual(opts.maxHeight + 0.5);
      }
    }
  });

  test("一覧（Gallery）の段より大きく見せる：同じ写真なら段の数が多い", () => {
    const showcase = planRows(mixed, showcaseOptionsFor(1216, 900));
    const wall = planRows(mixed, rowOptionsFor(1216, 900));
    expect(showcase.rows.length).toBeGreaterThanOrEqual(wall.rows.length);
  });

  test("写真の間は「写真の間隔」の設定に従う（倍率 0.6 は、設定に結ぶ前の固定値と同じ）", () => {
    expect(showcaseOptionsFor(390, 664).gap).toBe(6);
    expect(showcaseOptionsFor(390, 664, 0.6).gap).toBe(6);
    expect(showcaseOptionsFor(800, 1000, 0.6).gap).toBe(8);
    expect(showcaseOptionsFor(1216, 900, 0.6).gap).toBe(12);
    // 広げる・詰める
    expect(showcaseOptionsFor(390, 664, 1).gap).toBe(10);
    expect(showcaseOptionsFor(1216, 900, 1).gap).toBe(20);
    expect(showcaseOptionsFor(390, 664, 0).gap).toBe(2);
    expect(showcaseOptionsFor(1216, 900, 0).gap).toBe(2);
    expect(stackGap(0.6)).toBe(6);
    expect(stackGap(Number.NaN)).toBe(6);
    // 間を変えても、どの段も幅いっぱいのまま。
    for (const scale of [0, 0.6, 1.5]) {
      const opts = showcaseOptionsFor(390, 664, scale);
      for (const row of planRows(mixed, opts).rows) {
        const last = row.items[row.items.length - 1]!;
        expect(Math.abs(last.x + last.width - 390)).toBeLessThan(1);
      }
    }
  });
});
