import { describe, expect, test } from "bun:test";
import { shelfNeedsCount, shouldShowShelf } from "./shelf-nav";

describe("棚をナビに出すか", () => {
  test("on は中身が無くても出す（これから入れる人のため）", () => {
    expect(shouldShowShelf("on", 0)).toBe(true);
  });

  test("off は中身があっても出さない", () => {
    expect(shouldShowShelf("off", 5)).toBe(false);
  });

  test("自動は、1本でもあれば出す", () => {
    expect(shouldShowShelf("auto", 1)).toBe(true);
    expect(shouldShowShelf(undefined, 3)).toBe(true);
  });

  test("**自動で空なら出さない。**押した先が空っぽの棚を見せない", () => {
    expect(shouldShowShelf("auto", 0)).toBe(false);
    expect(shouldShowShelf(undefined, 0)).toBe(false);
    expect(shouldShowShelf(null, 0)).toBe(false);
    expect(shouldShowShelf("よく分からない値", 0)).toBe(false);
  });

  test("数を取りに行くのは自動のときだけ", () => {
    expect(shelfNeedsCount("auto")).toBe(true);
    expect(shelfNeedsCount(undefined)).toBe(true);
    expect(shelfNeedsCount("on")).toBe(false);
    expect(shelfNeedsCount("off")).toBe(false);
  });
});
