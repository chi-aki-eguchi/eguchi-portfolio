import { test, expect, describe } from "bun:test";
import { countPhotosInCategory } from "./category-usage";

const live = [
  { category: "portrait" },
  { category: "portrait" },
  { category: "snap" },
  { category: "" },
  { category: null },
];
const trashed = [{ category: "portrait" }, { category: "snap" }];

describe("分類を消したときに未分類になる枚数", () => {
  test("公開中とゴミ箱の両方を数える", () => {
    // 削除SQLは deletedAt で絞っていないので、ゴミ箱の中も巻き込まれる。
    expect(countPhotosInCategory("portrait", live, trashed)).toBe(3);
    expect(countPhotosInCategory("snap", live, trashed)).toBe(2);
  });

  test("誰も使っていない分類は0", () => {
    expect(countPhotosInCategory("landscape", live, trashed)).toBe(0);
  });

  test("未分類（空・null）を取り違えない", () => {
    expect(countPhotosInCategory("", live, trashed)).toBe(null);
  });

  test("どちらかの一覧が手元に無ければ数を出さない", () => {
    // 半端な数を「元に戻せません」と並べて見せない。
    expect(countPhotosInCategory("portrait", live, undefined)).toBe(null);
    expect(countPhotosInCategory("portrait", undefined, trashed)).toBe(null);
    expect(countPhotosInCategory("portrait", null, null)).toBe(null);
  });

  test("ゴミ箱が空でも数は出す", () => {
    expect(countPhotosInCategory("portrait", live, [])).toBe(2);
  });
});
