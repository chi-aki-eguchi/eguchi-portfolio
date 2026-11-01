import { describe, expect, test } from "bun:test";
import {
  EXHIBITION_BUILT_IN,
  EXHIBITION_POEM,
  EXHIBITION_WALL,
  exhibitionCardVisitor,
  exhibitionIsTop,
  exhibitionNeedsLibrary,
  exhibitionPhotoList,
  exhibitionShape,
  exhibitionShowsWall,
  exhibitionStatus,
  exhibitionTextFitsSheet,
  readExhibitionCaptions,
  writeExhibitionCaptions,
} from "./exhibition";

const library = [
  { id: 12, url: "/api/images/photos/a.jpg" },
  { id: 34, url: "/api/images/photos/b.jpg" },
];

describe("トップの展示の決まり", () => {
  test("保存値が無いときは持ち主のサイトだけ出す（配布版のサイトに出さない）", () => {
    expect(exhibitionStatus(undefined, "https://akieguchi.com")).toBe("on");
    expect(exhibitionStatus(undefined, "https://www.akieguchi.com/")).toBe("on");
    expect(exhibitionStatus(undefined, "https://someone-else.example")).toBe("off");
    expect(exhibitionStatus(undefined, "")).toBe("off");
  });

  test("保存した値は、どのサイトでも優先する（止めたら日付に関係なく止まる）", () => {
    expect(exhibitionStatus("off", "https://akieguchi.com")).toBe("off");
    expect(exhibitionStatus("on", "https://someone-else.example")).toBe("on");
    expect(exhibitionStatus("???", "https://someone-else.example")).toBe("off");
  });

  test("展示がトップかどうかは、新しい構成で、止めていないときだけ（名刺の QR の通し先を決める）", () => {
    const site = "https://akieguchi.com";
    expect(exhibitionIsTop({ siteDesign: "develop" }, site)).toBe(true);
    expect(exhibitionIsTop({ siteDesign: "develop", homeExhibition: "off" }, site)).toBe(false);
    expect(exhibitionIsTop({ siteDesign: "classic" }, site)).toBe(false);
    expect(exhibitionIsTop({ siteDesign: "develop" }, "https://someone-else.example")).toBe(false);
  });

  const WALL_ORDER = [-4, -3, -2, -1, -5];

  test("並びが空なら、同梱の写真を会場の壁の順で出す", () => {
    expect(exhibitionPhotoList("", library).map((p) => p.id)).toEqual(WALL_ORDER);
    expect(exhibitionPhotoList(undefined, []).map((p) => p.id)).toEqual(WALL_ORDER);
    expect(EXHIBITION_WALL.works.map((work) => work.id)).toEqual(WALL_ORDER);
  });

  test("5枚が揃っている間は壁の配置を出し、外すと1枚の表紙に戻る", () => {
    expect(exhibitionShowsWall("")).toBe(true);
    expect(exhibitionShowsWall("-1,-2,-3,-4,-5")).toBe(true);
    expect(exhibitionShowsWall("-4,12,-3,-2,-1,-5")).toBe(true);
    expect(exhibitionShowsWall("-4,-3,-2,-1")).toBe(false);
    expect(exhibitionShowsWall("12,34")).toBe(false);
  });

  test("名刺の QR から来た人だけを見分ける", () => {
    expect(exhibitionCardVisitor("a=1; ex_card=1; b=2", "")).toBe(true);
    expect(exhibitionCardVisitor("ex_card=0", "")).toBe(false);
    expect(exhibitionCardVisitor("not_ex_card=1", "")).toBe(false);
    expect(exhibitionCardVisitor("", "")).toBe(false);
    expect(exhibitionCardVisitor("", "?card")).toBe(true);
  });

  test("スマホの掛け方：写真は枠の比のまま（切り抜かない）、はみ出さず、どれも重ならない", () => {
    const { ratio, sheet, cards } = EXHIBITION_WALL.phone;
    const boxes = [...EXHIBITION_WALL.works.map((work) => work.phone), sheet, ...cards];
    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.w).toBeLessThanOrEqual(100.01);
      expect(box.y + box.h).toBeLessThanOrEqual(100.01);
    }
    for (const work of EXHIBITION_WALL.works) {
      const photo = EXHIBITION_BUILT_IN.find((item) => item.id === work.id)!;
      const shown = (work.phone.w * ratio) / work.phone.h;
      expect(Math.abs(shown / (photo.width / photo.height) - 1)).toBeLessThan(0.02);
    }
    boxes.forEach((a, i) =>
      boxes.slice(i + 1).forEach((b) => {
        const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
        expect(apart).toBe(true);
      }),
    );
  });

  test("詩は原稿のまま8行で、紙に収まる。長い文は横書きへ回す", () => {
    expect(EXHIBITION_POEM.split("\n")).toHaveLength(8);
    expect(exhibitionTextFitsSheet(EXHIBITION_POEM)).toBe(true);
    expect(exhibitionTextFitsSheet("長い一行".repeat(10))).toBe(false);
    expect(exhibitionTextFitsSheet(Array(11).fill("行").join("\n"))).toBe(false);
  });

  test("同梱とライブラリの写真を、選んだ順で混ぜて出せる。消した写真は飛ばす", () => {
    expect(exhibitionPhotoList("-2,12,999,-1,34", library).map((p) => p.id)).toEqual([-2, 12, -1, 34]);
  });

  test("選んだ写真が1枚も残っていなければ、空のトップにせず同梱の写真に戻す", () => {
    expect(exhibitionPhotoList("999", library).map((p) => p.id)).toEqual(WALL_ORDER);
  });

  test("ライブラリの写真が並びにあるときだけ、写真の一覧を待つ", () => {
    expect(exhibitionNeedsLibrary("")).toBe(false);
    expect(exhibitionNeedsLibrary("-1,-2")).toBe(false);
    expect(exhibitionNeedsLibrary("-1,12")).toBe(true);
  });

  test("同梱の写真の住所と ID は重ならず、公開の写真の ID（正の数）と重ならない", () => {
    expect(new Set(EXHIBITION_BUILT_IN.map((p) => p.url)).size).toBe(EXHIBITION_BUILT_IN.length);
    expect(EXHIBITION_BUILT_IN.every((p) => p.id < 0)).toBe(true);
  });

  test("写真の題：壊れた値は無かったことにし、空の題は保存しない", () => {
    expect(readExhibitionCaptions("{こわれた")).toEqual({});
    expect(readExhibitionCaptions("[1]")).toEqual({});
    expect(readExhibitionCaptions(JSON.stringify({ "-2": " 部屋\n ", x: "無視", 12: 3 }))).toEqual({ [-2]: "部屋" });
    expect(writeExhibitionCaptions({ [-2]: "部屋", 12: "  " })).toBe(JSON.stringify({ "-2": "部屋" }));
    expect(writeExhibitionCaptions({ 12: "" })).toBe("");
  });

  test("写真の形を比から決める", () => {
    expect(exhibitionShape(2800, 2222)).toBe("wide");
    expect(exhibitionShape(2799, 2800)).toBe("square");
    expect(exhibitionShape(2240, 2800)).toBe("tall");
    expect(exhibitionShape(null, null)).toBe("wide");
  });
});
