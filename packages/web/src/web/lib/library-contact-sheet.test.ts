import { describe, expect, it } from "bun:test";
import { contactSheetRows, contactSheetWindow, contactSheetNeighbor, flattenContactRows, CONTACT_SHEET_GAP } from "./library-contact-sheet";
const photos = Array.from({ length: 1000 }, (_, i) => ({ width: i % 3 ? 1500 : 1000, height: i % 3 ? 1000 : 1500, displaySize: i % 2 ? "L" : "S" }));
describe("Library contact sheet", () => {
  it("fits rows without square crops or public display-size weighting", () => {
    const rows = contactSheetRows(photos, 1234, 110);
    expect(rows).toEqual(contactSheetRows(photos.map((p) => ({ ...p, displaySize: "M" })), 1234, 110));
    for (const row of rows.slice(0,-1)) {
      expect(row.items.reduce((n, item) => n + item.width, 0) + CONTACT_SHEET_GAP * (row.items.length - 1)).toBeCloseTo(1234, 8);
      for (const item of row.items) expect(item.width / row.height).toBeCloseTo(photos[item.index].width / photos[item.index].height);
    }
  });
  it("virtualizes whole variable-height rows with exact spacers and reaches the final photo", () => {
    const rows = contactSheetRows(photos, 800, 130);
    const total = rows[rows.length - 1].top + rows[rows.length - 1].height;
    for (const top of [0, total / 2, total - 500, total + 500]) {
      const window = contactSheetWindow(rows, top, 500);
      const visibleHeight = window.visibleRows.reduce((n, row) => n + row.height, 0) + (window.visibleRows.length - 1) * CONTACT_SHEET_GAP;
      expect(window.topPadding + visibleHeight + window.bottomPadding).toBeCloseTo(total);
      expect(window.renderedCount).toBeLessThan(300);
      expect(window.endIndex - window.startIndex).toBe(window.visibleRows.flatMap((r) => r.items).length);
    }
    expect(contactSheetWindow(rows, total - 500, 500).endIndex).toBe(1000);
  });
  it("density changes preserve every input in order and rows stay usable on a phone", () => {
    const dense = contactSheetRows(photos, 308, 60);
    const large = contactSheetRows(photos, 308, 260);
    expect(dense.length).toBeLessThan(large.length);
    expect(dense.flatMap((r) => r.items.map((p) => p.index))).toEqual(photos.map((_, i) => i));
    expect(Math.min(...dense.map((r) => r.height))).toBeGreaterThan(40);
  });
  it("flattens rows to per-photo absolute boxes that still tile each row edge-to-edge", () => {
    const rows = contactSheetRows(photos, 1000, 120);
    const items = flattenContactRows(rows);
    // 全写真が1個ずつ、元の順序で出る（DOM を photo.id キーで使い回すため）。
    expect(items.map((it) => it.index)).toEqual(photos.map((_, i) => i));
    // 同じ top のセルは左端から width+gap で積まれ、最後は行幅に収まる。
    for (const row of rows.slice(0, -1)) {
      const rowItems = items.filter((it) => it.top === row.top);
      expect(rowItems.map((it) => it.index)).toEqual(row.items.map((it) => it.index));
      let x = 0;
      for (const it of rowItems) { expect(it.left).toBeCloseTo(x); x += it.width + CONTACT_SHEET_GAP; }
      expect(x - CONTACT_SHEET_GAP).toBeCloseTo(1000, 6);
    }
  });
  it("window.visibleItems are offset so the first visible row starts at top 0", () => {
    const rows = contactSheetRows(photos, 800, 130);
    const total = rows[rows.length - 1].top + rows[rows.length - 1].height;
    const window = contactSheetWindow(rows, total / 2, 500);
    expect(window.visibleItems.map((it) => it.index))
      .toEqual(window.visibleRows.flatMap((r) => r.items.map((it) => it.index)));
    expect(Math.min(...window.visibleItems.map((it) => it.top))).toBe(0);
  });
  it("vertical keyboard navigation follows the adjacent visual row and stops at edges", () => {
    const rows = contactSheetRows(photos, 800, 110);
    const first = rows[0].items[2].index;
    const next = contactSheetNeighbor(rows, first, 1);
    expect(rows[1].items.some((p) => p.index === next)).toBe(true);
    expect(contactSheetNeighbor(rows, 0, -1)).toBe(0);
    expect(contactSheetNeighbor(rows, 999, 1)).toBe(999);
  });
});
