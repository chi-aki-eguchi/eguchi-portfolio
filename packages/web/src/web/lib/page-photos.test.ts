import { describe, expect, test } from "bun:test";
import {
  columnsFor,
  dropAt,
  filterPhotos,
  gapForTile,
  groupByPeriod,
  monthKey,
  moveGroup,
  periodLabel,
  sameOrder,
  tileFromZoom,
  zoomForColumns,
  zoomFromTile,
  type PagePhoto,
  planCoverSave,
} from "./page-photos";

describe("写真の大きさ（つまみ）", () => {
  test("端は 44px と 260px。値と幅は行き来できる", () => {
    expect(tileFromZoom(0)).toBe(44);
    expect(tileFromZoom(100)).toBe(260);
    expect(tileFromZoom(-5)).toBe(44);
    expect(tileFromZoom(140)).toBe(260);
    for (const v of [0, 10, 46, 62, 75, 100]) expect(Math.abs(zoomFromTile(tileFromZoom(v)) - v)).toBeLessThanOrEqual(1);
    expect(zoomFromTile(10)).toBe(0);
    expect(zoomFromTile(999)).toBe(100);
  });

  test("余白は小さい写真ほど詰める", () => {
    expect([44, 69, 70, 109, 110, 169, 170, 260].map(gapForTile)).toEqual([2, 2, 4, 4, 8, 8, 12, 12]);
  });

  test("スマホの最初の大きさは、どの幅でもちょうど3列", () => {
    for (const width of [296, 328, 330, 358, 396]) {
      const zoom = zoomForColumns(width, 3);
      expect(columnsFor(width, zoom)).toBe(3);
      expect(columnsFor(width, zoom + 1)).toBeLessThan(3);
    }
  });
});

describe("並べ替え", () => {
  const order = [1, 2, 3, 4, 5, 6];

  test("選んだ写真をまとめて、先頭・最後・1つ前・1つ後ろへ", () => {
    expect(moveGroup(order, [2, 5], "first")).toEqual([2, 5, 1, 3, 4, 6]);
    expect(moveGroup(order, [2, 5], "last")).toEqual([1, 3, 4, 6, 2, 5]);
    expect(moveGroup(order, [3], "prev")).toEqual([1, 3, 2, 4, 5, 6]);
    expect(moveGroup(order, [3], "next")).toEqual([1, 2, 4, 3, 5, 6]);
    // 離れた2枚は、先に在る方の場所でひとまとめになってから動く。
    expect(moveGroup(order, [2, 5], "next")).toEqual([1, 3, 2, 5, 4, 6]);
    // 端では動かない。選んだ物が無ければ何もしない。
    expect(moveGroup(order, [1], "prev")).toEqual(order);
    expect(moveGroup(order, [6], "next")).toEqual(order);
    expect(moveGroup(order, [], "first")).toEqual(order);
    expect(moveGroup(order, [99], "first")).toEqual(order);
  });

  test("つかんで、線の出た場所へ入れる", () => {
    expect(dropAt(order, [6], 1)).toEqual([1, 6, 2, 3, 4, 5]);
    expect(dropAt(order, [1], 6)).toEqual([2, 3, 4, 5, 6, 1]);
    expect(dropAt(order, [3], 3)).toEqual(order); // 自分のすぐ後ろ＝動かない
    expect(dropAt(order, [3], 2)).toEqual(order); // 自分のすぐ手前＝動かない
    // 選んだ何枚かをまとめて。行き先は、動かす写真を除いた並びで数える。
    expect(dropAt(order, [1, 4], 6)).toEqual([2, 3, 5, 6, 1, 4]);
    expect(dropAt(order, [5, 6], 0)).toEqual([5, 6, 1, 2, 3, 4]);
    expect(dropAt(order, [2], 99)).toEqual([1, 3, 4, 5, 6, 2]);
  });

  test("並びが同じかどうか", () => {
    expect(sameOrder([1, 2], [1, 2])).toBe(true);
    expect(sameOrder([1, 2], [2, 1])).toBe(false);
    expect(sameOrder([1], [1, 2])).toBe(false);
  });
});

describe("足す画面", () => {
  const photo = (id: number, extra: Partial<PagePhoto> = {}): PagePhoto => ({ id, url: `/p/${id}.jpg`, ...extra });
  const photos = [
    photo(1, { shotAt: "2025-08-14T10:00:00", category: "portrait", seriesId: 6 }),
    photo(2, { shotAt: "2025-08-02T10:00:00", filmType: "フィルム" }),
    photo(3, { shotAt: "2024-12-30T10:00:00", seriesIds: [4, 6] }),
    photo(4, { shotAt: null }),
    photo(5, { shotAt: "2026-01-05T10:00:00", category: "life" }),
  ];

  test("撮った月の読み方と見出し", () => {
    expect(monthKey("2025-08-14T10:00:00")).toBe("2025-08");
    expect(monthKey(null)).toBe("");
    expect(monthKey("あとで")).toBe("");
    expect(periodLabel("2025-08")).toBe("2025年 8月");
    expect(periodLabel("2025")).toBe("2025年");
    expect(periodLabel("")).toBe("撮影日なし");
  });

  test("月ごとに区切る。新しい月が上、撮影日なしは最後。小さくしたら年ごと", () => {
    expect(groupByPeriod(photos, false).map((g) => [g.key, g.photos.map((p) => p.id)])).toEqual([
      ["2026-01", [5]],
      ["2025-08", [1, 2]],
      ["2024-12", [3]],
      ["", [4]],
    ]);
    expect(groupByPeriod(photos, true).map((g) => [g.label, g.photos.length])).toEqual([
      ["2026年", 1],
      ["2025年", 2],
      ["2024年", 1],
      ["撮影日なし", 1],
    ]);
  });

  test("絞り込み", () => {
    const base = { series: null, used: new Set([1, 5]), draft: [3, 1] } as const;
    const ids = (list: PagePhoto[]) => list.map((p) => p.id);
    expect(ids(filterPhotos(photos, { ...base, filter: "all" }))).toEqual([1, 2, 3, 4, 5]);
    expect(ids(filterPhotos(photos, { ...base, filter: "unused" }))).toEqual([2, 3, 4]);
    expect(ids(filterPhotos(photos, { ...base, filter: "picked" }))).toEqual([3, 1]); // 選んだ順のまま
    expect(ids(filterPhotos(photos, { ...base, filter: "people" }))).toEqual([1]);
    expect(ids(filterPhotos(photos, { ...base, filter: "film" }))).toEqual([2]);
    expect(ids(filterPhotos(photos, { ...base, filter: "all", series: 6 }))).toEqual([1, 3]);
    expect(ids(filterPhotos(photos, { ...base, filter: "all", series: "none" }))).toEqual([2, 4, 5]);
    expect(ids(filterPhotos(photos, { ...base, filter: "picked", series: 4 }))).toEqual([3]);
  });
});

describe("表紙の並びを保存する段取り", () => {
  const visible = new Set([1, 2, 3, 4, 5]);

  test("並べ替えだけ：外す・足すは無く、いまの並びを添えて並べ替える", () => {
    expect(planCoverSave([1, 2, 3], visible, [3, 1, 2])).toEqual({
      remove: [],
      add: [],
      reorder: { photoIds: [3, 1, 2], expectedIds: [1, 2, 3] },
    });
  });

  test("足す：最後に入るので、並べ替えは要らない", () => {
    expect(planCoverSave([1, 2], visible, [1, 2, 4])).toEqual({ remove: [], add: [4], reorder: null });
  });

  test("外す：並びが変わらなければ、並べ替えは要らない", () => {
    expect(planCoverSave([1, 2, 3], visible, [1, 3])).toEqual({ remove: [2], add: [], reorder: null });
  });

  test("足して前へ：足した後の並びを添えて並べ替える", () => {
    expect(planCoverSave([1, 2], visible, [4, 1, 2])).toEqual({
      remove: [],
      add: [4],
      reorder: { photoIds: [4, 1, 2], expectedIds: [1, 2, 4] },
    });
  });

  test("画面に無い登録（非公開の写真）は外さず、後ろへ置く", () => {
    // 9 は公開していない写真。画面には 1・2 だけが見えている。
    expect(planCoverSave([9, 1, 2], visible, [2, 1])).toEqual({
      remove: [],
      add: [],
      reorder: { photoIds: [2, 1, 9], expectedIds: [9, 1, 2] },
    });
    expect(planCoverSave([1, 9], visible, [])).toEqual({ remove: [1], add: [], reorder: null });
  });

  test("変わっていなければ、何もしない", () => {
    expect(planCoverSave([1, 2, 9], visible, [1, 2])).toEqual({ remove: [], add: [], reorder: null });
  });
});
