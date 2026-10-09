import { describe, expect, test } from "bun:test";
import {
  developListPhotos,
  isDevelopDesignValue,
  isDevelopOnlyPath,
} from "./develop-structure";

describe("新しい構成（develop）の決まり", () => {
  test("保存された値が develop のときだけ新しい構成", () => {
    expect(isDevelopDesignValue("develop")).toBe(true);
    for (const v of ["classic", "book", "", null, undefined]) expect(isDevelopDesignValue(v)).toBe(false);
  });

  test("増える住所は Portrait・Life・Info の3つだけ", () => {
    for (const p of ["/portrait", "/life", "/info"]) expect(isDevelopOnlyPath(p)).toBe(true);
    for (const p of ["/", "/gallery", "/series", "/work", "/about", "/contact", "/en/contact", "/portrait/1"])
      expect(isDevelopOnlyPath(p)).toBe(false);
  });

  test("Portrait は分類 portrait、Life はそれ以外の分類。分類なしはどちらにも出さず、順番は保つ", () => {
    const photos = [
      { id: 1, category: "life" },
      { id: 2, category: "portrait" },
      { id: 3, category: "" },
      { id: 4, category: "nature" },
      { id: 5, category: null },
      { id: 6, category: " portrait " },
      { id: 7 },
    ];
    expect(developListPhotos("portrait", photos).map((p) => p.id)).toEqual([2, 6]);
    expect(developListPhotos("life", photos).map((p) => p.id)).toEqual([1, 4]);
  });
});
