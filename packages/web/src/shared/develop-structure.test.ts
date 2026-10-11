import { describe, expect, test } from "bun:test";
import {
  developListPhotos,
  isDevelopDesignValue,
  isDevelopOnlyPath,
  parsePhotoIdList,
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

  test("選んだ写真があれば、分類に関係なく、選んだ順で出す", () => {
    const photos = [
      { id: 1, category: "life" },
      { id: 2, category: "portrait" },
      { id: 3, category: "" },
      { id: 4, category: "nature" },
    ];
    expect(developListPhotos("portrait", photos, "3, 1").map((p) => p.id)).toEqual([3, 1]);
    // 消した・非公開にした写真のIDは飛ばす。同じIDは1度だけ。
    expect(developListPhotos("life", photos, "4,99,4,2").map((p) => p.id)).toEqual([4, 2]);
    // 何も選んでいない・選んだ写真が1枚も残っていないときは、分類から出す（ページを空にしない）。
    expect(developListPhotos("portrait", photos, "").map((p) => p.id)).toEqual([2]);
    expect(developListPhotos("portrait", photos, null).map((p) => p.id)).toEqual([2]);
    expect(developListPhotos("portrait", photos, "98,99").map((p) => p.id)).toEqual([2]);
  });

  test("IDの並びの読み方", () => {
    expect(parsePhotoIdList("12, 7,12 ,x")).toEqual([12, 7]);
    expect(parsePhotoIdList("")).toEqual([]);
    expect(parsePhotoIdList(undefined)).toEqual([]);
  });
});
