import { test, expect } from "bun:test";
import { GENERATED_THUMB_WIDTH, fittedThumbWidth } from "./thumb-fit";

test("小さいタイルには、足りる中でいちばん小さい段を使う", () => {
  // 本番トップの実測値: 74px の枠・DPR2 → 148px 必要。
  expect(fittedThumbWidth(74, 2)).toBe(160);
  expect(fittedThumbWidth(74, 1)).toBe(160);
  expect(fittedThumbWidth(110, 2)).toBe(240);
  expect(fittedThumbWidth(150, 2)).toBe(320);
  expect(fittedThumbWidth(200, 2)).toBe(480);
});

test("高精細な端末では、そのぶん大きい段になる", () => {
  expect(fittedThumbWidth(74, 2.625)).toBe(240);
  expect(fittedThumbWidth(120, 3)).toBe(480);
  // DPR がおかしな値でも、3倍より上は求めない。
  expect(fittedThumbWidth(74, 10)).toBe(240);
  expect(fittedThumbWidth(74, 0)).toBe(160);
});

test("作り置きサムネで足りるなら、縮めない（null）", () => {
  expect(fittedThumbWidth(320, 2)).toBe(null);
  expect(fittedThumbWidth(GENERATED_THUMB_WIDTH, 2)).toBe(null);
  expect(fittedThumbWidth(1200, 1)).toBe(null);
});

test("枠の大きさが分からないときは縮めない", () => {
  expect(fittedThumbWidth(undefined, 2)).toBe(null);
  expect(fittedThumbWidth(null, 2)).toBe(null);
  expect(fittedThumbWidth(0, 2)).toBe(null);
  expect(fittedThumbWidth(-10, 2)).toBe(null);
  expect(fittedThumbWidth(Number.NaN, 2)).toBe(null);
});
