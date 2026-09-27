import type { RowPlan, PlannedRow } from "./photo-rows";

/** TOPは表紙1枚から、1枚と2枚の組を交互に。選択順と写真の比を保つ。 */
export function planSelection(ratios: number[], width: number, viewport: number, reserve: number): RowPlan {
  const rows: PlannedRow[] = [];
  const gap = width < 640 ? 16 : 32;
  const breathing = width < 640 ? 48 : 96;
  let index = 0;
  let top = 0;
  while (index < ratios.length) {
    const count = Math.min(rows.length % 2 === 0 ? 1 : 2, ratios.length - index);
    const sum = ratios.slice(index, index + count).reduce((a, b) => a + b, 0);
    const available = rows.length === 0 ? Math.max(120, viewport - reserve) : viewport * 0.72;
    const height = Math.min((width - gap * (count - 1)) / sum, available);
    let x = (width - height * sum - gap * (count - 1)) / 2;
    const items = Array.from({ length: count }, (_, offset) => {
      const itemWidth = ratios[index + offset]! * height;
      const item = { index: index + offset, x, width: itemWidth };
      x += itemWidth + gap;
      return item;
    });
    rows.push({ top, height, items, full: false });
    index += count;
    top += height + breathing;
  }
  const last = rows[rows.length - 1];
  return { rows, height: last ? last.top + last.height : 0 };
}

/** Galleryは元の比の小さな写真を等間隔の棚へ。読み足しても既存の位置は変えない。 */
export function planContactSheet(ratios: number[], width: number): RowPlan {
  const columns = width < 640 ? 2 : width < 1000 ? 3 : 4;
  const gap = width < 640 ? 18 : 36;
  const cell = (width - gap * (columns - 1)) / columns;
  const rows: PlannedRow[] = [];
  for (let index = 0; index < ratios.length; index += columns) {
    const items = ratios.slice(index, index + columns).map((ratio, offset) => ({
      index: index + offset,
      x: offset * (cell + gap),
      width: Math.min(cell, cell * ratio),
    }));
    // 各写真の高さは別々なので1枚を1行として保持する。表示順は変わらない。
    items.forEach((item, offset) => {
      const height = item.width / ratios[index + offset]!;
      rows.push({
        top: Math.floor(index / columns) * (cell + gap) + (cell - height) / 2,
        height,
        items: [{ ...item, x: item.x + (cell - item.width) / 2 }],
        full: false,
      });
    });
  }
  return { rows, height: Math.ceil(ratios.length / columns) * (cell + gap) - (ratios.length ? gap : 0) };
}
