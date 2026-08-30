import { describe, expect, test } from "bun:test";
import { isShelfKind, normalizeShelfKind } from "./shelf";

describe("棚の読み方", () => {
  test("**空・null・知らない値はシリーズ。**列を足す前に作られた行が消えない", () => {
    for (const v of [undefined, null, "", "SERIES", "しごと", 0, {}, []])
      expect(normalizeShelfKind(v)).toBe("series");
  });

  test("work だけが Work", () => {
    expect(normalizeShelfKind("work")).toBe("work");
    expect(normalizeShelfKind("series")).toBe("series");
  });

  test("入力として受け付けるのは2つだけ（それ以外は断る側で使う）", () => {
    expect(isShelfKind("work")).toBe(true);
    expect(isShelfKind("series")).toBe(true);
    for (const v of ["Work", "", null, undefined, 1]) expect(isShelfKind(v)).toBe(false);
  });
});
