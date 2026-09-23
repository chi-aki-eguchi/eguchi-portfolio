import { describe, expect, test } from "bun:test";
import { applyWorkOrder, idsBetween, moveItem, moveManyTo, moveWithinWork } from "./work-order";

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

describe("まとめて移す・範囲選択", () => {
  test("選んだ写真を元の順のまま、指定の位置へまとめて入れる", () => {
    const work = [1, 2, 3, 4, 5, 6];
    expect(moveManyTo(work, [5, 2], 0)).toEqual([2, 5, 1, 3, 4, 6]);
    expect(moveManyTo(work, [1], 5)).toEqual([2, 3, 4, 5, 6, 1]);
    expect(moveManyTo(work, [1], 99)).toEqual([2, 3, 4, 5, 6, 1]);
    expect(moveManyTo(work, [], 2)).toEqual(work);
  });
  test("範囲はどちら向きでも両端を含む", () => {
    expect(idsBetween([10, 11, 12, 13], 13, 11)).toEqual([11, 12, 13]);
    expect(idsBetween([10, 11], 99, 11)).toEqual([11]);
  });
});
