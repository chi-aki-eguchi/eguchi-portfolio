/**
 * The range each numeric setting may take.
 *
 * One table, read by both the admin control that offers the value and the code
 * that consumes it — because those two drifted apart. The admin offered
 * 写真の大きさ up to 3.0 while the gallery clamped at 2.0, and 余白倍率 up to
 * 5.0 against a clamp of 3.0, so the top of each slider moved nothing. Nothing
 * says so on screen, which is exactly how a working control comes to look
 * broken (2026-08-07 owner report, same shape as the 列数 problem that
 * `galleryFrameWidth` fixes).
 *
 * The rule this table exists to keep: **a control must never offer a value the
 * site cannot express.** When widening a range, widen it here — both sides
 * follow, and `setting-ranges.test.ts` fails if a control hardcodes its own.
 *
 * `fallback` is the value used when the setting is unset or unparseable. It is
 * omitted where the consumer's default is contextual (the column keys fall back
 * to whatever the chosen layout historically used).
 */
export type SettingRange = {
  min: number;
  max: number;
  step: number;
  fallback?: number;
};

export const SETTING_RANGES = {
  // Gallery grid. Columns are a *maximum* — the rendered count steps down with
  // the available width; see galleryFrameWidth in PhotoGallery.tsx.
  galleryColumns: { min: 1, max: 8, step: 1 },
  gallerySizeScale: { min: 0.5, max: 3, step: 0.05, fallback: 1 },
  galleryGapScale: { min: 0.2, max: 5, step: 0.05, fallback: 1 },
  // Top (Works) grid — independent keys, falling back to the gallery's values.
  topWorksColumns: { min: 1, max: 8, step: 1 },
  topWorksSizeScale: { min: 0.5, max: 3, step: 0.05, fallback: 1 },
  topWorksGapScale: { min: 0.2, max: 5, step: 0.05, fallback: 1 },
  // Mosaic-only shaping.
  galleryEmptyRate: { min: 0, max: 0.4, step: 0.01, fallback: 0.1 },
  gallerySizeVariation: { min: 0, max: 1, step: 0.05, fallback: 0.5 },
  // Series grid. Fixed counts, not width-derived.
  seriesGridColumns: { min: 1, max: 8, step: 1, fallback: 3 },
  seriesGridColumnsMobile: { min: 1, max: 3, step: 1, fallback: 2 },
  // TOP のシリーズ帯（横に流れる）。速さは px/秒 で持つ。1周の秒数にすると
  // シリーズの本数で体感速度が変わってしまい、増やしたとたん速くなる。
  topSeriesStreamSpeed: { min: 8, max: 120, step: 2, fallback: 34 },
  topSeriesStreamHeight: { min: 140, max: 460, step: 10, fallback: 260 },
} as const satisfies Record<string, SettingRange>;

export type RangedSettingKey = keyof typeof SETTING_RANGES;

/** Hold a value inside its declared range. */
export function clampSetting(key: RangedSettingKey, value: number): number {
  const { min, max } = SETTING_RANGES[key];
  return Math.max(min, Math.min(max, value));
}

/** Same, for the settings that count things and must land on a whole number. */
export function clampSettingRounded(
  key: RangedSettingKey,
  value: number,
): number {
  return clampSetting(key, Math.round(value));
}
