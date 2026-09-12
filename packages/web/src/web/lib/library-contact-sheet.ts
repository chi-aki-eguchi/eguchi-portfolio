import { computeJustifiedRows, type JustifiedPhotoInput } from "./justified-layout";

export const CONTACT_SHEET_GAP = 3;

/** Admin density is independent of the S/M/L weights used on the public site. */
export function contactSheetRows(photos: readonly JustifiedPhotoInput[], width: number, height: number) {
  let top = 0;
  return computeJustifiedRows(photos.map((photo) => ({ ...photo, displaySize: "M" })), {
    containerWidth: width,
    baseRowHeight: height,
    gap: CONTACT_SHEET_GAP,
  }).map((row) => {
    const positioned = { ...row, top };
    top += row.height + CONTACT_SHEET_GAP;
    return positioned;
  });
}
export type ContactSheetRow = ReturnType<typeof contactSheetRows>[number];

/**
 * 行を「写真1枚ずつの絶対座標」へ展開する。密度（写真サイズ）を変えると行の
 * 組み直しで行の境界と写真の並びが変わるが、DOM は写真 ID をキーに使い回し、
 * 変わるのは各セルの top/left/width/height だけにしたい（行を親にすると境界が
 * 変わるたびに配下の <img> ごと作り直され、連続ドラッグでカクつく）。
 * `topOffset` を引くと、可視ウィンドウの先頭を 0 とした座標になる。
 */
export function flattenContactRows(
  rows: readonly ContactSheetRow[],
  topOffset = 0,
) {
  const items: {
    index: number;
    width: number;
    height: number;
    top: number;
    left: number;
  }[] = [];
  for (const row of rows) {
    let left = 0;
    for (const item of row.items) {
      items.push({
        index: item.index,
        width: item.width,
        height: row.height,
        top: row.top - topOffset,
        left,
      });
      left += item.width + CONTACT_SHEET_GAP;
    }
  }
  return items;
}

export function contactSheetWindow(rows: ContactSheetRow[], scrollTop: number, viewportHeight: number) {
  const total = rows[rows.length - 1];
  const totalHeight = total ? total.top + total.height : 0;
  const first = rows.findIndex((row) => row.top + row.height >= scrollTop);
  const last = rows.findIndex((row) => row.top > scrollTop + viewportHeight);
  const startRow = viewportHeight <= 0 ? 0 : Math.max(0, (first < 0 ? rows.length - 1 : first) - 8);
  const endRow = viewportHeight <= 0 || last < 0 ? rows.length : Math.min(rows.length, last + 8);
  const visibleRows = rows.slice(startRow, endRow);
  const startIndex = visibleRows[0]?.items[0]?.index ?? 0;
  const lastRow = visibleRows[visibleRows.length - 1];
  const endIndex = (lastRow?.items[lastRow.items.length - 1]?.index ?? -1) + 1;
  const topPadding = visibleRows[0]?.top ?? 0;
  // Include the gap after the visible block in the bottom spacer only.
  const bottomPadding = Math.max(0, totalHeight - ((lastRow?.top ?? 0) + (lastRow?.height ?? 0)));
  return { visibleRows, visibleItems: flattenContactRows(visibleRows, topPadding),
    startIndex, endIndex, topPadding, bottomPadding, totalHeight,
    columns: Math.max(1, ...visibleRows.map((row) => row.items.length)),
    rowHeight: visibleRows[0]?.height ?? 1,
    renderedCount: endIndex - startIndex,
    isVirtualized: visibleRows.length < rows.length };
}

/** Up/down follows the nearest photo centre in the adjacent visual row. */
export function contactSheetNeighbor(rows: ContactSheetRow[], index: number, direction: -1 | 1) {
  const rowIndex = rows.findIndex((row) => row.items.some((item) => item.index === index));
  const row = rows[rowIndex];
  const next = rows[rowIndex + direction];
  if (!row || !next) return index;
  let x = 0;
  let centre = 0;
  for (const item of row.items) {
    if (item.index === index) centre = x + item.width / 2;
    x += item.width + CONTACT_SHEET_GAP;
  }
  x = 0;
  let nearest = next.items[0].index;
  let distance = Infinity;
  for (const item of next.items) {
    const delta = Math.abs(x + item.width / 2 - centre);
    if (delta < distance) { distance = delta; nearest = item.index; }
    x += item.width + CONTACT_SHEET_GAP;
  }
  return nearest;
}
