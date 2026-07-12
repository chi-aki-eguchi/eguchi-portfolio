import { orientedDimensions } from "../../shared/image-url";

// Justified (行組み) gallery layout — 12th layout, owner-approved 2026-07-12.
// Pure math so the row-packing behaviour is unit-testable without a DOM:
// photos flow 左→右・上→下 in sortOrder, every photo keeps its natural
// (rotation-aware) aspect ratio, and each closed row is flush — all items in
// a row share one height and together fill the container width exactly.
// S/M/L acts as a *target row height* weight: every row is weight-homogeneous
// (a size change always starts a fresh row, see the force-break guard below),
// so an L always gets its own taller row and an S always gets its own
// shorter, denser row — regardless of what precedes or follows it.

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

export function computeJustifiedRows(
  photos: JustifiedPhotoInput[],
  opts: { containerWidth: number; gap: number; baseRowHeight: number },
): JustifiedRow[] {
  const containerWidth = Math.max(200, opts.containerWidth || 0);
  const gap = Math.max(0, opts.gap || 0);
  const base = Math.max(60, opts.baseRowHeight || 0);

  const rows: JustifiedRow[] = [];
  let current: { index: number; ratio: number; weight: number }[] = [];

  const closeRow = (justify: boolean) => {
    if (current.length === 0) return;
    const available = containerWidth - gap * (current.length - 1);
    const sumRatio = current.reduce((s, it) => s + it.ratio, 0);
    // Every row built by the loop below is weight-homogeneous (see the
    // force-break guard), so any member's weight is the row's target weight.
    const target = base * current[0].weight;
    // A justified row is flush: height derives from the container so the
    // widths sum to it exactly. The final row keeps its target height
    // instead of stretching a couple of photos across the full width —
    // unless even at target height it would overflow, then it justifies too.
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
    current = [];
  };

  for (let i = 0; i < photos.length; i++) {
    const ratio = justifiedRatio(photos[i]);
    const weight = sizeWeight(photos[i].displaySize);
    // Force-break guard: rows are packed to a *single shared* target height,
    // so mixing weight classes inside one row silently erases whichever one
    // isn't the max. An S folded in after an M/L never shows (max stays at
    // the bigger weight) — S's "smaller" cue would never appear. And an L
    // arriving after several M's had already spent most of the row's width
    // budget under the *old* (lower) target overshoots the new, taller
    // target and can close *smaller* than a plain M-only row — L sometimes
    // renders bigger, sometimes not at all, purely depending on scan order.
    // Fix: keep every row's weight class homogeneous. The moment the
    // incoming photo's weight differs from the row already being built,
    // close that row now (at its own honestly-earned, capped/non-stretched
    // height) and start a fresh row with the new photo. Runs of the same
    // displaySize still pack multiple photos together as before; S and L
    // each reliably get their own dedicated target no matter what precedes
    // or follows them.
    if (current.length > 0 && weight !== current[0].weight) {
      closeRow(false);
    }
    current.push({ index: i, ratio, weight });
    const available = containerWidth - gap * (current.length - 1);
    const sumRatio = current.reduce((s, it) => s + it.ratio, 0);
    const target = base * weight;
    // Row is full once shrinking to fit would take it at/below target height.
    if (sumRatio >= available / target) closeRow(true);
  }
  closeRow(false);
  return rows;
}
