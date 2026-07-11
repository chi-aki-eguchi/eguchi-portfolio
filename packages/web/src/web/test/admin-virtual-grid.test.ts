import { describe, expect, test } from "bun:test";
import {
  adminPhotoSrc,
  computeVirtualGridWindow,
  effectiveLibraryThumbSize,
  showLibraryJumpButtons,
} from "../pages/admin";

describe("admin library virtual grid", () => {
  test("renders only visible rows plus buffer for a large library", () => {
    const window = computeVirtualGridWindow({
      itemCount: 445,
      scrollTop: 0,
      viewportHeight: 900,
      gridWidth: 1200,
      minItemSize: 180,
    });

    expect(window.columns).toBe(6);
    expect(window.startIndex).toBe(0);
    expect(window.endIndex).toBeLessThan(445);
    expect(window.renderedCount).toBe(78);
    expect(window.isVirtualized).toBe(true);
  });

  test("admin tile images prefer pre-generated thumbnails", () => {
    expect(
      adminPhotoSrc(
        {
          url: "/api/images/photos/original.jpg",
          thumbUrl: "/api/images/thumbs/original.webp",
          mediumUrl: "/api/images/medium/original.webp",
        },
        400,
        70,
      ),
    ).toBe("/api/images/thumbs/original.webp");
    expect(
      adminPhotoSrc(
        {
          url: "/api/images/photos/original.jpg",
          thumbUrl: "/api/images/thumbs/original.webp",
          mediumUrl: "/api/images/medium/original.webp",
        },
        1600,
        85,
      ),
    ).toBe("/api/images/medium/original.webp");
  });

  test("keeps global indexes stable after scrolling", () => {
    const window = computeVirtualGridWindow({
      itemCount: 445,
      scrollTop: 2400,
      viewportHeight: 900,
      gridWidth: 1200,
      minItemSize: 180,
    });

    expect(window.startIndex).toBeGreaterThan(0);
    expect(window.endIndex).toBeLessThan(445);
    expect(window.topPadding).toBeGreaterThan(0);
    expect(window.bottomPadding).toBeGreaterThan(0);
  });

  test("recomputes columns when the library width changes", () => {
    const wide = computeVirtualGridWindow({
      itemCount: 445,
      scrollTop: 2400,
      viewportHeight: 900,
      gridWidth: 1200,
      minItemSize: 180,
    });
    const narrow = computeVirtualGridWindow({
      itemCount: 445,
      scrollTop: 2400,
      viewportHeight: 900,
      gridWidth: 900,
      minItemSize: 180,
    });

    expect(wide.columns).toBe(6);
    expect(narrow.columns).toBe(4);
    expect(narrow.rowHeight).toBeGreaterThan(wide.rowHeight);
    expect(narrow.startIndex).not.toBe(wide.startIndex);
  });

  test("falls back to the full list when layout metrics are unavailable", () => {
    const window = computeVirtualGridWindow({
      itemCount: 12,
      scrollTop: 0,
      viewportHeight: 0,
      gridWidth: 0,
      minItemSize: 180,
    });

    expect(window.startIndex).toBe(0);
    expect(window.endIndex).toBe(12);
    expect(window.renderedCount).toBe(12);
    expect(window.isVirtualized).toBe(false);
  });
});

// スマホ幅の Library が1列に落ちないための実効サムネイル幅。境界値は
// gap=8 の auto-fill minmax 式 floor((gridWidth+gap)/(size+gap)) と対応する。
describe("effectiveLibraryThumbSize", () => {
  test("wide grids keep the user's thumbSize untouched", () => {
    expect(effectiveLibraryThumbSize({ thumbSize: 220, gridWidth: 1200 })).toBe(
      220,
    );
  });

  test("375px viewport (grid≈343px) shrinks to a 2-column size", () => {
    const size = effectiveLibraryThumbSize({ thumbSize: 220, gridWidth: 343 });
    expect(size).toBe(167);
    // CSS auto-fill と同じ式で実際に2列になることを固定する
    expect(Math.floor((343 + 8) / (size + 8))).toBe(2);
  });

  test("390px viewport (grid≈358px) also yields 2 columns", () => {
    const size = effectiveLibraryThumbSize({ thumbSize: 220, gridWidth: 358 });
    expect(size).toBe(175);
    expect(Math.floor((358 + 8) / (size + 8))).toBe(2);
  });

  test("a small user-set thumbSize that already fits 2+ columns is kept", () => {
    // 100px なら 343px 幅で3列入る — 巨大化させない
    expect(effectiveLibraryThumbSize({ thumbSize: 100, gridWidth: 343 })).toBe(
      100,
    );
  });

  test("never shrinks below the button-safe floor (keeps 1 column instead)", () => {
    // 2列化すると 120px を割る極端な狭さでは従来の1列を維持する
    expect(effectiveLibraryThumbSize({ thumbSize: 220, gridWidth: 240 })).toBe(
      220,
    );
  });

  test("unmeasured grid (mount/jsdom) falls back to thumbSize", () => {
    expect(effectiveLibraryThumbSize({ thumbSize: 220, gridWidth: 0 })).toBe(
      220,
    );
  });
});

// タッチ端末では admin-tap-sm が40px角になり、⇤前次⇥の4ボタン+gap12pxで
// 最低172px必要 — 2列時の167pxカードからはみ出すため出し分ける。
describe("showLibraryJumpButtons", () => {
  test("coarse pointer hides jumps on 2-column cards (167px < 172px needed)", () => {
    expect(showLibraryJumpButtons(167, true)).toBe(false);
    expect(showLibraryJumpButtons(180, true)).toBe(true);
  });

  test("fine pointer keeps the previous 120px floor (24px buttons fit)", () => {
    expect(showLibraryJumpButtons(120, false)).toBe(true);
    expect(showLibraryJumpButtons(119, false)).toBe(false);
  });
});
