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

  test("差し色は公開サイトに追従するが、意味を持つ色とは別のまま", () => {
    // 2026-08-17 にオーナー判断で「差し色も同期する」へ変えた。
    // 変更前はここが `expect(accent).toBe("#5b7fa0")`（追従しない契約）だった。
    // 意味を持つ4色（危険・注意・成功・情報）は同期しない。差し色と同じ色に
    // なると「消す」と「保存する」が同じ色で並ぶ。
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

    expect(accent).not.toBe("#5b7fa0");
    expect(contrastRatio(accent, themeColor(theme, "--admin-paper"))).toBeGreaterThanOrEqual(4.5);
    expect(themeColor(theme, "--admin-accent-line")).toBe("2.5px");
    expect(new Set([accent, ...semanticColors]).size).toBe(5);
  });

  test("公開サイトのaccent設定を変えてもAdmin warningは変わらない", () => {
    const roseAccent = adminThemeFromSettings({
      accentColor: "#d14b74",
      linkHoverColor: "#e05f87",
    });
    const blueAccent = adminThemeFromSettings({
      accentColor: "#2457d6",
      linkHoverColor: "#183b91",
    });

    expect(themeColor(roseAccent, "--admin-warning")).toBe(
      themeColor(blueAccent, "--admin-warning"),
    );
    expect(themeColor(roseAccent, "--admin-warning")).not.toBe(
      themeColor(roseAccent, "--admin-accent"),
    );
  });
});

/**
 * 小さい文字を α で薄くしない。
 *
 * `--admin-muted` は紙に対して 4.73:1 で、12px の文字に必要な 4.5:1 を
 * ぎりぎり満たしている。そこへ `rgba(var(--admin-muted-rgb), 0.85)` のように
 * 透明度を掛けると、紙に重なった実効色は 3.57:1 まで落ちる（2026-08-17 実測）。
 * 実際に補足文（`.ax-field__hint`）と一覧のメタ（`.ax-row__meta`）が
 * この状態だった。薄さで階層を作らず、太さと大きさで作る。
 */
describe("管理画面の小さい文字はαで薄めない", () => {
  test("muted に透明度を掛けた色を文字色に使っていない", async () => {
    const styles = await Bun.file(
      new URL("../styles.css", import.meta.url),
    ).text();
    const offenders: string[] = [];
    for (const rule of styles.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const [, selector, body] = rule;
      // プレースホルダだけは薄いままにする。ここを濃くすると「空欄」が
      // 「入力済み」に見え、どの設定を自分で書いたのか分からなくなる。
      if (selector.includes("::placeholder")) continue;
      if (/color:\s*rgba\(var\(--admin-muted-rgb\)/.test(body)) {
        offenders.push(selector.trim().split("\n").pop() ?? selector);
      }
    }
    expect(offenders).toEqual([]);
  });
});

/**
 * 管理画面の色は、オーナーが admin で選んだ公開サイトの色と同期する。
 *
 * 2026-08-17 オーナー判断:「独立させない。admin で変えられる公開サイトの色と
 * 同期させよう」。2026-08-07 の「独立させる」方針はこれで撤回された。
 * ただし**読めなくなる組み合わせは選ばせない**（上の contrast guarantees）。
 */
describe("管理画面の色は公開サイトの設定と同期する", () => {
  test("背景色と文字色に追従する", () => {
    const theme = adminThemeFromSettings({
      themeBg: "#0e1420",
      themeText: "#e6ecf5",
    });
    expect(themeColor(theme, "--admin-paper")).toBe("#0e1420");
    // 文字色は 7:1 を満たしていればそのまま使う。
    expect(themeColor(theme, "--admin-ink")).toBe("#e6ecf5");
  });

  test("明るいテーマの色を暗いテーマへ流用しない", () => {
    // 公開サイトは明暗で別々の設定を持つ（themeBg / themeBgDark）。
    // ここを取り違えると「明るい紙に暗いテーマの文字色」が起きる。
    const settings = {
      themeBg: "#f5f0eb",
      themeText: "#1a1a1a",
      themeBgDark: "#101418",
      themeTextDark: "#e8e8e8",
    };
    expect(
      themeColor(adminThemeFromSettings(settings, "light"), "--admin-paper"),
    ).toBe("#f5f0eb");
    expect(
      themeColor(adminThemeFromSettings(settings, "dark"), "--admin-paper"),
    ).toBe("#101418");
  });

  test("暗い用の色が未設定なら admin 既定の黒へ戻す（明るい用を流用しない）", () => {
    const theme = adminThemeFromSettings(
      { themeBg: "#f5f0eb", themeText: "#1a1a1a" },
      "dark",
    );
    expect(themeColor(theme, "--admin-paper")).toBe("#121212");
    expect(themeColor(theme, "--admin-ink")).toBe("#e8e8e8");
  });

  test("差し色にも追従し、紙の上で読めるところまでは寄せる", () => {
    const rose = adminThemeFromSettings({ accentColor: "#d14b74" });
    expect(themeColor(rose, "--admin-accent")).not.toBe(
      themeColor(adminThemeFromSettings(), "--admin-accent"),
    );
    // 紙に対して薄すぎる差し色は、必要な分だけ濃くしてから使う。
    const pale = adminThemeFromSettings({
      themeBg: "#ffffff",
      accentColor: "#ffe680",
    });
    expect(
      contrastRatio(themeColor(pale, "--admin-accent"), "#ffffff"),
    ).toBeGreaterThanOrEqual(4.5);
  });

  test("色を何も選んでいなければ、今までの admin の色のまま", () => {
    const theme = adminThemeFromSettings();
    expect(themeColor(theme, "--admin-paper")).toBe("#f7f5f1");
    expect(themeColor(theme, "--admin-ink")).toBe("#1b1917");
    expect(themeColor(theme, "--admin-accent")).toBe("#5b7fa0");
    expect(themeColor(theme, "--admin-accent-fill")).toBe("#3f607e");
  });
});
