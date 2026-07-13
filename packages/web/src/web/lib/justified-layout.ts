import { orientedDimensions } from "../../shared/image-url";

// Justified (行組み) gallery layout — 12th layout, owner-approved 2026-07-12.
// Pure math so the row-packing behaviour is unit-testable without a DOM:
// photos flow 左→右・上→下 in sortOrder, every photo keeps its natural
// (rotation-aware) aspect ratio, and every row except the very last is flush
// — all items in a row share one height and together fill the container
// width exactly. That flush guarantee is non-negotiable (it's the literal
// definition of "justified"); see the loop below for how it's structurally
// enforced (not just checked).
//
// S/M/L acts as a *target row height* weight (an L-heavy row aims taller, an
// S-heavy row aims shorter and denser) — a strong influence on how rows are
// packed, not an ironclad per-photo guarantee. A single isolated S or L
// surrounded by a different size can't be made reliably bigger/smaller
// without leaving that row short of the container width, which would break
// the flush guarantee above — so this layout accepts that trade-off. (An
// earlier revision force-broke a new row on every size change to make S/M/L
// 100% reliable; that made rows mid-gallery non-flush — e.g. a lone S landing
// with ~70% of the container width unfilled — which is a worse defect than
// an occasional diluted size cue. Reverted per 2026-07-13 review.)

export type JustifiedPhotoInput = {
  width?: number | null;
  height?: number | null;
  rotationDeg?: number | null;
  displaySize?: string | null;
};

export type JustifiedItem = {
  /** Index into the original photos array (order is never re-shuffled). */
  index: number;
  /** Layout width in px at the row's computed height. */
  width: number;
  /** Rotation-aware aspect ratio (w/h) actually used for this tile. */
  ratio: number;
};

export type JustifiedRow = {
  items: JustifiedItem[];
  /** Uniform display height of every tile in this row, px. */
  height: number;
  /** True when the row was closed by packing and fills the container width. */
  justified: boolean;
};

// 3:2 — the library's own storage default; used when width/height are
// missing, zero or corrupt so one bad record can't break a whole row.
export const JUSTIFIED_FALLBACK_RATIO = 3 / 2;

// Degenerate metadata guard only (a 40:1 "panorama" from a bad EXIF write
// would collapse its row to a sliver). Real photos never hit these bounds,
// so the displayed ratio stays the natural one and nothing is cropped.
const MIN_RATIO = 0.3;
const MAX_RATIO = 4;

// L rows aim ~1.45× taller than M rows, S rows ~0.8× — visible size
// hierarchy without cropping or reordering.
export const JUSTIFIED_SIZE_WEIGHT: Record<"S" | "M" | "L", number> = {
  S: 0.8,
  M: 1,
  L: 1.45,
};

function sizeWeight(displaySize: string | null | undefined): number {
  return displaySize === "S" || displaySize === "L"
    ? JUSTIFIED_SIZE_WEIGHT[displaySize]
    : JUSTIFIED_SIZE_WEIGHT.M;
}

/** Rotation-aware w/h ratio with safe fallback for missing/corrupt data. */
export function justifiedRatio(photo: JustifiedPhotoInput): number {
  const dims = orientedDimensions(photo.width, photo.height, photo.rotationDeg);
  const w = dims.width;
  const h = dims.height;
  if (
    typeof w !== "number" ||
    typeof h !== "number" ||
    !Number.isFinite(w) ||
    !Number.isFinite(h) ||
    w <= 0 ||
    h <= 0
  ) {
    return JUSTIFIED_FALLBACK_RATIO;
  }
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, w / h));
}

type Entry = { index: number; ratio: number; weight: number };

export function computeJustifiedRows(
  photos: JustifiedPhotoInput[],
  opts: { containerWidth: number; gap: number; baseRowHeight: number },
): JustifiedRow[] {
  const containerWidth = Math.max(200, opts.containerWidth || 0);
  const gap = Math.max(0, opts.gap || 0);
  const base = Math.max(60, opts.baseRowHeight || 0);

  const rows: JustifiedRow[] = [];

  // `justify=true` (used for every row closed inside the loop below) always
  // stretches the row flush to the container width. `justify=false` (used
  // only once, for whatever is left after the loop) caps at the row's own
  // target instead of stretching a couple of leftover photos across the
  // full width.
  const closeRow = (current: Entry[], justify: boolean) => {
    if (current.length === 0) return;
    const available = containerWidth - gap * (current.length - 1);
    const sumRatio = current.reduce((s, it) => s + it.ratio, 0);
    const target = base * Math.max(...current.map((it) => it.weight));
    const height = justify
      ? available / sumRatio
      : Math.min(target, available / sumRatio);
    rows.push({
      items: current.map((it) => ({
        index: it.index,
        ratio: it.ratio,
        width: it.ratio * height,
      })),
      height,
      justified: justify || available / sumRatio <= target,
    });
  };

  // Plain greedy: keep adding photos to the current row; once shrinking it to
  // fit the container would take it at/below its target height, close it
  // flush. A lookback ("would excluding the last photo fit its own target
  // better?") was tried here to make L/S less position-dependent, but a
  // 2000-trial sweep showed it *hurts* S's reliability (S shorter than a
  // same-trial M row: 70% plain vs 45% with lookback) while barely helping L
  // (81.7% vs 87.7%) — the extra complexity wasn't worth a net regression.
  let current: Entry[] = [];
  for (let i = 0; i < photos.length; i++) {
    current.push({
      index: i,
      ratio: justifiedRatio(photos[i]),
      weight: sizeWeight(photos[i].displaySize),
    });
    const available = containerWidth - gap * (current.length - 1);
    const sumRatio = current.reduce((s, it) => s + it.ratio, 0);
    const target = base * Math.max(...current.map((it) => it.weight));
    if (sumRatio >= available / target) {
      closeRow(current, true); // every mid-loop close is flush — non-negotiable
      current = [];
    }
  }
  closeRow(current, false); // only the true leftover may be non-flush
  return rows;
}
