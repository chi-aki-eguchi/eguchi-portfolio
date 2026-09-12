import { expect, test } from "bun:test";
import { boundedPreviewDimension, fitPreviewViewport, PREVIEW_DESKTOP, PREVIEW_MOBILE } from "./admin-preview-viewport";

test("縮小しても実際の画面の縦横比を保ち、欄の縦を埋めるために高さを増やさない", () => {
  for (const viewport of [PREVIEW_DESKTOP, PREVIEW_MOBILE, {width: 1080, height: 720}]) {
    for (const stage of [{width: 320, height: 900}, {width: 900, height: 300}, {width: 2000, height: 1200}]) {
      const fit = fitPreviewViewport(viewport, stage);
      expect(fit.width / fit.height).toBeCloseTo(viewport.width / viewport.height, 8);
      expect(fit.width).toBeLessThanOrEqual(stage.width);
      expect(fit.height).toBeLessThanOrEqual(stage.height);
      expect(fit.scale).toBeLessThanOrEqual(1);
    }
  }
});

test("寸法を空にして入力し直せ、不正値は元の寸法を保つ", () => {
  expect(boundedPreviewDimension(NaN, 1440)).toBe(1440);
  expect(boundedPreviewDimension(Infinity, 900)).toBe(900);
  expect(boundedPreviewDimension(10, 900)).toBe(280);
  expect(boundedPreviewDimension(10000, 900)).toBe(3840);
  expect(boundedPreviewDimension(1080.4, 900)).toBe(1080);
});
