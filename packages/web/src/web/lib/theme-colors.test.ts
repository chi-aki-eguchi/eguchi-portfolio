/**
 * B-21 の回帰テスト。
 *
 * オーナーが選んだ背景色・文字色は `:root` のインラインstyleとして当たるため、
 * styles.css の `[data-theme="dark"]` より強い。テーマごとに当てる色を選び直さない
 * と、暗い表示のときに「明るい背景 × 暗いテーマの文字色」が同時に効いて文字が
 * 読めなくなる。`useDarkMode` の既定は "system" なので、閲覧者が何も操作しなくても
 * OSが暗い設定ならこの状態になる。
 *
 * 実測（2026-08-07 / localhost:5173 / getComputedStyle）:
 *   themeBg=#f5f0eb だけ設定 → 暗い表示で 背景 #f5f0eb / 文字 #e8e8e8 = 約1.08:1
 *
 * このテストは「明るい表示用の色を暗い表示へ流用しない」ことを固定する。
 */
import { test, expect } from "bun:test";
import { JSDOM } from "jsdom";
import {
  applyThemeColors,
  themeColorsFor,
  THEME_DEFAULT_BG,
} from "./theme-colors";

const dom = new JSDOM(
  '<!doctype html><html><head><meta name="theme-color" content="#f7f7f7"></head><body></body></html>',
  { url: "http://localhost/" },
);
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
});

const LIGHT_BG = "#f5f0eb";
const LIGHT_TEXT = "#1a1a1a";

/** WCAG relative luminance / contrast ratio（実測値の再現用）。 */
function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const ch = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const DARK_DEFAULT_TEXT = "#e8e8e8";

test("背景色だけ設定した状態が、暗い表示の既定文字色と組むと読めない（バグの前提）", () => {
  // この比が低いこと自体は styles.css の既定の性質。だから「流用しない」が要る。
  expect(contrast(LIGHT_BG, DARK_DEFAULT_TEXT)).toBeLessThan(1.5);
});

test("暗い表示では、明るい表示用の色を流用しない", () => {
  const { bg, text } = themeColorsFor("dark", {
    themeBg: LIGHT_BG,
    themeText: LIGHT_TEXT,
  });
  // 空 = インラインstyleを外し、styles.css の [data-theme="dark"] 既定へ戻す。
  expect(bg).toBe("");
  expect(text).toBe("");
});

test("暗い表示用の色を設定すれば、そちらが当たる", () => {
  const { bg, text } = themeColorsFor("dark", {
    themeBg: LIGHT_BG,
    themeText: LIGHT_TEXT,
    themeBgDark: "#101012",
    themeTextDark: "#ededed",
  });
  expect(bg).toBe("#101012");
  expect(text).toBe("#ededed");
});

test("明るい表示は従来どおりオーナーの色が当たる", () => {
  const { bg, text } = themeColorsFor("light", {
    themeBg: LIGHT_BG,
    themeText: LIGHT_TEXT,
    themeBgDark: "#101012",
    themeTextDark: "#ededed",
  });
  expect(bg).toBe(LIGHT_BG);
  expect(text).toBe(LIGHT_TEXT);
});

test("暗い表示へ切り替えると、当たっていたインラインstyleが実際に外れる", () => {
  const root = document.documentElement;
  // 明るい表示で当てる
  applyThemeColors(LIGHT_BG, LIGHT_TEXT, "light");
  expect(root.style.getPropertyValue("--background")).toBe(LIGHT_BG);
  expect(root.style.getPropertyValue("--foreground")).toBe(LIGHT_TEXT);
  expect(root.style.getPropertyValue("--background-rgb")).toBe("245,240,235");

  // 暗い表示へ。暗い色が未設定なら外れて styles.css の既定が効く状態になる。
  const dark = themeColorsFor("dark", {
    themeBg: LIGHT_BG,
    themeText: LIGHT_TEXT,
  });
  applyThemeColors(dark.bg, dark.text, "dark");
  expect(root.style.getPropertyValue("--background")).toBe("");
  expect(root.style.getPropertyValue("--foreground")).toBe("");
  expect(root.style.getPropertyValue("--background-rgb")).toBe("");
  expect(root.style.getPropertyValue("--foreground-rgb")).toBe("");
  expect(document.body.style.backgroundColor).toBe("");
  expect(document.body.style.color).toBe("");
});

test("theme-color は実効背景に追従する（未設定なら各テーマの既定）", () => {
  const meta = document.querySelector('meta[name="theme-color"]')!;
  applyThemeColors("", "", "dark");
  expect(meta.getAttribute("content")).toBe(THEME_DEFAULT_BG.dark);
  applyThemeColors("", "", "light");
  expect(meta.getAttribute("content")).toBe(THEME_DEFAULT_BG.light);
  applyThemeColors("#101012", "#ededed", "dark");
  expect(meta.getAttribute("content")).toBe("#101012");
});

test("暗い背景ではテクスチャの合成方法が screen へ切り替わる", () => {
  const root = document.documentElement;
  applyThemeColors("#101012", "#ededed", "dark");
  expect(root.style.getPropertyValue("--bg-texture-blend")).toBe("screen");
  applyThemeColors(LIGHT_BG, LIGHT_TEXT, "light");
  expect(root.style.getPropertyValue("--bg-texture-blend")).toBe("multiply");
});
