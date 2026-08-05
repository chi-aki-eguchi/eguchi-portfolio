export type PhotoOrderRow = {
  id: number;
  sortOrder: number;
};

export type PhotoReorderRequest = {
  ids: unknown;
  expectedIds: unknown;
};

export type PhotoReorderValidation =
  | { ok: true; ids: number[] }
  | {
      ok: false;
      status: 400 | 409;
      code:
        | "INVALID_IDS"
        | "DUPLICATE_IDS"
        | "UNKNOWN_IDS"
        | "MISSING_IDS"
        | "ORDER_CONFLICT";
      error: string;
    };

const CONFLICT_ERROR =
  "他の画面で変更されました。再読み込みしてください";

function exactIntArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  return value.every((id) => Number.isInteger(id)) ? value : null;
}

function hasDuplicates(ids: readonly number[]): boolean {
  return new Set(ids).size !== ids.length;
}

function sameIds(left: readonly number[], right: readonly number[]): boolean {
  if (left.length !== right.length) return false;
  const rightIds = new Set(right);
  return left.every((id) => rightIds.has(id));
}

function sameOrder(left: readonly number[], right: readonly number[]): boolean {
  return (
    left.length === right.length &&
    left.every((id, index) => id === right[index])
  );
}

/**
 * Validate a requested photo order against the active rows read at save time.
 *
 * `expectedIds` is the manual order the client originally loaded. Comparing it
 * with the transaction-time order rejects stale tabs before they can overwrite
 * a newer reorder, upload, restore, or deletion.
 */
export function validatePhotoReorder(
  request: PhotoReorderRequest,
  currentRows: readonly PhotoOrderRow[],
): PhotoReorderValidation {
  const ids = exactIntArray(request.ids);
  const expectedIds = exactIntArray(request.expectedIds);
  if (!ids || !expectedIds) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_IDS",
      error: "写真IDは整数の配列で送ってください",
    };
  }
  if (hasDuplicates(ids) || hasDuplicates(expectedIds)) {
    return {
      ok: false,
      status: 400,
      code: "DUPLICATE_IDS",
      error: "写真IDが重複しています",
    };
  }

  const currentSortOrders = currentRows.map((row) => row.sortOrder);
  if (
    currentSortOrders.some(
      (sortOrder) => !Number.isInteger(sortOrder) || sortOrder < 0,
    ) ||
    hasDuplicates(currentSortOrders)
  ) {
    return {
      ok: false,
      status: 409,
      code: "ORDER_CONFLICT",
      error: CONFLICT_ERROR,
    };
  }
  const currentIds = [...currentRows]
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || left.id - right.id,
    )
    .map((row) => row.id);
  if (!sameIds(expectedIds, currentIds)) {
    return {
      ok: false,
      status: 409,
      code: "ORDER_CONFLICT",
      error: CONFLICT_ERROR,
    };
  }
  if (!sameOrder(expectedIds, currentIds)) {
    return {
      ok: false,
      status: 409,
      code: "ORDER_CONFLICT",
      error: CONFLICT_ERROR,
    };
  }

  const currentIdSet = new Set(currentIds);
  if (ids.some((id) => !currentIdSet.has(id))) {
    return {
      ok: false,
      status: 400,
      code: "UNKNOWN_IDS",
      error: "存在しない写真IDが含まれています",
    };
  }
  if (ids.length !== currentIds.length) {
    return {
      ok: false,
      status: 400,
      code: "MISSING_IDS",
      error: "並べ替えには削除済みを除く全写真が必要です",
    };
  }

  return { ok: true, ids };
}

export async function applyPhotoReorderIfCurrent(
  request: PhotoReorderRequest,
  currentRows: readonly PhotoOrderRow[],
  apply: (ids: readonly number[]) => Promise<void>,
): Promise<PhotoReorderValidation> {
  const validation = validatePhotoReorder(request, currentRows);
  if (!validation.ok) return validation;
  if (validation.ids.length > 0) await apply(validation.ids);
  return validation;
}

// Categories, series, pricing, and hero selections have the same stale-tab
// risk as photos. Keep their route code explicit while sharing the exact-order
// check that the photo reorder endpoint already relies on.
export type OrderedListRow = PhotoOrderRow;
export type ExactReorderRequest = PhotoReorderRequest;
export type ExactReorderValidation = PhotoReorderValidation;
export const validateExactReorder = validatePhotoReorder;
export const applyExactReorderIfCurrent = applyPhotoReorderIfCurrent;
