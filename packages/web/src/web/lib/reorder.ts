// Photo reorder helpers for the admin Library. The view may be a filtered
// subset of the library (single-series scope): moves are expressed against the
// VISIBLE neighbour / edge, then applied to the GLOBAL id order — one sortOrder
// drives both the library and the public series pages, so a "±1 in the series"
// must splice the full list, not the subset.

export type ManualOrderResult<T> =
  | { ok: true; photos: T[]; ids: number[] }
  | {
      ok: false;
      reason: "missing-sort-order" | "invalid-sort-order" | "duplicate-order";
    };

/**
 * Reconstruct the saved manual order from sortOrder rather than trusting the
 * API response array, which may be sorted by a public gallery setting.
 *
 * Gaps are valid (soft-deleted photos can leave them behind), but every active
 * photo needs one unique, non-negative integer rank.
 */
export function reconstructManualPhotoOrder<
  T extends { id: number; sortOrder?: number | null },
>(photos: readonly T[]): ManualOrderResult<T> {
  const seenOrders = new Set<number>();
  for (const photo of photos) {
    if (photo.sortOrder == null) {
      return { ok: false, reason: "missing-sort-order" };
    }
    if (!Number.isInteger(photo.sortOrder) || photo.sortOrder < 0) {
      return { ok: false, reason: "invalid-sort-order" };
    }
    if (seenOrders.has(photo.sortOrder)) {
      return { ok: false, reason: "duplicate-order" };
    }
    seenOrders.add(photo.sortOrder);
  }
  const ordered = [...photos].sort(
    (left, right) =>
      (left.sortOrder as number) - (right.sortOrder as number) ||
      left.id - right.id,
  );
  return { ok: true, photos: ordered, ids: ordered.map((photo) => photo.id) };
}

/**
 * Move `id` one step relative to its neighbour in the visible list.
 * delta -1 lands immediately BEFORE the previous visible item; +1 lands
 * immediately AFTER the next one. Returns the new global order, or null when
 * there is nothing to do (already at the visible edge / id unknown).
 * Unfiltered (viewIds === allIds) this reduces to a plain adjacent swap.
 */
export function moveRelativeToViewNeighbor(
  allIds: number[],
  viewIds: number[],
  id: number,
  delta: number,
): number[] | null {
  const vIdx = viewIds.indexOf(id);
  const neighbor = vIdx < 0 ? undefined : viewIds[vIdx + delta];
  if (neighbor === undefined) return null;
  const ids = [...allIds];
  const idx = ids.indexOf(id);
  if (idx < 0) return null;
  ids.splice(idx, 1);
  const nIdx = ids.indexOf(neighbor);
  if (nIdx < 0) return null;
  ids.splice(delta < 0 ? nIdx : nIdx + 1, 0, id);
  return ids;
}

/**
 * Move `id` to the start/end of the visible list — anchored to the first/last
 * OTHER visible photo, so in a series scope "先頭へ" means "before the first
 * photo of this series", not position 0 of the whole library.
 */
export function moveToViewEdge(
  allIds: number[],
  viewIds: number[],
  id: number,
  pos: "start" | "end",
): number[] | null {
  const others = viewIds.filter((v) => v !== id);
  if (others.length === 0) return null;
  const anchor = pos === "start" ? others[0] : others[others.length - 1];
  const ids = [...allIds];
  const idx = ids.indexOf(id);
  if (idx < 0) return null;
  ids.splice(idx, 1);
  const aIdx = ids.indexOf(anchor);
  if (aIdx < 0) return null;
  ids.splice(pos === "start" ? aIdx : aIdx + 1, 0, id);
  return ids;
}

/**
 * Move `id` to a one-based position in the visible list, while applying the
 * change to the global order. In a single-series view, "10" therefore means
 * the 10th photo in that series, without renumbering unrelated photos.
 */
export function moveToViewPosition(
  allIds: number[],
  viewIds: number[],
  id: number,
  oneBasedPosition: number,
): number[] | null {
  if (!Number.isInteger(oneBasedPosition)) return null;
  const currentIndex = viewIds.indexOf(id);
  if (
    currentIndex < 0 ||
    oneBasedPosition < 1 ||
    oneBasedPosition > viewIds.length ||
    currentIndex === oneBasedPosition - 1
  ) {
    return null;
  }
  const others = viewIds.filter((viewId) => viewId !== id);
  const insertIndex = oneBasedPosition - 1;
  const ids = [...allIds];
  const sourceIndex = ids.indexOf(id);
  if (sourceIndex < 0) return null;
  ids.splice(sourceIndex, 1);
  if (insertIndex >= others.length) {
    const lastIndex = ids.indexOf(others[others.length - 1]);
    if (lastIndex < 0) return null;
    ids.splice(lastIndex + 1, 0, id);
    return ids;
  }
  const anchorIndex = ids.indexOf(others[insertIndex]);
  if (anchorIndex < 0) return null;
  ids.splice(anchorIndex, 0, id);
  return ids;
}

/**
 * Dragging always inserts immediately BEFORE the tile being pointed at.
 * Keeping one rule for every direction avoids the old up/down inconsistency.
 */
export function moveBeforeViewTarget(
  allIds: number[],
  viewIds: number[],
  sourceId: number,
  targetId: number,
): number[] | null {
  if (
    sourceId === targetId ||
    !viewIds.includes(sourceId) ||
    !viewIds.includes(targetId)
  ) {
    return null;
  }
  const ids = [...allIds];
  const sourceIndex = ids.indexOf(sourceId);
  if (sourceIndex < 0) return null;
  ids.splice(sourceIndex, 1);
  const targetIndex = ids.indexOf(targetId);
  if (targetIndex < 0) return null;
  ids.splice(targetIndex, 0, sourceId);
  return ids;
}
