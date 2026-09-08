import { justifiedRatio } from "./justified-layout";
import type { JustifiedPhotoInput } from "./justified-layout";

export type PhotoAppRow = {
  start: number;
  end: number;
  top: number;
  height: number;
  items: {
    index: number;
    left: number;
    width: number;
  }[];
};

function clampColumns(value: number): number {
  const columns = Number.isFinite(value) ? Math.floor(value) : 2;
  return Math.min(12, Math.max(2, columns));
}

function clampNonNegative(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value === -Infinity || value === Infinity) {
    return fallback;
  }
  return Math.max(0, value);
}

function locateRowForIndex(rows: PhotoAppRow[], index: number): number {
  let low = 0;
  let high = rows.length - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const row = rows[mid];
    if (index < row.start) {
      high = mid - 1;
      continue;
    }
    if (index >= row.end) {
      low = mid + 1;
      continue;
    }
    return mid;
  }

  if (rows.length === 0 || index < 0) return -1;
  if (index >= rows[rows.length - 1].end) return rows.length - 1;
  return -1;
}

function firstRowByBottom(rows: PhotoAppRow[], bottom: number): number {
  let low = 0;
  let high = rows.length;

  while (low < high) {
    const mid = (low + high) >> 1;
    const row = rows[mid];
    if (row.top + row.height <= bottom) {
      low = mid + 1;
      continue;
    }
    high = mid;
  }

  return low;
}

function firstRowByTop(rows: PhotoAppRow[], top: number): number {
  let low = 0;
  let high = rows.length;

  while (low < high) {
    const mid = (low + high) >> 1;
    const row = rows[mid];
    if (row.top <= top) {
      low = mid + 1;
      continue;
    }
    high = mid;
  }

  return low;
}

export function buildPhotoAppRows(
  photos: JustifiedPhotoInput[],
  width: number,
  columns: number,
  gap = 3,
): PhotoAppRow[] {
  const safeColumns = clampColumns(columns);
  const safeGap = clampNonNegative(gap, 0);
  const safeWidth = clampNonNegative(width, 0);
  if (!Array.isArray(photos) || photos.length === 0 || safeWidth === 0) {
    return [];
  }

  const rows: PhotoAppRow[] = [];
  let top = 0;

  for (let start = 0; start < photos.length; start += safeColumns) {
    const end = Math.min(photos.length, start + safeColumns);
    const count = end - start;
    const rowPhotos = photos.slice(start, end);
    const ratios: number[] = [];

    let sumRatio = 0;
    for (const photo of rowPhotos) {
      const ratio = justifiedRatio(photo);
      ratios.push(ratio);
      sumRatio += ratio;
    }

    const available = Math.max(0, safeWidth - safeGap * (count - 1));
    const height =
      count > 0 && sumRatio > 0
        ? (available / sumRatio) * (count / safeColumns)
        : 0;

    let cursor = 0;
    const items = rowPhotos.map((_, i) => {
      const itemWidth = ratios[i] * height;
      const item = {
        index: start + i,
        left: cursor,
        width: itemWidth,
      };
      cursor += itemWidth + safeGap;
      return item;
    });

    rows.push({ start, end, top, height, items });
    top += height + safeGap;
  }

  return rows;
}

export function visiblePhotoAppRows(
  rows: PhotoAppRow[],
  scrollTop: number,
  viewportHeight: number,
  overscan = 600,
): { start: number; end: number } {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { start: 0, end: 0 };
  }

  const safeScrollTop = Number.isFinite(scrollTop) ? Math.max(0, scrollTop) : 0;
  const safeViewportHeight = clampNonNegative(viewportHeight, 0);
  const safeOverscan = clampNonNegative(overscan, 600);
  const startBound = safeScrollTop - safeOverscan;
  const endBound = safeScrollTop + safeViewportHeight + safeOverscan;
  const start = firstRowByBottom(rows, startBound);
  const end = firstRowByTop(rows, endBound);

  return {
    start: Math.max(0, Math.min(rows.length, start)),
    end: Math.max(0, Math.min(rows.length, end)),
  };
}

export function photoAppArrowIndex(
  rows: PhotoAppRow[],
  currentIndex: number,
  direction: "left" | "right" | "up" | "down",
): number {
  if (!Array.isArray(rows) || rows.length === 0) {
    return Math.max(0, currentIndex);
  }

  const maxIndex = rows[rows.length - 1].end - 1;
  if (maxIndex < 0) {
    return 0;
  }

  const clampedCurrent = Math.max(0, Math.min(maxIndex, currentIndex));
  const currentRowIndex = locateRowForIndex(rows, clampedCurrent);
  if (currentRowIndex < 0) {
    return clampedCurrent;
  }

  if (direction === "left") {
    return Math.max(0, Math.min(maxIndex, clampedCurrent - 1));
  }

  if (direction === "right") {
    return Math.max(0, Math.min(maxIndex, clampedCurrent + 1));
  }

  const currentRow = rows[currentRowIndex];
  const currentItem = currentRow.items.find((item) => item.index === clampedCurrent);
  if (!currentItem) {
    return clampedCurrent;
  }
  const currentCenter = currentItem.left + currentItem.width / 2;

  const targetRowIndex =
    direction === "up" ? currentRowIndex - 1 : currentRowIndex + 1;
  if (targetRowIndex < 0 || targetRowIndex >= rows.length) {
    return clampedCurrent;
  }

  const targetRow = rows[targetRowIndex];
  let bestIndex = clampedCurrent;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const item of targetRow.items) {
    const center = item.left + item.width / 2;
    const distance = Math.abs(center - currentCenter);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = item.index;
    }
  }

  return bestIndex;
}
