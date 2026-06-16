/**
 * Controlled-random gallery layout (spec グループG).
 *
 * Sizes stay manual (S/M/L set by Aki). What this module controls is the
 * *rhythm*: deterministic, seeded insertion of intentional empty cells so the
 * grid breathes ("抜け感") without ever feeling broken. Read order (row-first,
 * sortOrder) is preserved — gaps only push photos forward, never reorder them.
 */

export type GalleryCell =
  | { type: "photo"; photoIndex: number }
  | { type: "gap" };

export interface GalleryLayoutOpts {
  columns: number;
  emptyRate: number; // 0..0.3 — frequency of inserted empty cells
  seed: number; // integer — "shuffle" changes this
  isMobile: boolean;
}

/** Deterministic PRNG (mulberry32) — same seed ⇒ same sequence. */
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a hash of the photo-id sequence, so the layout is tied to composition. */
function hashIds(ids: number[]): number {
  let h = 2166136261;
  for (const id of ids) {
    h ^= id;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Build the cell sequence (photos + gaps) for `count` photos.
 * `ids` seeds the layout so the same photo set reproduces the same arrangement.
 */
export function buildGalleryLayout(count: number, ids: number[], opts: GalleryLayoutOpts): GalleryCell[] {
  if (count <= 0) return [];
  const cols = Math.max(1, Math.floor(opts.columns));
  // G1.5: narrow screens go sparse fast, so dial empties down on mobile.
  const emptyRate = clamp(opts.emptyRate, 0, 0.3) * (opts.isMobile ? 0.4 : 1);

  // Seed combines the explicit seed (shuffle) with a hash of the id sequence so
  // the same composition is stable across reloads (G1.1) but a new photo set or
  // a new seed yields a fresh arrangement.
  const rand = mulberry32((opts.seed | 0) ^ hashIds(ids));

  const cells: GalleryCell[] = [];
  let placed = 0;
  let prevGap = false; // G1.2: never two gaps in a row

  while (placed < count) {
    const col = cells.length % cols;
    const isRowEdge = col === 0 || col === cols - 1;
    const remaining = count - placed;
    // No gap as the first cell (corner) or when ≤1 photo is left — that keeps a
    // gap from ever being the trailing cell.
    const canGap = emptyRate > 0 && !prevGap && cells.length > 0 && remaining > 1;
    // G1.2: halve the odds at row start/end so gaps don't bias toward edges.
    const chance = isRowEdge ? emptyRate * 0.5 : emptyRate;
    if (canGap && rand() < chance) {
      cells.push({ type: "gap" });
      prevGap = true;
    } else {
      cells.push({ type: "photo", photoIndex: placed });
      placed++;
      prevGap = false;
    }
  }
  return cells;
}

/**
 * Tile width within its grid cell, as a percentage string.
 * `variation` (0..1) controls how strongly S/M/L differ: 0 ≈ uniform grid,
 * 1 = full spread. The float (< 100%) plus justify-self is what makes the
 * "抜け感" — photos sit loosely in their cells rather than filling them.
 */
export function tileWidth(size: "S" | "M" | "L", variation: number): string {
  const v = clamp(variation, 0, 1);
  const spread: Record<string, number> = { S: 0.58, M: 0.82, L: 1.0 };
  const uniform = 0.92;
  const base = spread[size] ?? spread.M;
  return `${Math.round((uniform + (base - uniform) * v) * 100)}%`;
}
