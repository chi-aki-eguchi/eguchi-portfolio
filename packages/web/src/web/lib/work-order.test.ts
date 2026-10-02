import { describe, expect, test } from "bun:test";
import { applyWorkOrder, idsBetween, moveItem, moveManyTo, moveWithinWork, moveTargetIndex } from "./work-order";

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

describe("先頭へ・1つ前へ・1つ後へ・最後へ", () => {
  const ids = [1, 2, 3, 4, 5];
  const moved = (moving: number[], where: Parameters<typeof moveTargetIndex>[2]) => {
    const at = moveTargetIndex(ids, moving, where);
    return at == null ? null : moveManyTo(ids, moving, at);
  };
  test("1枚を動かす", () => {
    expect(moved([3], "first")).toEqual([3, 1, 2, 4, 5]);
    expect(moved([3], "prev")).toEqual([1, 3, 2, 4, 5]);
    expect(moved([3], "next")).toEqual([1, 2, 4, 3, 5]);
    expect(moved([3], "last")).toEqual([1, 2, 4, 5, 3]);
  });
  test("もう端にあるときは動かさない（ボタンを押せなくする）", () => {
    expect(moved([1], "first")).toBeNull();
    expect(moved([1], "prev")).toBeNull();
    expect(moved([5], "next")).toBeNull();
    expect(moved([5], "last")).toBeNull();
  });
  test("複数はひとまとまりで動かす（元の順を保つ）", () => {
    expect(moved([2, 4], "first")).toEqual([2, 4, 1, 3, 5]);
    expect(moved([2, 3], "next")).toEqual([1, 4, 2, 3, 5]);
    expect(moved([4, 5], "prev")).toEqual([1, 2, 4, 5, 3]);
    // 離れていた2枚は、まずひとまとまりに寄る
    expect(moved([1, 3], "prev")).toEqual([1, 3, 2, 4, 5]);
  });
  test("並びに無い写真は動かさない", () => {
    expect(moveTargetIndex(ids, [9], "first")).toBeNull();
  });
});
