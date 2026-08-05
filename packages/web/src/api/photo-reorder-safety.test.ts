import { describe, expect, test } from "bun:test";
import {
  applyExactReorderIfCurrent,
  applyPhotoReorderIfCurrent,
  type OrderedListRow,
  validatePhotoReorder,
} from "./photo-reorder-safety";

const current = [
  { id: 10, sortOrder: 2 },
  { id: 20, sortOrder: 8 },
  { id: 30, sortOrder: 15 },
];

describe("validatePhotoReorder", () => {
  test("accepts a complete permutation when the loaded order is still current", () => {
    expect(
      validatePhotoReorder(
        { ids: [30, 10, 20], expectedIds: [10, 20, 30] },
        current,
      ),
    ).toEqual({ ok: true, ids: [30, 10, 20] });
  });

  test("rejects duplicate ids", () => {
    const result = validatePhotoReorder(
      { ids: [10, 20, 20], expectedIds: [10, 20, 30] },
      current,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("DUPLICATE_IDS");
  });

  test("rejects unknown ids", () => {
    const result = validatePhotoReorder(
      { ids: [10, 20, 99], expectedIds: [10, 20, 30] },
      current,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("UNKNOWN_IDS");
  });

  test("rejects an order with a missing photo", () => {
    const result = validatePhotoReorder(
      { ids: [10, 20], expectedIds: [10, 20, 30] },
      current,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("MISSING_IDS");
  });

  test("rejects a stale saved order without accepting the overwrite", () => {
    const changedAtSaveTime = [
      { ...current[0], sortOrder: 8 },
      { ...current[1], sortOrder: 2 },
      current[2],
    ];
    const result = validatePhotoReorder(
      { ids: [30, 20, 10], expectedIds: [10, 20, 30] },
      changedAtSaveTime,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.code).toBe("ORDER_CONFLICT");
      expect(result.error).toContain("再読み込み");
    }
  });

  test("does not call the update when the saved order changed", async () => {
    let updates = 0;
    const result = await applyPhotoReorderIfCurrent(
      { ids: [30, 20, 10], expectedIds: [10, 20, 30] },
      [
        { ...current[0], sortOrder: 8 },
        { ...current[1], sortOrder: 2 },
        current[2],
      ],
      async () => {
        updates += 1;
      },
    );
    expect(result.ok).toBe(false);
    expect(updates).toBe(0);
  });

  test("rejects when a photo was added after the client loaded", () => {
    const result = validatePhotoReorder(
      { ids: [30, 20, 10], expectedIds: [10, 20, 30] },
      [...current, { id: 40, sortOrder: 16 }],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("ORDER_CONFLICT");
  });

  test("the shared guard also rejects a stale non-photo list", async () => {
    const changedAtSaveTime: OrderedListRow[] = [
      { id: 1, sortOrder: 1 },
      { id: 2, sortOrder: 0 },
    ];
    let writes = 0;
    const result = await applyExactReorderIfCurrent(
      { ids: [2, 1], expectedIds: [1, 2] },
      changedAtSaveTime,
      async () => {
        writes += 1;
      },
    );

    expect(result.ok).toBe(false);
    expect(writes).toBe(0);
  });
});
