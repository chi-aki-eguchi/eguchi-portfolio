import { describe, expect, test } from "bun:test";
import {
  formatZoomSize,
  parseZoomSize,
  pickZoomLevel,
  visibleZoomTiles,
  zoomBaseKey,
  zoomLevels,
  zoomStemFromTileKey,
  zoomTilePaths,
} from "./photo-zoom";

describe("photo-zoom", () => {
  test("大きさの文字列を往復できる。形が違えば高精細なし", () => {
    expect(parseZoomSize(formatZoomSize({ w: 7680, h: 5760 }))).toEqual({ w: 7680, h: 5760 });
    for (const bad of [null, undefined, "", "7680", "7680x", "0x10", "a7680x5760", "7680x5760x1", 7680])
      expect(parseZoomSize(bad)).toBeNull();
  });

  test("8K は 2 段（8K・4K）、合わせて 60 枚", () => {
    const levels = zoomLevels({ w: 7680, h: 5760 });
    expect(levels.map((l) => [l.index, l.w, l.h, l.cols, l.rows])).toEqual([
      [0, 7680, 5760, 8, 6],
      [1, 3840, 2880, 4, 3],
    ]);
    expect(zoomTilePaths({ w: 7680, h: 5760 }).length).toBe(60);
  });

  test("小さくても、いちばん上の段は必ずある", () => {
    expect(zoomLevels({ w: 1800, h: 1200 }).length).toBe(1);
  });

  test("鍵の行き来", () => {
    expect(zoomBaseKey("photos/17-abc-海.jpg")).toBe("tiles/17-abc-海");
    expect(zoomBaseKey("thumbs/x.webp")).toBeNull();
    expect(zoomBaseKey("photos/a/b.jpg")).toBeNull();
    expect(zoomStemFromTileKey("tiles/17-abc-海/0/3_2.webp")).toBe("17-abc-海");
    expect(zoomStemFromTileKey("tiles/x/0/3_2.jpg")).toBeNull();
    expect(zoomStemFromTileKey("tiles/x/../0/3_2.webp")).toBeNull();
  });

  test("出ている幅に足りる、いちばん粗い段を選ぶ", () => {
    const levels = zoomLevels({ w: 7680, h: 5760 });
    expect(pickZoomLevel(levels, 2700)?.index).toBe(1);
    expect(pickZoomLevel(levels, 3900)?.index).toBe(1);
    expect(pickZoomLevel(levels, 5000)?.index).toBe(0);
    expect(pickZoomLevel(levels, 20000)?.index).toBe(0);
    expect(pickZoomLevel([], 100)).toBeNull();
  });

  test("見えている範囲にかかる四角だけ", () => {
    const [top] = zoomLevels({ w: 5000, h: 3000 });
    expect(visibleZoomTiles(top, { x0: 0, y0: 0, x1: 1, y1: 1 }).length).toBe(15);
    const part = visibleZoomTiles(top, { x0: 0.5, y0: 0.5, x1: 0.7, y1: 0.6 });
    expect(part.map((t) => `${t.col}_${t.row}`)).toEqual(["2_1", "3_1"]);
    expect(visibleZoomTiles(top, { x0: 0.5, y0: 0.5, x1: 0.7, y1: 0.6 }, 1).length).toBe(12);
    expect(visibleZoomTiles(top, { x0: 1.2, y0: 0, x1: 1.5, y1: 1 })).toEqual([]);
    // 端の四角は余りの幅。全部の幅を足すと 100%。
    const row0 = visibleZoomTiles(top, { x0: 0, y0: 0, x1: 1, y1: 0.01 });
    expect(row0.reduce((sum, t) => sum + t.width, 0)).toBeCloseTo(100, 6);
    expect(row0.at(-1)?.left).toBeCloseTo((4096 / 5000) * 100, 6);
  });
});
