/**
 * The admin must never offer a value the site cannot express.
 *
 * That is not hypothetical. Measured 2026-08-07: 写真の大きさ offered up to 3.0
 * against a clamp of 2.0, 余白倍率 up to 5.0 against 3.0, and シリーズの列数 up
 * to 8 against 6 — five controls whose upper range moved nothing, with no sign
 * on screen that the value had been discarded. They read as broken save.
 *
 * SETTING_RANGES is now the one place a range is written. These tests fail if a
 * control or a consumer goes back to hardcoding its own bounds, which is the
 * only way the two can drift apart again.
 */
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import {
  SETTING_RANGES,
  clampSetting,
  clampSettingRounded,
  type RangedSettingKey,
} from "./setting-ranges";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

const KEYS = Object.keys(SETTING_RANGES) as RangedSettingKey[];

test("every ranged setting is a real, sane range", () => {
  expect(KEYS.length).toBeGreaterThan(0);
  for (const key of KEYS) {
    const { min, max, step } = SETTING_RANGES[key];
    expect(max).toBeGreaterThan(min);
    expect(step).toBeGreaterThan(0);
    // A step that doesn't divide the span leaves the top of the slider
    // unreachable — the same "can't get there from here" failure.
    const steps = (max - min) / step;
    expect(Math.abs(steps - Math.round(steps))).toBeLessThan(1e-6);
  }
});

test("clampSetting holds a value inside its declared range", () => {
  expect(clampSetting("gallerySizeScale", 99)).toBe(3);
  expect(clampSetting("gallerySizeScale", 0)).toBe(0.5);
  expect(clampSetting("gallerySizeScale", 2.4)).toBe(2.4);
  expect(clampSetting("galleryGapScale", 99)).toBe(5);
});

test("clampSettingRounded lands counts on whole numbers", () => {
  expect(clampSettingRounded("seriesGridColumns", 7.4)).toBe(7);
  expect(clampSettingRounded("seriesGridColumns", 99)).toBe(8);
  expect(clampSettingRounded("seriesGridColumnsMobile", 99)).toBe(3);
});

test("the admin's sliders take their bounds from the table, not from literals", () => {
  const src = read("../web/pages/admin-tabs.tsx");
  const controls = src.match(/<TypoControl\b[\s\S]*?\/>/g) ?? [];
  expect(controls.length).toBeGreaterThan(0);
  const seen = new Set<string>();
  for (const control of controls) {
    const key = control.match(/valueKey="([^"]+)"/)?.[1];
    if (!key || !(key in SETTING_RANGES)) continue;
    seen.add(key);
    for (const prop of ["min", "max", "step"]) {
      const value = control.match(new RegExp(`${prop}=\\{([^}]+)\\}`))?.[1];
      expect(`${key}.${prop} = ${value}`).toBe(
        `${key}.${prop} = SETTING_RANGES.${key}.${prop}`,
      );
    }
  }
  // Every ranged key must actually reach a control — a key nobody offers is a
  // range nobody can hit.
  expect([...seen].sort()).toEqual([...KEYS].sort());
});

test("the consumers clamp through the table instead of their own numbers", () => {
  for (const path of [
    "../web/components/PhotoGallery.tsx",
    "../web/components/SeriesGrid.tsx",
  ]) {
    const src = read(path);
    for (const key of KEYS) {
      // A bare clamp(...) mentioning a ranged key is the old shape that drifted.
      const strayClamp = new RegExp(`\\bclamp\\([^;]*\\b${key}\\b`);
      expect(`${path}: ${strayClamp.test(src)}`).toBe(`${path}: false`);
    }
  }
});
