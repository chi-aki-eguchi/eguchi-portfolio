import { describe, expect, test } from "bun:test";
import { reorderLockReason } from "./admin-shared";

// Library 並び替えロックの状態遷移を固定する(2026-07-11)。
// UI 側の復帰ボタンは librarySort="manual" + 全フィルター解除に相当するため、
// 「リセット後」= ("manual", false, false) が必ず unlocked であることが要。
describe("reorderLockReason", () => {
  test("manual + フィルターなし → ロックなし", () => {
    expect(reorderLockReason("manual", false, false)).toBeNull();
  });

  test("manual 以外の表示ソート中は sort ロック", () => {
    expect(reorderLockReason("newest", false, false)).toBe("sort");
    expect(reorderLockReason("title", true, false)).toBe("sort");
  });

  test("manual + フィルター中は filters ロック", () => {
    expect(reorderLockReason("manual", true, false)).toBe("filters");
  });

  test("シリーズ単独の絞り込みは例外としてロックしない", () => {
    expect(reorderLockReason("manual", true, true)).toBeNull();
  });

  test("リセット後(復帰ボタン相当)の状態は必ずロック解除", () => {
    // unlockReorder は librarySort を "manual" に戻し全フィルターを解除する
    expect(reorderLockReason("manual", false, false)).toBeNull();
  });
});
