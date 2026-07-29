import { describe, expect, test } from "bun:test";
import { adminThemeFromSettings } from "../pages/admin";

type Rgb = { r: number; g: number; b: number };

function hexToRgb(hex: string): Rgb {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`Expected a six-digit hex color, received ${hex}`);
  const value = match[1];
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

// WCAG relative luminance calculation kept independent from admin.tsx so this
// test detects regressions in the production calculation rather than repeating it.
function relativeLuminance({ r, g, b }: Rgb): number {
  const linear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrastRatio(first: string, second: string): number {
  const [light, dark] = [
    relativeLuminance(hexToRgb(first)),
    relativeLuminance(hexToRgb(second)),
  ].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

function themeColor(theme: ReturnType<typeof adminThemeFromSettings>, key: string) {
  const value = (theme as Record<string, string>)[key];
  if (!value) throw new Error(`Missing ${key} from admin theme`);
  return value;
}

const cases = [
  { name: "default settings", settings: undefined },
  {
    name: "dark theme",
    settings: { themeBg: "#111111", themeText: "#f0f0f0" },
  },
  {
    name: "unreadable light theme is corrected",
    settings: { themeBg: "#f7f7f7", themeText: "#eeeeee" },
  },
];

describe("adminThemeFromSettings contrast guarantees", () => {
  for (const { name, settings } of cases) {
    test(name, () => {
      const theme = adminThemeFromSettings(settings);
      const paper = themeColor(theme, "--admin-paper");
      const deep = themeColor(theme, "--admin-paper-deep");
      const inkVsPaper = contrastRatio(themeColor(theme, "--admin-ink"), paper);
      const mutedVsDeep = contrastRatio(themeColor(theme, "--admin-muted"), deep);

      expect(inkVsPaper).toBeGreaterThanOrEqual(7);
      expect(mutedVsDeep).toBeGreaterThanOrEqual(4.5);
      for (const semanticToken of [
        "--admin-danger",
        "--admin-warning",
        "--admin-success",
        "--admin-info",
      ]) {
        expect(
          contrastRatio(themeColor(theme, semanticToken), paper),
        ).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  test("管理画面の初期accentは公開サイトのaccentと意味色から独立する", () => {
    const theme = adminThemeFromSettings({
      accentColor: "#d14b74",
      linkHoverColor: "#e05f87",
    });
    const accent = themeColor(theme, "--admin-accent");
    const semanticColors = [
      "--admin-danger",
      "--admin-warning",
      "--admin-success",
      "--admin-info",
    ].map((token) => themeColor(theme, token));

    expect(accent).toBe("#5b7fa0");
    expect(themeColor(theme, "--admin-accent-fill")).toBe("#3f607e");
    expect(themeColor(theme, "--admin-accent-line")).toBe("2.5px");
    expect(new Set([accent, ...semanticColors]).size).toBe(5);
  });
});
