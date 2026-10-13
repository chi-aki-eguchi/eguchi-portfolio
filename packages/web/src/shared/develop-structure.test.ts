import { describe, expect, test } from "bun:test";
import {
  developListPhotos,
  isDevelopDesignValue,
  isDevelopOnlyPath,
  parsePhotoIdList,
  DEVELOP_DOOR_DEFAULTS,
  developDoorCopy,
  serializeDevelopDoors,
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

describe("扉の名前と添え書き", () => {
  test("設定が無い・壊れているときは、初めの値", () => {
    expect(developDoorCopy(undefined)).toEqual(DEVELOP_DOOR_DEFAULTS);
    expect(developDoorCopy("")).toEqual(DEVELOP_DOOR_DEFAULTS);
    expect(developDoorCopy("{こわれた")).toEqual(DEVELOP_DOOR_DEFAULTS);
    expect(developDoorCopy("[1,2]")).toEqual(DEVELOP_DOOR_DEFAULTS);
    expect(developDoorCopy('{"portrait":"文字だけ"}')).toEqual(DEVELOP_DOOR_DEFAULTS);
    // 読んだ結果を書き換えても、初めの値は変わらない。
    developDoorCopy("").portrait.label = "x";
    expect(DEVELOP_DOOR_DEFAULTS.portrait.label).toBe("Portrait");
  });

  test("変えた扉だけが変わり、ほかは初めの値のまま", () => {
    const copy = developDoorCopy('{"portrait":["人","ポートレート撮影"],"info":["依頼",""]}');
    expect(copy.portrait).toEqual({ label: "人", note: "ポートレート撮影" });
    expect(copy.life).toEqual(DEVELOP_DOOR_DEFAULTS.life);
    // 添え書きは空にできる。
    expect(copy.info).toEqual({ label: "依頼", note: "" });
  });

  test("空の名前は初めの値で補い、改行や長すぎる値は整える", () => {
    const copy = developDoorCopy(
      JSON.stringify({ life: ["   ", "  毎日の\n写真  "], series: ["あ".repeat(60), "い".repeat(60)], info: [12, null] }),
    );
    expect(copy.life).toEqual({ label: "Life", note: "毎日の 写真" });
    expect(Array.from(copy.series.label).length).toBe(24);
    expect(Array.from(copy.series.note).length).toBe(30);
    expect(copy.info).toEqual(DEVELOP_DOOR_DEFAULTS.info);
  });

  test("保存する文字列：初めの値のままなら空。変えた扉だけを入れ、読み戻すと同じ", () => {
    expect(serializeDevelopDoors(developDoorCopy(""))).toBe("");
    const copy = developDoorCopy("");
    copy.portrait = { label: " People ", note: "" };
    const saved = serializeDevelopDoors(copy);
    expect(JSON.parse(saved)).toEqual({ portrait: ["People", ""] });
    expect(developDoorCopy(saved).portrait).toEqual({ label: "People", note: "" });
    expect(developDoorCopy(saved).life).toEqual(DEVELOP_DOOR_DEFAULTS.life);
    // 名前を空にして保存しようとしても、初めの名前に戻る（＝変えていないので入らない）。
    copy.portrait = { label: "", note: "人を撮る" };
    expect(serializeDevelopDoors(copy)).toBe("");
  });
});
