import { test, expect } from "bun:test";
import {
  moveTopWorksId,
  parseTopWorksIds,
  serializeTopWorksIds,
  toggleTopWorksId,
} from "./top-works-ids";

test("空白・空・読めない値を落として順番を保つ", () => {
  expect(parseTopWorksIds(" 12, 7 ,,x, 3 ")).toEqual([12, 7, 3]);
  expect(parseTopWorksIds("")).toEqual([]);
  expect(parseTopWorksIds(null)).toEqual([]);
  expect(parseTopWorksIds(undefined)).toEqual([]);
});

test("重複は最初の1つだけ残す", () => {
  expect(parseTopWorksIds("5,9,5,9,2")).toEqual([5, 9, 2]);
});

test("選ぶと末尾に付き、もう一度押すと外れる", () => {
  expect(toggleTopWorksId([3, 1], 7)).toEqual([3, 1, 7]);
  expect(toggleTopWorksId([3, 1, 7], 1)).toEqual([3, 7]);
});

test("1枚だけ前後へ動かす", () => {
  const ids = [10, 20, 30, 40];
  expect(moveTopWorksId(ids, 3, 1)).toEqual([10, 40, 20, 30]);
  expect(moveTopWorksId(ids, 0, 3)).toEqual([20, 30, 40, 10]);
  // 元の配列は変えない（Undo が効かなくなる）。
  expect(ids).toEqual([10, 20, 30, 40]);
});

test("端の外へは動かさない", () => {
  const ids = [10, 20, 30];
  expect(moveTopWorksId(ids, 0, -1)).toEqual([10, 20, 30]);
  expect(moveTopWorksId(ids, 2, 3)).toEqual([10, 20, 30]);
  expect(moveTopWorksId(ids, 1, 1)).toEqual([10, 20, 30]);
});

test("書き戻した文字列は、読み直すと同じ並びになる", () => {
  const ids = parseTopWorksIds("12, 7, 3");
  expect(serializeTopWorksIds(ids)).toBe("12,7,3");
  expect(parseTopWorksIds(serializeTopWorksIds(ids))).toEqual(ids);
  expect(serializeTopWorksIds([])).toBe("");
});
