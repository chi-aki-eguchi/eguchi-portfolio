import { describe, expect, test } from "bun:test";
import { adminPhotoSrc, computeVirtualGridWindow } from "../pages/admin";

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
    expect(window.renderedCount).toBe(60);
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
