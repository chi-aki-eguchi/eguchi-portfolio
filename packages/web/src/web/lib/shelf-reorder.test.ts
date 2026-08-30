import { describe, expect, test } from "bun:test";
import { reorderWithinShelf, shelfOf } from "./shelf-reorder";

const rows = [
  { id: 1, kind: "series" },
  { id: 2, kind: "work" },
  { id: 3, kind: "series" },
  { id: 4, kind: "work" },
  { id: 5, kind: null }, // 列を足す前に作られた行
];

describe("棚の中だけで並べ替える", () => {
  test("空・未知の kind はシリーズとして読む", () => {
    expect(shelfOf({ id: 1 })).toBe("series");
    expect(shelfOf({ id: 1, kind: null })).toBe("series");
    expect(shelfOf({ id: 1, kind: "なにか" })).toBe("series");
    expect(shelfOf({ id: 1, kind: "work" })).toBe("work");
  });

  test("**もう片方の棚の行は、全体の中の位置を動かさない**", () => {
    // シリーズは [1,3,5]。1 を1つ下へ → [3,1,5]。
    // work の 2 と 4 は、元の位置（index 1 と 3）に残る。
    expect(reorderWithinShelf(rows, 1, 1, "series")).toEqual([3, 2, 1, 4, 5]);
  });

  test("Work を動かしても、シリーズの並びは変わらない", () => {
    // work は [2,4]。2 を1つ下へ → [4,2]。index 1 と 3 に書き戻す。
    expect(reorderWithinShelf(rows, 2, 1, "work")).toEqual([1, 4, 3, 2, 5]);
  });

  test("端では動かさない（null を返す）", () => {
    expect(reorderWithinShelf(rows, 1, -1, "series")).toBeNull();
    expect(reorderWithinShelf(rows, 5, 1, "series")).toBeNull();
    expect(reorderWithinShelf(rows, 4, 1, "work")).toBeNull();
  });

  test("その棚に居ない id は動かさない", () => {
    expect(reorderWithinShelf(rows, 2, 1, "series")).toBeNull();
    expect(reorderWithinShelf(rows, 99, 1, "series")).toBeNull();
  });

  test("**返す並びは、元の全件の組み替えである**（増えも減りもしない）", () => {
    const out = reorderWithinShelf(rows, 3, -1, "series")!;
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(out.length).toBe(rows.length);
  });
});
