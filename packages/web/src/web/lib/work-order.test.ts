import { describe, expect, test } from "bun:test";
import { applyWorkOrder, moveItem, moveWithinWork } from "./work-order";

describe("作品の中の順番（作業台）", () => {
  test("ほかの作品の写真の位置は動かさない", () => {
    // 全体: 1 2 [A] 3 [B] [C] 4 — 作品 = A B C
    const global = [1, 2, 10, 3, 11, 12, 4];
    expect(moveWithinWork(global, [10, 11, 12], 0, 2)).toEqual([1, 2, 11, 3, 12, 10, 4]);
  });
  test("同じ位置・範囲外は元のまま", () => {
    expect(moveItem([1, 2, 3], 1, 1)).toEqual([1, 2, 3]);
    expect(moveItem([1, 2, 3], 5, 0)).toEqual([1, 2, 3]);
    expect(applyWorkOrder([5, 6, 7], [7, 5])).toEqual([7, 6, 5]);
  });
});
